import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { CurveHighlight, GeoPoint, RouteInsert, WaypointInsert, WaypointType } from '../types/supabase';
import { haversineKm } from '../utils/geo';
import { processRouteData } from '../utils/processRouteData';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'finished';

interface RecordingWaypoint {
  lat: number;
  lng: number;
  timestamp: number;
  type?: WaypointType;
  note?: string;
}

interface UseRouteRecordingOptions {
  onLocationUpdate?: (location: Location.LocationObject) => void;
}

interface RecordingState {
  status: RecordingStatus;
  points: GeoPoint[];
  waypoints: RecordingWaypoint[];
  startTime: number | null;
  elapsedSeconds: number;
  distanceKm: number;
  currentAltitude: number | null;
  currentLocation: GeoPoint | null;
}

interface UseRouteRecordingReturn extends RecordingState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => Promise<void>;
  addWaypoint: (coords?: GeoPoint, type?: WaypointType, note?: string) => void;
  saveRoute: (title: string, carId: string | null, description: string | null, highlights?: CurveHighlight[]) => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: RecordingState = {
  status: 'idle',
  points: [],
  waypoints: [],
  startTime: null,
  elapsedSeconds: 0,
  distanceKm: 0,
  currentAltitude: null,
  currentLocation: null,
};

export function useRouteRecording(
  options?: UseRouteRecordingOptions,
): UseRouteRecordingReturn {
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  const pointsRef = useRef<GeoPoint[]>([]);
  // Accumulated elapsed seconds before the current recording segment (used for pause/resume)
  const pausedElapsedRef = useRef(0);
  const onLocationUpdateRef = useRef(options?.onLocationUpdate);
  onLocationUpdateRef.current = options?.onLocationUpdate;

  const clearSubscriptions = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearSubscriptions;
  }, [clearSubscriptions]);

  const startLocationWatch = useCallback(async () => {
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        timeInterval: 3000,
      },
      (location) => {
        onLocationUpdateRef.current?.(location);

        const newPoint: GeoPoint = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };

        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        if (lastPoint) {
          distanceRef.current += haversineKm(lastPoint, newPoint);
        }
        pointsRef.current.push(newPoint);

        setState((prev) => {
          if (prev.status !== 'recording') return prev;
          return {
            ...prev,
            points: [...pointsRef.current],
            distanceKm: distanceRef.current,
            currentAltitude: location.coords.altitude,
            currentLocation: newPoint,
          };
        });
      },
    );
  }, []);

  const startTimer = useCallback((startTime: number) => {
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'recording' || !prev.startTime) return prev;
        return {
          ...prev,
          elapsedSeconds: pausedElapsedRef.current + Math.floor((Date.now() - startTime) / 1000),
        };
      });
    }, 1000);
  }, []);

  const startRecording = useCallback(async () => {
    distanceRef.current = 0;
    pointsRef.current = [];
    pausedElapsedRef.current = 0;

    const startTime = Date.now();

    setState({
      ...INITIAL_STATE,
      status: 'recording',
      startTime,
    });

    startTimer(startTime);
    await startLocationWatch();
  }, [startTimer, startLocationWatch]);

  const pauseRecording = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'recording') return prev;
      pausedElapsedRef.current = prev.elapsedSeconds;
      return { ...prev, status: 'paused' };
    });
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    const resumeTime = Date.now();
    setState((prev) => {
      if (prev.status !== 'paused') return prev;
      return { ...prev, status: 'recording', startTime: resumeTime };
    });
    startTimer(resumeTime);
    await startLocationWatch();
  }, [startTimer, startLocationWatch]);

  const stopRecording = useCallback(() => {
    clearSubscriptions();
    setState((prev) => ({ ...prev, status: 'finished' }));
  }, [clearSubscriptions]);

  const addWaypoint = useCallback(
    (coords?: GeoPoint, type?: WaypointType, note?: string) => {
      setState((prev) => {
        const location = coords ?? prev.currentLocation;
        if (!location) return prev;
        const wp: RecordingWaypoint = {
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now(),
          type,
          note,
        };
        return { ...prev, waypoints: [...prev.waypoints, wp] };
      });
    },
    [],
  );

  const saveRoute = useCallback(
    async (title: string, carId: string | null, description: string | null, highlights?: CurveHighlight[]) => {
      const userId = getCurrentUserId();

      const processed = processRouteData({
        points: state.points,
        waypoints: state.waypoints,
        elapsedSeconds: state.elapsedSeconds,
      });

      const routeInsert: RouteInsert = {
        user_id: userId,
        car_id: carId,
        title,
        description,
        distance_km: processed.distanceKm,
        duration_seconds: processed.durationSeconds,
        polyline_json: processed.maskedPoints,
        highlights_json: highlights ?? null,
        is_public: false,
      };

      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert(routeInsert)
        .select('id')
        .single();

      if (routeError || !route) {
        throw new Error(routeError?.message ?? 'Route konnte nicht gespeichert werden.');
      }

      if (processed.maskedWaypoints.length > 0) {
        const waypointInserts: WaypointInsert[] = processed.maskedWaypoints.map((wp, i) => ({
          route_id: route.id,
          lat: wp.lat,
          lng: wp.lng,
          sort_order: i,
          type: wp.type ?? null,
          note: wp.note ?? null,
        }));

        const { error: wpError } = await supabase.from('waypoints').insert(waypointInserts);

        if (wpError) {
          throw new Error(wpError.message);
        }
      }
    },
    [state.distanceKm, state.elapsedSeconds, state.points, state.waypoints],
  );

  const reset = useCallback(() => {
    clearSubscriptions();
    distanceRef.current = 0;
    pointsRef.current = [];
    pausedElapsedRef.current = 0;
    setState(INITIAL_STATE);
  }, [clearSubscriptions]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    addWaypoint,
    saveRoute,
    reset,
  };
}
