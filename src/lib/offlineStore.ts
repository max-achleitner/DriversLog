/**
 * offlineStore.ts
 *
 * Typed wrapper around AsyncStorage for offline data persistence:
 *   - Pending operation queue  (routes, cars — write ops that need syncing)
 *   - Local-only routes        (saved locally, not yet in Supabase)
 *   - Draft recording          (crash/kill protection for in-progress tracking)
 *
 * Storage keys:
 *   @driverslog/offline_queue   — JSON array of PendingOperation
 *   @driverslog/local_routes    — JSON array of LocalRoute
 *   @driverslog/draft_recording — JSON object of DraftRecording | null
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeoPoint, RouteInsert, CarInsert, WaypointInsert, WaypointType } from '../types/supabase';

// ── Keys ──────────────────────────────────────────────────────────────────────

const QUEUE_KEY = '@driverslog/offline_queue';
const LOCAL_ROUTES_KEY = '@driverslog/local_routes';
const DRAFT_RECORDING_KEY = '@driverslog/draft_recording';

// ── UUID generator (no external dep) ─────────────────────────────────────────

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Payload types ─────────────────────────────────────────────────────────────

/** A waypoint captured during recording, including its local image URI. */
export interface OfflineWaypoint {
  id: string;           // pre-generated UUID
  data: WaypointInsert;
  localImageUri?: string;
}

/** Route + waypoints saved offline, ready to sync to Supabase. */
export interface SaveRoutePayload {
  routeId: string;      // pre-generated UUID — used as the DB primary key
  userId: string;
  route: RouteInsert & { id: string };
  waypoints: OfflineWaypoint[];
}

export interface CarCreatePayload {
  car: CarInsert & { id: string };  // pre-generated UUID for idempotency
}

export interface CarUpdatePayload {
  carId: string;
  updates: Partial<Omit<CarInsert, 'user_id'>>;
}

export interface CarDeletePayload {
  carId: string;
}

// ── Pending operation (discriminated union) ───────────────────────────────────

type OpBase = {
  id: string;
  createdAt: string;   // ISO timestamp
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
};

export type PendingOperation =
  | (OpBase & { type: 'save_route'; payload: SaveRoutePayload })
  | (OpBase & { type: 'car_create'; payload: CarCreatePayload })
  | (OpBase & { type: 'car_update'; payload: CarUpdatePayload })
  | (OpBase & { type: 'car_delete'; payload: CarDeletePayload });

/** Input shape for addToQueue — id, createdAt, retryCount, status are auto-set. */
export type OperationInput =
  | { type: 'save_route'; payload: SaveRoutePayload }
  | { type: 'car_create'; payload: CarCreatePayload }
  | { type: 'car_update'; payload: CarUpdatePayload }
  | { type: 'car_delete'; payload: CarDeletePayload };

// ── Queue management ──────────────────────────────────────────────────────────

/** Reads the queue from AsyncStorage. Returns [] on parse errors. */
export async function getQueue(): Promise<PendingOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingOperation[];
  } catch {
    return [];
  }
}

/**
 * Adds a new operation to the queue. Prevents duplicates: if an operation
 * of the same type referencing the same route/car already exists, skips.
 * Returns the new operation's ID.
 */
export async function addToQueue(op: OperationInput): Promise<string> {
  const queue = await getQueue();

  // Duplicate prevention for route saves
  if (op.type === 'save_route') {
    const routeId = op.payload.routeId;
    const exists = queue.some(
      (item) => item.type === 'save_route' && item.payload.routeId === routeId,
    );
    if (exists) {
      const existing = queue.find(
        (item) => item.type === 'save_route' && item.payload.routeId === routeId,
      );
      return existing!.id;
    }
  }

  const id = generateId();
  const newOp: PendingOperation = {
    ...op,
    id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  } as PendingOperation;

  queue.push(newOp);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return id;
}

/** Updates status, retryCount, or error on a queue item. */
export async function updateQueueItem(
  id: string,
  updates: Partial<Pick<PendingOperation, 'status' | 'retryCount' | 'error'>>,
): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((op) => op.id === id);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...updates } as PendingOperation;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Removes a successfully synced item from the queue. */
export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((op) => op.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/** Resets all 'failed' items back to 'pending' so they will be retried. */
export async function retryFailedItems(): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((op) =>
    op.status === 'failed' ? { ...op, status: 'pending' as const, retryCount: 0, error: undefined } : op,
  );
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/** Removes all items from the queue. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Returns the total number of items in the queue. */
export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

// ── Local routes (offline viewing) ───────────────────────────────────────────

/**
 * A route saved locally (pending sync). Contains enough data to render
 * the route card and detail view before the route exists in Supabase.
 */
export interface LocalRoute {
  id: string;                   // same UUID used in the queue payload
  title: string;
  description: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  polylineJson: GeoPoint[] | null;
  createdAt: string;            // ISO timestamp
  carId: string | null;
}

export async function addLocalRoute(route: LocalRoute): Promise<void> {
  const routes = await getLocalRoutes();
  if (routes.some((r) => r.id === route.id)) return; // already stored
  routes.push(route);
  await AsyncStorage.setItem(LOCAL_ROUTES_KEY, JSON.stringify(routes));
}

export async function getLocalRoutes(): Promise<LocalRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ROUTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalRoute[];
  } catch {
    return [];
  }
}

export async function removeLocalRoute(id: string): Promise<void> {
  const routes = await getLocalRoutes();
  const filtered = routes.filter((r) => r.id !== id);
  await AsyncStorage.setItem(LOCAL_ROUTES_KEY, JSON.stringify(filtered));
}

// ── Draft recording (crash / app-kill protection) ─────────────────────────────

/**
 * Snapshot of an in-progress recording session.
 * Saved periodically so a killed app can recover the route.
 */
export interface DraftRecording {
  points: GeoPoint[];
  waypoints: Array<{
    id: string;
    lat: number;
    lng: number;
    timestamp: number;
    type?: WaypointType;
    note?: string;
    localImageUri?: string;
  }>;
  startTime: number;
  elapsedSeconds: number;
  distanceKm: number;
  savedAt: string;  // ISO timestamp of when this snapshot was taken
}

export async function saveDraftRecording(draft: DraftRecording): Promise<void> {
  await AsyncStorage.setItem(DRAFT_RECORDING_KEY, JSON.stringify(draft));
}

export async function getDraftRecording(): Promise<DraftRecording | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_RECORDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftRecording;
  } catch {
    return null;
  }
}

export async function clearDraftRecording(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_RECORDING_KEY);
}
