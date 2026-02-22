import '../global.css';

// Geofencing-Task MUSS im Global Scope importiert werden, damit
// TaskManager.defineTask() beim JS-Bundle-Load ausgefuehrt wird —
// noch bevor React-Komponenten mounten. Ohne diesen Import werden
// Hintergrund-Events vom OS ignoriert.
import '../src/services/geofencing';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useBackgroundLocation } from '../src/hooks/useBackgroundLocation';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import { RaceModeProvider, useRaceMode } from '../src/contexts/RaceModeContext';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ToastProvider, useToast } from '../src/contexts/ToastContext';
import { SyncProvider, useSync } from '../src/contexts/SyncContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import {
  getDraftRecording,
  clearDraftRecording,
  addToQueue,
  addLocalRoute,
  generateId,
} from '../src/lib/offlineStore';
import { getCurrentUserId } from '../src/lib/auth';

/**
 * Innerstes Layout: hat Zugriff auf Auth, RaceMode, Sync und Router.
 * Uebernimmt die Auth-Guard-Logik und baut den Stack auf.
 */
function InnerLayout() {
  const { session, loading } = useAuth();
  const { theme } = useRaceMode();
  const segments = useSegments();
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshPendingCount } = useSync();

  useBackgroundLocation();

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // ── Draft recording recovery ──────────────────────────────────────────────

  useEffect(() => {
    if (loading || !session) return;

    async function checkDraft() {
      const draft = await getDraftRecording();
      if (!draft) return;

      const distKm = draft.distanceKm.toFixed(1);
      const savedDate = new Date(draft.savedAt).toLocaleDateString('de-DE');

      Alert.alert(
        'Nicht gespeicherte Aufzeichnung',
        `Es wurde eine unterbrochene Aufzeichnung gefunden (${distKm} km, ${savedDate}). Möchtest du sie speichern?`,
        [
          {
            text: 'Verwerfen',
            style: 'destructive',
            onPress: async () => {
              await clearDraftRecording();
            },
          },
          {
            text: 'Tour speichern',
            onPress: async () => {
              const userId = getCurrentUserId();
              const routeId = generateId();
              const title = `Unterbrochene Tour (${savedDate})`;

              await addToQueue({
                type: 'save_route',
                payload: {
                  routeId,
                  userId,
                  route: {
                    id: routeId,
                    user_id: userId,
                    title,
                    description: null,
                    car_id: null,
                    distance_km: draft.distanceKm,
                    duration_seconds: draft.elapsedSeconds,
                    polyline_json: draft.points,
                    highlights_json: null,
                    is_public: false,
                  },
                  waypoints: draft.waypoints.map((wp) => ({
                    id: wp.id,
                    data: {
                      route_id: routeId,
                      lat: wp.lat,
                      lng: wp.lng,
                      type: wp.type ?? null,
                      note: wp.note ?? null,
                    },
                    localImageUri: wp.localImageUri,
                  })),
                },
              });

              await addLocalRoute({
                id: routeId,
                title,
                description: null,
                distanceKm: draft.distanceKm,
                durationSeconds: draft.elapsedSeconds,
                polylineJson: draft.points,
                createdAt: new Date().toISOString(),
                carId: null,
              });

              await clearDraftRecording();
              await refreshPendingCount();
              showToast({
                type: 'success',
                message: 'Tour in Warteschlange gespeichert. Wird synchronisiert.',
              });
            },
          },
        ],
        { cancelable: false },
      );
    }

    // Small delay so the app finishes loading before the alert appears
    const timer = setTimeout(() => {
      void checkDraft();
    }, 2000);

    return () => clearTimeout(timer);
  }, [session, loading, showToast, refreshPendingCount]);

  // ── Splash / loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#F5F2ED',
        }}
      >
        <ActivityIndicator size="large" color="#1B3A4B" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.primary },
          headerTintColor: theme.textLight,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings/index"
          options={{
            title: 'Einstellungen',
            headerBackTitle: 'Zurueck',
          }}
        />
        <Stack.Screen
          name="route/[id]"
          options={{
            title: 'Tour-Details',
            headerBackTitle: 'Zurueck',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <RaceModeProvider>
            <ToastProvider>
              <SyncProvider>
                <InnerLayout />
              </SyncProvider>
            </ToastProvider>
          </RaceModeProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
