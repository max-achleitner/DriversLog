import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { getCurrentUserId } from '../../src/lib/auth';
import { getPublicImageUrl, deleteAllWaypointImages } from '../../src/lib/media';
import { getLocalRoutes } from '../../src/lib/offlineStore';
import { useRaceMode } from '../../src/contexts/RaceModeContext';
import { useToast } from '../../src/contexts/ToastContext';
import { formatDuration, formatDistanceKm } from '../../src/utils/geo';
import { Route, Waypoint, WaypointType } from '../../src/types/supabase';

// ── Waypoint type metadata ────────────────────────────────────────────────────

const WAYPOINT_ICONS: Record<WaypointType, keyof typeof Ionicons.glyphMap> = {
  PHOTO_SPOT: 'camera-outline',
  FOOD: 'restaurant-outline',
  PARKING_SAFE: 'car-outline',
  FUEL_HIGH_OCTANE: 'speedometer-outline',
  SOUND_TUNNEL: 'volume-high-outline',
  DRIVING_HIGHLIGHT: 'star-outline',
};

const WAYPOINT_LABELS: Record<WaypointType, string> = {
  PHOTO_SPOT: 'Fotopunkt',
  FOOD: 'Essen',
  PARKING_SAFE: 'Parkplatz',
  FUEL_HIGH_OCTANE: 'Tankstelle',
  SOUND_TUNNEL: 'Sound-Tunnel',
  DRIVING_HIGHLIGHT: 'Highlight',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useRaceMode();
  const { showToast } = useToast();

  const [route, setRoute] = useState<Route | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);

  // Full-screen image viewer state
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Waypoint deletion guard (prevents double-tap)
  const [deletingWaypointId, setDeletingWaypointId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        const userId = getCurrentUserId();

        const [routeRes, wpRes] = await Promise.all([
          supabase
            .from('routes')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single<Route>(),
          supabase
            .from('waypoints')
            .select('*')
            .eq('route_id', id)
            .order('sort_order', { ascending: true })
            .returns<Waypoint[]>(),
        ]);

        if (cancelled) return;

        if (routeRes.data) {
          setRoute(routeRes.data);
          setWaypoints(wpRes.data ?? []);
          setIsLocal(false);
        } else {
          // Fallback: look up in the local offline store
          const localRoutes = await getLocalRoutes();
          const local = localRoutes.find((r) => r.id === id);
          if (local && !cancelled) {
            // Map LocalRoute to the Route shape used by the UI
            setRoute({
              id: local.id,
              user_id: userId,
              car_id: local.carId ?? null,
              title: local.title,
              description: local.description ?? null,
              distance_km: local.distanceKm ?? null,
              duration_seconds: local.durationSeconds ?? null,
              polyline_json: local.polylineJson ?? null,
              highlights_json: null,
              is_public: false,
              created_at: local.createdAt,
            } as Route);
            setWaypoints([]);  // local routes don't persist waypoints in the store
            setIsLocal(true);
          } else {
            setRoute(null);
            setIsLocal(false);
          }
        }

        setLoading(false);
      }

      load();
      return () => { cancelled = true; };
    }, [id]),
  );

  const handleDeleteWaypoint = async (wp: Waypoint) => {
    if (deletingWaypointId) return;  // prevent double-tap
    setDeletingWaypointId(wp.id);

    try {
      // Image deletion is best-effort — don't block waypoint removal if it fails
      if (wp.image_urls && wp.image_urls.length > 0) {
        try {
          const userId = getCurrentUserId();
          await deleteAllWaypointImages(userId, wp.id);
        } catch {
          // Non-fatal: orphaned images are acceptable
        }
      }

      const { error } = await supabase.from('waypoints').delete().eq('id', wp.id);
      if (error) {
        showToast({ type: 'error', message: 'Wegpunkt konnte nicht gelöscht werden.' });
        return;
      }

      setWaypoints((prev) => prev.filter((w) => w.id !== wp.id));
      showToast({ type: 'success', message: 'Wegpunkt gelöscht.' });
    } finally {
      setDeletingWaypointId(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textDefault, fontSize: 18, fontWeight: '700', marginTop: 16 }}>
          Tour nicht gefunden
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 20, backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: theme.textLight, fontWeight: '700' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.textMuted + '20',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 4, marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textDefault} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.primary }} numberOfLines={1}>
            {route.title}
          </Text>
          {isLocal && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Ionicons name="cloud-upload-outline" size={12} color="#B45309" />
              <Text style={{ color: '#B45309', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                Noch nicht synchronisiert
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* ── Route summary ──────────────────────────────────── */}
        <View
          style={{
            backgroundColor: theme.backgroundCard,
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {route.distance_km != null && (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="speedometer-outline" size={20} color={theme.accent} />
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Strecke</Text>
                <Text style={{ color: theme.textDefault, fontSize: 16, fontWeight: '700' }}>
                  {formatDistanceKm(route.distance_km)}
                </Text>
              </View>
            )}
            {route.duration_seconds != null && (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="time-outline" size={20} color={theme.accent} />
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Dauer</Text>
                <Text style={{ color: route.duration_seconds != null ? theme.textDefault : theme.textMuted, fontSize: 16, fontWeight: '700' }}>
                  {formatDuration(route.duration_seconds)}
                </Text>
              </View>
            )}
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={20} color={theme.accent} />
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>Datum</Text>
              <Text style={{ color: theme.textDefault, fontSize: 16, fontWeight: '700' }}>
                {new Date(route.created_at).toLocaleDateString('de-DE')}
              </Text>
            </View>
          </View>

          {route.description != null && (
            <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 12 }}>
              {route.description}
            </Text>
          )}
        </View>

        {/* ── Waypoints ──────────────────────────────────────── */}
        <Text style={{ color: theme.textDefault, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
          Wegpunkte ({waypoints.length})
        </Text>

        {waypoints.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.backgroundCard,
              borderRadius: 14,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <Ionicons name="location-outline" size={36} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, fontSize: 14, marginTop: 8 }}>
              {isLocal
                ? 'Wegpunkte werden nach der Synchronisierung angezeigt.'
                : 'Keine Wegpunkte vorhanden'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={waypoints}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item: wp }) => {
              const firstImagePath =
                wp.image_urls && wp.image_urls.length > 0 ? wp.image_urls[0] : null;
              const imageCount = wp.image_urls?.length ?? 0;

              return (
                <View
                  style={{
                    backgroundColor: theme.backgroundCard,
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {/* Image thumbnail */}
                  {firstImagePath && (
                    <Pressable
                      onPress={() => setViewerUri(getPublicImageUrl(firstImagePath))}
                    >
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: getPublicImageUrl(firstImagePath) }}
                          style={{ width: '100%', aspectRatio: 16 / 9 }}
                          resizeMode="cover"
                        />
                        {/* Image count badge */}
                        {imageCount > 1 && (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              borderRadius: 10,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Ionicons name="images-outline" size={12} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                              {imageCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  )}

                  {/* Info row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                    {wp.type && (
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: theme.accent + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons
                          name={WAYPOINT_ICONS[wp.type]}
                          size={20}
                          color={theme.accent}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textDefault, fontSize: 14, fontWeight: '600' }}>
                        {wp.type ? WAYPOINT_LABELS[wp.type] : 'Wegpunkt'}
                      </Text>
                      {wp.note && (
                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                          {wp.note}
                        </Text>
                      )}
                    </View>

                    {/* Delete button */}
                    <Pressable
                      onPress={() => handleDeleteWaypoint(wp)}
                      disabled={deletingWaypointId === wp.id}
                      style={{ padding: 8, opacity: deletingWaypointId === wp.id ? 0.4 : 1 }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}
      </ScrollView>

      {/* ── Full-screen image viewer ────────────────────────── */}
      <Modal
        visible={viewerUri !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {/* Close button */}
          <Pressable
            onPress={() => setViewerUri(null)}
            style={{
              position: 'absolute',
              top: 48,
              right: 20,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
