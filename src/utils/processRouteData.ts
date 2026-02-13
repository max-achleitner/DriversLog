import { GeoPoint } from '../types/supabase';
import { haversineKm } from './geo';

const HOME_ZONE_KM = 0.5;

interface RawRecordingData {
  points: GeoPoint[];
  waypoints: { lat: number; lng: number; timestamp: number }[];
  elapsedSeconds: number;
}

interface ProcessedRouteData {
  maskedPoints: GeoPoint[];
  maskedWaypoints: { lat: number; lng: number; timestamp: number }[];
  distanceKm: number;
  durationSeconds: number;
}

/**
 * Walks along a polyline from one end, accumulating haversine distance.
 * Returns the index of the first point that exceeds `thresholdKm`.
 * If no point exceeds the threshold, returns the last index.
 */
function findCutIndex(points: GeoPoint[], thresholdKm: number): number {
  let accumulated = 0;
  for (let i = 1; i < points.length; i++) {
    accumulated += haversineKm(points[i - 1], points[i]);
    if (accumulated >= thresholdKm) {
      return i;
    }
  }
  return points.length - 1;
}

/**
 * Applies Home Zone Masking and recalculates distance/duration.
 *
 * - Trims the first and last 500 m of coordinates to obscure start/end locations.
 * - Filters waypoints that fall outside the masked range.
 * - Recalculates total distance from the masked polyline.
 * - Scales the original duration proportionally to the masked distance.
 *
 * If the route is too short to mask (< 1 km total), returns the data unchanged
 * so short trips aren't reduced to nothing.
 */
export function processRouteData(raw: RawRecordingData): ProcessedRouteData {
  const { points, waypoints, elapsedSeconds } = raw;

  if (points.length < 2) {
    return {
      maskedPoints: [...points],
      maskedWaypoints: [...waypoints],
      distanceKm: 0,
      durationSeconds: elapsedSeconds,
    };
  }

  // Total raw distance to decide if masking is viable
  let rawDistanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    rawDistanceKm += haversineKm(points[i - 1], points[i]);
  }

  // Skip masking if route is too short — trimming both ends would gut it
  if (rawDistanceKm < HOME_ZONE_KM * 2) {
    return {
      maskedPoints: [...points],
      maskedWaypoints: [...waypoints],
      distanceKm: Math.round(rawDistanceKm * 100) / 100,
      durationSeconds: elapsedSeconds,
    };
  }

  // Find trim indices from start and end
  const startCut = findCutIndex(points, HOME_ZONE_KM);

  const reversed = [...points].reverse();
  const endCutFromBack = findCutIndex(reversed, HOME_ZONE_KM);
  const endCut = points.length - endCutFromBack;

  // Guard: if the two cuts overlap, return minimal result
  if (startCut >= endCut) {
    return {
      maskedPoints: [],
      maskedWaypoints: [],
      distanceKm: 0,
      durationSeconds: 0,
    };
  }

  const maskedPoints = points.slice(startCut, endCut);

  // Recalculate distance on the masked polyline
  let maskedDistanceKm = 0;
  for (let i = 1; i < maskedPoints.length; i++) {
    maskedDistanceKm += haversineKm(maskedPoints[i - 1], maskedPoints[i]);
  }

  // Scale duration proportionally
  const ratio = rawDistanceKm > 0 ? maskedDistanceKm / rawDistanceKm : 0;
  const maskedDuration = Math.round(elapsedSeconds * ratio);

  // Filter waypoints: keep only those inside the masked region
  const startBound = maskedPoints[0];
  const endBound = maskedPoints[maskedPoints.length - 1];

  const maskedWaypoints = waypoints.filter((wp) => {
    const distFromStart = haversineKm(points[0], { lat: wp.lat, lng: wp.lng });
    const distFromEnd = haversineKm(points[points.length - 1], { lat: wp.lat, lng: wp.lng });
    return distFromStart >= HOME_ZONE_KM && distFromEnd >= HOME_ZONE_KM;
  });

  return {
    maskedPoints,
    maskedWaypoints,
    distanceKm: Math.round(maskedDistanceKm * 100) / 100,
    durationSeconds: maskedDuration,
  };
}
