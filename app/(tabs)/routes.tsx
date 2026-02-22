import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { getCurrentUserId } from '../../src/lib/auth';
import { getLocalRoutes, LocalRoute } from '../../src/lib/offlineStore';
import { useRaceMode } from '../../src/contexts/RaceModeContext';
import { formatDuration, formatDistanceKm } from '../../src/utils/geo';
import { Route } from '../../src/types/supabase';

// ── Merged display type ───────────────────────────────────────────────────────

type SyncedRouteItem = { kind: 'synced'; data: Route };
type LocalRouteItem  = { kind: 'local';  data: LocalRoute };
type DisplayRoute = SyncedRouteItem | LocalRouteItem;

function getCreatedAt(item: DisplayRoute): string {
  return item.kind === 'synced' ? item.data.created_at : item.data.createdAt;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RoutesScreen() {
  const { theme } = useRaceMode();
  const router = useRouter();
  const [displayRoutes, setDisplayRoutes] = useState<DisplayRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        const userId = getCurrentUserId();

        // Fetch DB routes and local-only routes in parallel
        const [{ data: dbRoutes }, localRoutes] = await Promise.all([
          supabase
            .from('routes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .returns<Route[]>(),
          getLocalRoutes(),
        ]);

        if (cancelled) return;

        // Collect IDs already in DB so we don't show duplicates
        const dbIds = new Set((dbRoutes ?? []).map((r) => r.id));

        const synced: SyncedRouteItem[] = (dbRoutes ?? []).map((r) => ({
          kind: 'synced',
          data: r,
        }));

        // Only include local routes NOT yet in the DB
        const local: LocalRouteItem[] = localRoutes
          .filter((lr) => !dbIds.has(lr.id))
          .map((lr) => ({ kind: 'local', data: lr }));

        // Merge and sort newest first
        const merged: DisplayRoute[] = [...synced, ...local].sort(
          (a, b) =>
            new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime(),
        );

        setDisplayRoutes(merged);
        setLoading(false);
      }

      load();
      return () => { cancelled = true; };
    }, []),
  );

  if (loading) {
    return (
      <View style={{ backgroundColor: theme.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (displayRoutes.length === 0) {
    return (
      <View style={{ backgroundColor: theme.background }} className="flex-1 items-center justify-center px-8">
        <Ionicons name="map-outline" size={64} color={theme.textMuted} />
        <Text style={{ color: theme.textDefault }} className="mt-4 text-xl font-bold">
          Noch keine Touren
        </Text>
        <Text style={{ color: theme.textSecondary }} className="mt-2 text-center">
          Starte deine erste Tour im Aufnahme-Tab und sie erscheint hier.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: theme.background }} className="flex-1">
      <FlatList
        data={displayRoutes}
        keyExtractor={(item) =>
          item.kind === 'synced' ? item.data.id : `local_${item.data.id}`
        }
        contentContainerClassName="px-4 pt-4 pb-8"
        renderItem={({ item }) => {
          const isLocal = item.kind === 'local';
          const title =
            item.kind === 'synced' ? item.data.title : item.data.title;
          const description =
            item.kind === 'synced' ? item.data.description : item.data.description;
          const distanceKm =
            item.kind === 'synced' ? item.data.distance_km : item.data.distanceKm;
          const durationSeconds =
            item.kind === 'synced' ? item.data.duration_seconds : item.data.durationSeconds;
          const createdAt = getCreatedAt(item);
          const routeId = item.data.id;

          return (
            <Pressable
              onPress={() => router.push(`/route/${routeId}`)}
              style={{ backgroundColor: theme.backgroundCard }}
              className="mb-3 rounded-2xl px-5 py-4 active:opacity-80"
            >
              {/* Unsynced badge */}
              {isLocal && (
                <View
                  style={{ backgroundColor: '#B45309' + '20', borderColor: '#B45309' + '60' }}
                  className="mb-2 flex-row items-center self-start rounded-full border px-2 py-0.5"
                >
                  <Ionicons name="cloud-upload-outline" size={11} color="#B45309" />
                  <Text style={{ color: '#B45309' }} className="ml-1 text-xs font-semibold">
                    Noch nicht synchronisiert
                  </Text>
                </View>
              )}

              <Text style={{ color: theme.textDefault }} className="text-lg font-bold">
                {title}
              </Text>

              {description && (
                <Text
                  style={{ color: theme.textSecondary }}
                  className="mt-1 text-sm"
                  numberOfLines={2}
                >
                  {description}
                </Text>
              )}

              <View className="mt-3 flex-row gap-5">
                {distanceKm != null && (
                  <View className="flex-row items-center">
                    <Ionicons name="speedometer-outline" size={14} color={theme.textMuted} />
                    <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                      {formatDistanceKm(distanceKm)}
                    </Text>
                  </View>
                )}

                {durationSeconds != null && (
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={14} color={theme.textMuted} />
                    <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                      {formatDuration(durationSeconds)}
                    </Text>
                  </View>
                )}

                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                  <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                    {new Date(createdAt).toLocaleDateString('de-DE')}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
