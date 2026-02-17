import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { getCurrentUserId } from '../../src/lib/auth';
import { useRaceMode } from '../../src/contexts/RaceModeContext';
import { formatDuration, formatDistanceKm } from '../../src/utils/geo';
import { Route } from '../../src/types/supabase';

export default function RoutesScreen() {
  const { theme } = useRaceMode();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        const userId = getCurrentUserId();
        const { data, error } = await supabase
          .from('routes')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .returns<Route[]>();

        if (!cancelled) {
          setRoutes(data ?? []);
          setLoading(false);
        }
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

  if (routes.length === 0) {
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
        data={routes}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pt-4 pb-8"
        renderItem={({ item }) => (
          <View
            style={{ backgroundColor: theme.backgroundCard }}
            className="mb-3 rounded-2xl px-5 py-4"
          >
            <Text style={{ color: theme.textDefault }} className="text-lg font-bold">
              {item.title}
            </Text>

            {item.description && (
              <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm" numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View className="mt-3 flex-row gap-5">
              {item.distance_km != null && (
                <View className="flex-row items-center">
                  <Ionicons name="speedometer-outline" size={14} color={theme.textMuted} />
                  <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                    {formatDistanceKm(item.distance_km)}
                  </Text>
                </View>
              )}

              {item.duration_seconds != null && (
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={14} color={theme.textMuted} />
                  <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                    {formatDuration(item.duration_seconds)}
                  </Text>
                </View>
              )}

              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                <Text style={{ color: theme.textSecondary }} className="ml-1.5 text-sm">
                  {new Date(item.created_at).toLocaleDateString('de-DE')}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
