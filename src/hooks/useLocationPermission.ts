import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../lib/permissions';

interface UseLocationPermissionReturn {
  status: Location.PermissionStatus | null;
  requestPermission: () => Promise<void>;
}

export function useLocationPermission(): UseLocationPermissionReturn {
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status: s }) => {
        setStatus(s);
      })
      .catch(() => {
        // Info.plist keys missing or location services unavailable
        setStatus(Location.PermissionStatus.DENIED);
      });
  }, []);

  const requestPermission = useCallback(async () => {
    // Goes through the full permission flow: pre-prompt → system dialog → blocked dialog
    await ensureLocationPermission();
    // Refresh status from the system regardless of what happened in the flow
    try {
      const { status: s } = await Location.getForegroundPermissionsAsync();
      setStatus(s);
    } catch {
      setStatus(Location.PermissionStatus.DENIED);
    }
  }, []);

  return { status, requestPermission };
}
