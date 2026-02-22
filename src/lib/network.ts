/**
 * network.ts
 *
 * Network connectivity utilities using @react-native-community/netinfo.
 *
 * Usage:
 *   const { isConnected } = useNetworkStatus();
 *   const online = await isOnline();
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

/**
 * React hook that subscribes to real-time network status changes.
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,       // optimistic default — corrected immediately by fetch()
    isInternetReachable: null,
  });

  useEffect(() => {
    // Fetch the current state immediately so initial render is accurate
    NetInfo.fetch().then((state) => {
      setNetworkStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
      });
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
      });
    });

    return unsubscribe;
  }, []);

  return networkStatus;
}

/**
 * One-shot async check — resolves to true if the device is online.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}
