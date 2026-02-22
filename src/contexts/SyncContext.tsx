/**
 * SyncContext.tsx
 *
 * Provides app-wide offline sync state and the auto-sync trigger.
 *
 * Features:
 *   - Tracks pending and failed operation counts
 *   - Auto-syncs 2 seconds after connectivity returns (offline → online)
 *   - Runs initial sync on app launch if queue is non-empty
 *   - Refreshes counts when app returns to foreground
 *   - Exposes syncNow() for manual sync from UI
 *
 * Must be mounted INSIDE ToastProvider (uses useToast).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useNetworkStatus } from '../lib/network';
import { processQueue, SyncResult } from '../lib/syncEngine';
import { getQueue, getQueueSize } from '../lib/offlineStore';
import { useToast } from './ToastContext';

// ── Context shape ─────────────────────────────────────────────────────────────

interface SyncContextValue {
  /** Total items in queue (pending + syncing + failed). */
  pendingCount: number;
  /** Items permanently failed (retryCount >= 3). */
  failedCount: number;
  /** True while processQueue() is running. */
  isSyncing: boolean;
  /** Result of the last completed sync run (null before first run). */
  lastSyncResult: SyncResult | null;
  /** Trigger a manual sync immediately. */
  syncNow: () => Promise<void>;
  /** Re-read queue size from AsyncStorage. */
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  lastSyncResult: null,
  syncNow: async () => {},
  refreshPendingCount: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useNetworkStatus();
  const { showToast } = useToast();

  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Ref guards to prevent concurrent syncs and stale closure issues
  const isSyncingRef = useRef(false);
  const prevConnectedRef = useRef<boolean | null>(null);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Count helpers ───────────────────────────────────────────────────────────

  const refreshPendingCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
    setFailedCount(queue.filter((op) => op.status === 'failed').length);
  }, []);

  // ── Core sync function ──────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    const pendingBefore = await getQueueSize();
    if (pendingBefore === 0) {
      isSyncingRef.current = false;
      setIsSyncing(false);
      return;
    }

    showToast({ type: 'info', message: 'Synchronisiere...' });

    try {
      const result = await processQueue();
      setLastSyncResult(result);
      await refreshPendingCount();

      if (result.synced > 0 && result.failed === 0) {
        const n = result.synced;
        showToast({
          type: 'success',
          message: `${n} ${n === 1 ? 'Eintrag' : 'Einträge'} erfolgreich synchronisiert!`,
        });
      } else if (result.synced > 0 && result.failed > 0) {
        showToast({
          type: 'warning',
          message: `${result.synced} von ${result.synced + result.failed} Einträgen synchronisiert. ${result.failed} Fehler.`,
        });
      } else if (result.failed > 0 && result.synced === 0) {
        showToast({
          type: 'error',
          message: `Synchronisierung fehlgeschlagen für ${result.failed} ${result.failed === 1 ? 'Eintrag' : 'Einträge'}.`,
        });
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [showToast, refreshPendingCount]);

  // Stable ref so connectivity effect always calls the latest syncNow
  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  // ── Auto-sync on connectivity restore ──────────────────────────────────────

  useEffect(() => {
    const wasOffline = prevConnectedRef.current === false;
    const isNowOnline = isConnected === true;

    if (wasOffline && isNowOnline) {
      // Wait 2 s for the connection to stabilise before syncing
      autoSyncTimerRef.current = setTimeout(() => {
        void syncNowRef.current();
      }, 2000);
    }

    prevConnectedRef.current = isConnected;

    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [isConnected]);

  // ── App-start sync + foreground refresh ────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function init() {
      await refreshPendingCount();
      const size = await getQueueSize();
      if (size > 0 && mounted) {
        // Delay so the app finishes launching before the sync toast appears
        setTimeout(() => {
          void syncNowRef.current();
        }, 3000);
      }
    }

    void init();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshPendingCount();
      }
    });

    return () => {
      mounted = false;
      appStateSub.remove();
    };
  }, [refreshPendingCount]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SyncContext.Provider
      value={{
        pendingCount,
        failedCount,
        isSyncing,
        lastSyncResult,
        syncNow,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
