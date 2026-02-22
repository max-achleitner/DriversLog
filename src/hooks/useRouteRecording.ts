import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  CurveHighlight,
  GeoPoint,
  RouteInsert,
  WaypointInsert,
  WaypointType,
} from '../types/supabase';
import { haversineKm } from '../utils/geo';
import { processRouteData } from '../utils/processRouteData';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { uploadWaypointImage } from '../lib/media';
import { isOnline } from '../lib/network';
import {
  generateId,
  addToQueue,
  addLocalRoute,
  removeLocalRoute,
  saveDraftRecording,
  clearDraftRecording,
  SaveRoutePayload,
  OfflineWaypoint,
} from '../lib/offlineStore';

type RecordingStatus = 'idle' | 'recording' | 'finished';

interface RecordingWaypoint {
  id: string;             // pre-generated UUID for DB + storage path
  lat: number;
  lng: number;
  timestamp: number;
  type?: WaypointType;
  note?: string;
  localImageUri?: string;
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

export interface SaveRouteResult {
  /** True if at least one image failed to upload (online saves only). */
  imageUploadFailed: boolean;
  /** True if the route was added to the offline queue instead of synced directly. */
  queued: boolean;
}

interface UseRouteRecordingReturn extends RecordingState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  addWaypoint: (coords?: GeoPoint, type?: WaypointType, note?: string, localImageUri?: string) => void;
  saveRoute: (
    title: string,
    carId: string | null,
    description: string | null,
    highlights?: CurveHighlight[],
  ) => Promise<SaveRouteResult>;
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

// Draft is saved every DRAFT_INTERVAL_SECONDS during recording
const DRAFT_INTERVAL_SECONDS = 30;

export function useRouteRecording(
  options?: UseRouteRecordingOptions,
): UseRouteRecordingReturn {
  const [state, setState] = useState<RecordingState>(INITIAL_STATE);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  const pointsRef = useRef<GeoPoint[]>([]);
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

  // ── Draft save (app kill protection) ──────────────────────────────────────
  // Every DRAFT_INTERVAL_SECONDS, persist current recording state.

  useEffect(() => {
    if (state.status !== 'recording') return;
    if (state.elapsedSeconds === 0) return;
    if (state.elapsedSeconds % DRAFT_INTERVAL_SECONDS !== 0) return;

    void saveDraftRecording({
      points: pointsRef.current,
      waypoints: state.waypoints,
      startTime: state.startTime ?? Date.now(),
      elapsedSeconds: state.elapsedSeconds,
      distanceKm: distanceRef.current,
      savedAt: new Date().toISOString(),
    });
  }, [state.elapsedSeconds, state.status, state.waypoints, state.startTime]);

  // ── Recording controls ─────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    distanceRef.current = 0;
    pointsRef.current = [];

    const startTime = Date.now();

    setState({
      ...INITIAL_STATE,
      status: 'recording',
      startTime,
    });

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'recording' || !prev.startTime) return prev;
        return {
          ...prev,
          elapsedSeconds: Math.floor((Date.now() - prev.startTime) / 1000),
        };
      });
    }, 1000);

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

  const stopRecording = useCallback(() => {
    clearSubscriptions();
    setState((prev) => ({ ...prev, status: 'finished' }));
  }, [clearSubscriptions]);

  const addWaypoint = useCallback(
    (
      coords?: GeoPoint,
      type?: WaypointType,
      note?: string,
      localImageUri?: string,
    ) => {
      const id = generateId();
      setState((prev) => {
        const location = coords ?? prev.currentLocation;
        if (!location) return prev;
        const wp: RecordingWaypoint = {
          id,
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now(),
          type,
          note,
          localImageUri,
        };
        return { ...prev, waypoints: [...prev.waypoints, wp] };
      });
    },
    [],
  );

  // ── Offline-first save ─────────────────────────────────────────────────────

  const saveRoute = useCallback(
    async (
      title: string,
      carId: string | null,
      description: string | null,
      highlights?: CurveHighlight[],
    ): Promise<SaveRouteResult> => {
      const userId = getCurrentUserId();
      const routeId = generateId(); // pre-generate — used as DB primary key

      const processed = processRouteData({
        points: state.points,
        waypoints: state.waypoints,
        elapsedSeconds: state.elapsedSeconds,
      });

      // Build typed route insert with the pre-generated ID
      const routeInsert: RouteInsert & { id: string } = {
        id: routeId,
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

      // Map processed waypoints to offline format (preserving id + localImageUri)
      const offlineWaypoints: OfflineWaypoint[] = processed.maskedWaypoints.map((wp) => ({
        id: wp.id,
        data: {
          route_id: routeId,
          lat: wp.lat,
          lng: wp.lng,
          type: wp.type ?? null,
          note: wp.note ?? null,
        } satisfies WaypointInsert,
        localImageUri: wp.localImageUri,
      }));

      const savePayload: SaveRoutePayload = {
        routeId,
        userId,
        route: routeInsert,
        waypoints: offlineWaypoints,
      };

      // Always clear the draft — we've captured the data in savePayload
      await clearDraftRecording();

      // ── Try direct Supabase sync ─────────────────────────────────────────
      const online = await isOnline();

      if (online) {
        try {
          // 1. Route
          const { error: routeError } = await supabase
            .from('routes')
            .insert(routeInsert);

          if (routeError) throw new Error(routeError.message);

          // 2. Waypoints
          let imageUploadFailed = false;

          if (offlineWaypoints.length > 0) {
            const waypointRows = offlineWaypoints.map((wp, i) => ({
              id: wp.id,
              route_id: routeId,
              lat: wp.data.lat,
              lng: wp.data.lng,
              sort_order: i,
              type: wp.data.type ?? null,
              note: wp.data.note ?? null,
            }));

            const { error: wpError } = await supabase
              .from('waypoints')
              .insert(waypointRows);

            if (wpError) throw new Error(wpError.message);

            // 3. Images
            for (const wp of offlineWaypoints) {
              if (!wp.localImageUri) continue;
              try {
                const storagePath = await uploadWaypointImage(
                  userId,
                  wp.id,
                  wp.localImageUri,
                );
                if (storagePath) {
                  await supabase
                    .from('waypoints')
                    .update({ image_urls: [storagePath] })
                    .eq('id', wp.id);
                } else {
                  imageUploadFailed = true;
                }
              } catch {
                imageUploadFailed = true;
              }
            }
          }

          // Direct sync succeeded — no need to store locally
          return { imageUploadFailed, queued: false };
        } catch {
          // Online sync failed — fall through to queue
        }
      }

      // ── Queue for later sync ─────────────────────────────────────────────
      await addLocalRoute({
        id: routeId,
        title,
        description: description ?? null,
        distanceKm: processed.distanceKm,
        durationSeconds: processed.durationSeconds,
        polylineJson: processed.maskedPoints,
        createdAt: new Date().toISOString(),
        carId,
      });

      await addToQueue({ type: 'save_route', payload: savePayload });

      return { imageUploadFailed: false, queued: true };
    },
    [state.distanceKm, state.elapsedSeconds, state.points, state.waypoints],
  );

  const reset = useCallback(() => {
    clearSubscriptions();
    distanceRef.current = 0;
    pointsRef.current = [];
    setState(INITIAL_STATE);
  }, [clearSubscriptions]);

  return {
    ...state,
    startRecording,
    stopRecording,
    addWaypoint,
    saveRoute,
    reset,
  };
}
