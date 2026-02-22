/**
 * syncEngine.ts
 *
 * Processes the offline queue in dependency order:
 *   1. save_route   (route + waypoints + images as one atomic unit)
 *   2. car_create / car_update / car_delete
 *
 * Within each priority tier, items are processed FIFO (oldest createdAt first).
 *
 * Retry policy: up to MAX_RETRIES (3) attempts per item.
 *   - On failure: increment retryCount, status → 'failed' (if maxed) | 'pending'
 *   - On success: remove from queue + remove from local routes
 *   - Image upload failures inside save_route are non-fatal (route still syncs)
 */

import { supabase } from './supabase';
import {
  getQueue,
  updateQueueItem,
  removeFromQueue,
  removeLocalRoute,
  PendingOperation,
  SaveRoutePayload,
  CarCreatePayload,
  CarUpdatePayload,
  CarDeletePayload,
} from './offlineStore';
import { uploadWaypointImage } from './media';
import { isOnline } from './network';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

const MAX_RETRIES = 3;

// ── Type-priority map (lower = synced first) ──────────────────────────────────

const TYPE_PRIORITY: Record<PendingOperation['type'], number> = {
  save_route: 0,
  car_create: 1,
  car_update: 2,
  car_delete: 3,
};

// ── Route sync ────────────────────────────────────────────────────────────────

async function syncSaveRoute(payload: SaveRoutePayload): Promise<void> {
  const { routeId, userId, route, waypoints } = payload;

  // 1. Insert route with the pre-generated UUID
  //    Use upsert-style: ignore duplicate key errors (idempotency on retry)
  const { error: routeError } = await supabase.from('routes').insert(route);

  if (routeError && routeError.code !== '23505') {
    // '23505' = unique_violation — route already inserted on a previous attempt
    throw new Error(routeError.message);
  }

  // 2. Insert waypoints (also idempotent via duplicate key ignore)
  if (waypoints.length > 0) {
    const waypointRows = waypoints.map((wp, i) => ({
      id: wp.id,
      route_id: routeId,
      lat: wp.data.lat,
      lng: wp.data.lng,
      sort_order: i,
      type: wp.data.type ?? null,
      note: wp.data.note ?? null,
    }));

    const { error: wpError } = await supabase.from('waypoints').insert(waypointRows);

    if (wpError && wpError.code !== '23505') {
      throw new Error(wpError.message);
    }

    // 3. Upload images (non-fatal — route syncs even if images fail)
    for (const wp of waypoints) {
      if (!wp.localImageUri) continue;
      try {
        const storagePath = await uploadWaypointImage(userId, wp.id, wp.localImageUri);
        if (storagePath) {
          await supabase
            .from('waypoints')
            .update({ image_urls: [storagePath] })
            .eq('id', wp.id);
        }
      } catch {
        // Image upload failure is intentionally swallowed here.
        // The waypoint row is already in the DB; image can be re-uploaded later.
      }
    }
  }
}

// ── Car syncs ─────────────────────────────────────────────────────────────────

async function syncCarCreate(payload: CarCreatePayload): Promise<void> {
  const { error } = await supabase.from('cars').insert(payload.car);
  if (error && error.code !== '23505') throw new Error(error.message);
}

async function syncCarUpdate(payload: CarUpdatePayload): Promise<void> {
  const { error } = await supabase
    .from('cars')
    .update(payload.updates)
    .eq('id', payload.carId);
  if (error) throw new Error(error.message);
}

async function syncCarDelete(payload: CarDeletePayload): Promise<void> {
  const { error } = await supabase.from('cars').delete().eq('id', payload.carId);
  if (error) throw new Error(error.message);
}

// ── Single item ───────────────────────────────────────────────────────────────

/**
 * Processes one pending operation.
 * Returns true on success (item removed from queue), false on failure (retried later).
 */
export async function processSingleItem(op: PendingOperation): Promise<boolean> {
  try {
    await updateQueueItem(op.id, { status: 'syncing' });

    switch (op.type) {
      case 'save_route':
        await syncSaveRoute(op.payload);
        await removeLocalRoute(op.payload.routeId);
        break;
      case 'car_create':
        await syncCarCreate(op.payload);
        break;
      case 'car_update':
        await syncCarUpdate(op.payload);
        break;
      case 'car_delete':
        await syncCarDelete(op.payload);
        break;
    }

    await removeFromQueue(op.id);
    return true;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unbekannter Fehler';
    const newRetryCount = op.retryCount + 1;
    await updateQueueItem(op.id, {
      status: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
      retryCount: newRetryCount,
      error,
    });
    return false;
  }
}

// ── Queue processor ───────────────────────────────────────────────────────────

/**
 * Processes all eligible pending operations.
 *
 * Eligible = status 'pending' OR status 'failed' with retryCount < MAX_RETRIES.
 * Sorted by type priority then createdAt (FIFO).
 *
 * Returns a SyncResult summary.
 */
export async function processQueue(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) {
    const queue = await getQueue();
    return { synced: 0, failed: 0, remaining: queue.length };
  }

  const queue = await getQueue();
  const eligible = queue.filter(
    (op) =>
      op.status === 'pending' ||
      (op.status === 'failed' && op.retryCount < MAX_RETRIES),
  );

  const sorted = [...eligible].sort((a, b) => {
    const pd = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    if (pd !== 0) return pd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let synced = 0;
  let failed = 0;

  for (const op of sorted) {
    const success = await processSingleItem(op);
    if (success) synced++;
    else failed++;
  }

  const remaining = (await getQueue()).length;
  return { synced, failed, remaining };
}
