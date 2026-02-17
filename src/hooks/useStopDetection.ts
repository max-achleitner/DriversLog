import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { GeoPoint } from '../types/supabase';

interface UseStopDetectionOptions {
  isActive: boolean;
}

interface UseStopDetectionReturn {
  isStopped: boolean;
  stopDuration: number;
  stopDetectedLocation: GeoPoint | null;
  onLocationUpdate: (location: Location.LocationObject) => void;
  dismissStop: () => void;
}

const STOP_SPEED_THRESHOLD_KMH = 3;
const RESET_SPEED_THRESHOLD_KMH = 10;
const STOP_DURATION_THRESHOLD_S = 120;

export function useStopDetection({
  isActive,
}: UseStopDetectionOptions): UseStopDetectionReturn {
  const [isStopped, setIsStopped] = useState(false);
  const [stopDuration, setStopDuration] = useState(0);
  const [stopDetectedLocation, setStopDetectedLocation] =
    useState<GeoPoint | null>(null);

  const stopStartTimeRef = useRef<number | null>(null);
  const alreadyTriggeredRef = useRef(false);
  const lastLocationRef = useRef<GeoPoint | null>(null);

  const dismissStop = useCallback(() => {
    setStopDetectedLocation(null);
    // Keep alreadyTriggered true so we don't re-trigger until speed resets
  }, []);

  const resetTimer = useCallback(() => {
    stopStartTimeRef.current = null;
    alreadyTriggeredRef.current = false;
    setIsStopped(false);
    setStopDuration(0);
    setStopDetectedLocation(null);
  }, []);

  const onLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      if (!isActive) return;

      const speedMs = location.coords.speed ?? 0;
      const speedKmh = Math.max(0, speedMs) * 3.6;

      const currentPoint: GeoPoint = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      lastLocationRef.current = currentPoint;

      // Moving fast enough → reset everything
      if (speedKmh > RESET_SPEED_THRESHOLD_KMH) {
        if (stopStartTimeRef.current !== null || alreadyTriggeredRef.current) {
          resetTimer();
        }
        return;
      }

      // Standing still (< 3 km/h)
      if (speedKmh < STOP_SPEED_THRESHOLD_KMH) {
        if (!stopStartTimeRef.current) {
          stopStartTimeRef.current = Date.now();
        }

        const elapsed = Math.floor(
          (Date.now() - stopStartTimeRef.current) / 1000,
        );
        setIsStopped(true);
        setStopDuration(elapsed);

        // Threshold reached and not yet triggered
        if (elapsed >= STOP_DURATION_THRESHOLD_S && !alreadyTriggeredRef.current) {
          alreadyTriggeredRef.current = true;

          // Haptic feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

          // Check if app is in foreground or background
          if (AppState.currentState === 'active') {
            setStopDetectedLocation(currentPoint);
          } else {
            // Send local push notification
            Notifications.scheduleNotificationAsync({
              content: {
                title: 'Pause erkannt',
                body: 'Du stehst seit 2 Minuten — Ort als Stop markieren?',
                data: {
                  type: 'stop_detected',
                  lat: currentPoint.lat,
                  lng: currentPoint.lng,
                },
              },
              trigger: null, // immediate
            });
            // Also set location so banner shows when user returns
            setStopDetectedLocation(currentPoint);
          }
        }
      }
    },
    [isActive, resetTimer],
  );

  return {
    isStopped,
    stopDuration,
    stopDetectedLocation,
    onLocationUpdate,
    dismissStop,
  };
}
