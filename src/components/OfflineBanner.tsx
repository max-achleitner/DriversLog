/**
 * OfflineBanner.tsx
 *
 * A persistent amber bar shown at the top of the screen when the device
 * has no internet connection. Automatically disappears when back online.
 *
 * Usage: render once near the root of the screen tree (inside InnerLayout).
 */

import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useNetworkStatus } from '../lib/network';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();

  // Show when disconnected OR when connected but internet is explicitly unreachable
  const isOffline = !isConnected || isInternetReachable === false;

  if (!isOffline) return null;

  return (
    <View
      style={{
        backgroundColor: '#B45309', // amber-700 — visible but not jarring
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        paddingHorizontal: 16,
        gap: 6,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color="#FEF3C7" />
      <Text
        style={{
          color: '#FEF3C7',
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}
      >
        Offline — Daten werden lokal gespeichert
      </Text>
    </View>
  );
}
