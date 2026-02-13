import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

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
    const { status: s } = await Location.requestForegroundPermissionsAsync();
    setStatus(s);
  }, []);

  return { status, requestPermission };
}
