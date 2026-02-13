import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { haversineKm } from '../utils/geo';
import { Route, GeoPoint } from '../types/supabase';

const NEARBY_RADIUS_KM = 0.5;

interface GhostRoute {
  id: string;
  title: string;
  distanceKm: number | null;
  durationSeconds: number | null;
  polyline: GeoPoint[];
  createdAt: string;
}

interface UseGhostSelectionReturn {
  nearbyRoutes: GhostRoute[];
  loading: boolean;
  selectedGhost: GhostRoute | null;
  selectGhost: (route: GhostRoute | null) => void;
  loadNearbyRoutes: (currentLocation: GeoPoint) => Promise<void>;
}

export function useGhostSelection(): UseGhostSelectionReturn {
  const [nearbyRoutes, setNearbyRoutes] = useState<GhostRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGhost, setSelectedGhost] = useState<GhostRoute | null>(null);

  const loadNearbyRoutes = useCallback(async (currentLocation: GeoPoint) => {
    setLoading(true);
    try {
      const userId = getCurrentUserId();
      const { data, error } = await supabase
        .from('routes')
        .select('id, title, distance_km, duration_seconds, polyline_json, created_at')
        .eq('user_id', userId)
        .not('polyline_json', 'is', null)
        .order('created_at', { ascending: false });

      if (error || !data) {
        setNearbyRoutes([]);
        return;
      }

      const nearby = (data as Route[])
        .filter((route) => {
          const polyline = route.polyline_json;
          if (!polyline || polyline.length === 0) return false;
          const startPoint = polyline[0];
          const distKm = haversineKm(currentLocation, startPoint);
          return distKm <= NEARBY_RADIUS_KM;
        })
        .map((route): GhostRoute => ({
          id: route.id,
          title: route.title,
          distanceKm: route.distance_km,
          durationSeconds: route.duration_seconds,
          polyline: route.polyline_json ?? [],
          createdAt: route.created_at,
        }));

      setNearbyRoutes(nearby);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectGhost = useCallback((route: GhostRoute | null) => {
    setSelectedGhost(route);
  }, []);

  return {
    nearbyRoutes,
    loading,
    selectedGhost,
    selectGhost,
    loadNearbyRoutes,
  };
}
