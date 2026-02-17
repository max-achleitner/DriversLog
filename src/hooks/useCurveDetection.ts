import { useCallback, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { CurveHighlight, GeoPoint } from '../types/supabase';
import { normalizeHeadingDelta } from '../utils/geo';

type Phase = 'idle' | 'tracking';

interface HeadingEntry {
  heading: number;
  speedKmh: number;
  timestamp: number;
  coord: GeoPoint;
}

interface UseCurveDetectionOptions {
  isActive: boolean;
}

interface UseCurveDetectionReturn {
  isInCurve: boolean;
  currentAngle: number;
  completedCurves: CurveHighlight[];
  latestCurve: CurveHighlight | null;
  onLocationUpdate: (location: Location.LocationObject) => void;
  dismissLatest: () => void;
  resetCurves: () => void;
}

const BUFFER_WINDOW_MS = 2000;
const ENTRY_HEADING_THRESHOLD = 10;
const ENTRY_SPEED_THRESHOLD = 30;
const STABLE_HEADING_THRESHOLD = 5;
const STABLE_DURATION_MS = 2000;
const EXIT_SPEED_THRESHOLD = 20;
const MIN_CURVE_ANGLE = 45;
const MAX_CURVE_SAMPLES = 200;

export function useCurveDetection({
  isActive,
}: UseCurveDetectionOptions): UseCurveDetectionReturn {
  const [completedCurves, setCompletedCurves] = useState<CurveHighlight[]>([]);
  const [latestCurve, setLatestCurve] = useState<CurveHighlight | null>(null);
  const [isInCurve, setIsInCurve] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);

  const phaseRef = useRef<Phase>('idle');
  const headingBufferRef = useRef<HeadingEntry[]>([]);
  const curveStartTimeRef = useRef(0);
  const curvePathRef = useRef<GeoPoint[]>([]);
  const totalAngleRef = useRef(0);
  const speedSamplesRef = useRef<number[]>([]);
  const entrySpeedRef = useRef(0);
  const stableStartTimeRef = useRef<number | null>(null);
  const prevHeadingRef = useRef<number | null>(null);

  const onLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      if (!isActive) return;

      const speedKmh = (location.coords.speed ?? 0) * 3.6;
      const heading = location.coords.heading ?? -1;
      if (heading < 0) return;

      const now = Date.now();
      const coord: GeoPoint = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      // Update heading buffer
      const buffer = headingBufferRef.current;
      buffer.push({ heading, speedKmh, timestamp: now, coord });
      // Remove entries older than window
      while (buffer.length > 0 && now - buffer[0].timestamp > BUFFER_WINDOW_MS) {
        buffer.shift();
      }

      if (phaseRef.current === 'idle') {
        // Calculate heading delta over the buffer window
        if (buffer.length >= 2) {
          const oldest = buffer[0];
          const newest = buffer[buffer.length - 1];
          const delta = normalizeHeadingDelta(oldest.heading, newest.heading);

          if (Math.abs(delta) > ENTRY_HEADING_THRESHOLD && speedKmh > ENTRY_SPEED_THRESHOLD) {
            // Transition to TRACKING
            phaseRef.current = 'tracking';
            headingBufferRef.current = [{ heading, speedKmh, timestamp: now, coord }];
            curveStartTimeRef.current = now;
            entrySpeedRef.current = speedKmh;
            curvePathRef.current = [coord];
            totalAngleRef.current = Math.abs(delta);
            speedSamplesRef.current = [speedKmh];
            stableStartTimeRef.current = null;
            prevHeadingRef.current = heading;
            setIsInCurve(true);
            setCurrentAngle(Math.abs(delta));
          }
        }
      } else {
        // TRACKING phase
        const stepDelta = prevHeadingRef.current !== null
          ? Math.abs(normalizeHeadingDelta(prevHeadingRef.current, heading))
          : 0;
        totalAngleRef.current += stepDelta;
        setCurrentAngle(Math.round(totalAngleRef.current));

        prevHeadingRef.current = heading;
        curvePathRef.current.push(coord);
        speedSamplesRef.current.push(speedKmh);

        // Check stability (use same stepDelta)

        if (stepDelta < STABLE_HEADING_THRESHOLD) {
          if (stableStartTimeRef.current === null) {
            stableStartTimeRef.current = now;
          }
        } else {
          stableStartTimeRef.current = null;
        }

        const stableExceeded =
          stableStartTimeRef.current !== null &&
          now - stableStartTimeRef.current > STABLE_DURATION_MS;

        if (stableExceeded || speedKmh < EXIT_SPEED_THRESHOLD || curvePathRef.current.length > MAX_CURVE_SAMPLES) {
          // End curve — validate
          const totalAngle = totalAngleRef.current;
          const path = [...curvePathRef.current];
          const speeds = [...speedSamplesRef.current];

          if (totalAngle > MIN_CURVE_ANGLE && path.length >= 2) {
            const avgSpeed =
              speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
            const highlight: CurveHighlight = {
              startCoord: path[0],
              endCoord: path[path.length - 1],
              curvePath: path,
              curveAngle: Math.round(totalAngle),
              avgSpeedKmh: Math.round(avgSpeed),
              entrySpeedKmh: Math.round(entrySpeedRef.current),
              exitSpeedKmh: Math.round(speedKmh),
              timestamp: now,
            };
            setCompletedCurves((prev) => [...prev, highlight]);
            setLatestCurve(highlight);
          }

          // Reset to idle
          phaseRef.current = 'idle';
          headingBufferRef.current = [];
          totalAngleRef.current = 0;
          curvePathRef.current = [];
          speedSamplesRef.current = [];
          stableStartTimeRef.current = null;
          prevHeadingRef.current = null;
          setIsInCurve(false);
          setCurrentAngle(0);
        }
      }
    },
    [isActive],
  );

  const dismissLatest = useCallback(() => {
    setLatestCurve(null);
  }, []);

  const resetCurves = useCallback(() => {
    setCompletedCurves([]);
    setLatestCurve(null);
    setIsInCurve(false);
    setCurrentAngle(0);
    phaseRef.current = 'idle';
    headingBufferRef.current = [];
    totalAngleRef.current = 0;
    curvePathRef.current = [];
    speedSamplesRef.current = [];
    stableStartTimeRef.current = null;
    prevHeadingRef.current = null;
  }, []);

  return {
    isInCurve,
    currentAngle,
    completedCurves,
    latestCurve,
    onLocationUpdate,
    dismissLatest,
    resetCurves,
  };
}
