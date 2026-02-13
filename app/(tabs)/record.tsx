import { Pressable, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useRouteRecording } from '../../src/hooks/useRouteRecording';
import { useGhostSelection } from '../../src/hooks/useGhostSelection';
import { useActiveCar } from '../../src/hooks/useActiveCar';
import { RecordingOverlay } from '../../src/features/recorder/RecordingOverlay';
import { RecordingControls } from '../../src/features/recorder/RecordingControls';
import { SaveRouteModal } from '../../src/features/recorder/SaveRouteModal';
import { ActiveCarSelector } from '../../src/features/recorder/ActiveCarSelector';
import { DeltaTimeBar } from '../../src/features/race/DeltaTimeBar';
import { GhostPickerModal } from '../../src/features/race/GhostPickerModal';
import { useRaceMode } from '../../src/contexts/RaceModeContext';
import { DeltaCalculator, RoutePoint } from '../../src/utils/DeltaCalculator';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function RecordScreen() {
  const { status: permStatus, requestPermission } = useLocationPermission();
  const recording = useRouteRecording();
  const { theme, isRaceMode } = useRaceMode();
  const ghost = useGhostSelection();
  const { cars, activeCar, setActiveCar } = useActiveCar();
  const mapRef = useRef<MapView>(null);
  const deltaCalcRef = useRef(new DeltaCalculator());

  const [showGhostPicker, setShowGhostPicker] = useState(false);
  const [currentDelta, setCurrentDelta] = useState<number | null>(null);
  const [hasReference, setHasReference] = useState(false);

  const isRecording = recording.status === 'recording';
  const isFinished = recording.status === 'finished';

  // Recalculate delta whenever position or distance changes during recording
  useEffect(() => {
    if (!isRecording || !isRaceMode || !hasReference) return;

    const result = deltaCalcRef.current.calculateDelta(
      recording.distanceKm,
      recording.elapsedSeconds,
    );
    setCurrentDelta(result?.deltaSeconds ?? null);
  }, [isRecording, isRaceMode, hasReference, recording.distanceKm, recording.elapsedSeconds]);

  // Load nearby ghost routes when ghost picker opens
  const handleOpenGhostPicker = useCallback(async () => {
    try {
      if (recording.currentLocation) {
        await ghost.loadNearbyRoutes(recording.currentLocation);
      } else {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await ghost.loadNearbyRoutes({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
    } catch {
      // Location unavailable — show picker with empty list
    }
    setShowGhostPicker(true);
  }, [recording.currentLocation, ghost]);

  const handleGhostSelect = useCallback(
    (route: { id: string; title: string; distanceKm: number | null; durationSeconds: number | null; createdAt: string }) => {
      // Find the full ghost route with polyline from nearbyRoutes
      const fullRoute = ghost.nearbyRoutes.find((r) => r.id === route.id);
      if (fullRoute) {
        ghost.selectGhost(fullRoute);

        // Build RoutePoints from polyline for the DeltaCalculator
        // We estimate time linearly across the polyline based on total duration
        const polyline = fullRoute.polyline;
        const totalDuration = fullRoute.durationSeconds ?? 0;

        if (polyline.length > 0 && totalDuration > 0) {
          const routePoints: RoutePoint[] = polyline.map((pt, i) => ({
            lat: pt.lat,
            lng: pt.lng,
            timeSeconds: (i / Math.max(polyline.length - 1, 1)) * totalDuration,
          }));
          deltaCalcRef.current.setReferenceRoute(routePoints);
          setHasReference(true);
        }
      }
      setShowGhostPicker(false);
    },
    [ghost],
  );

  const handleGhostSkip = useCallback(() => {
    ghost.selectGhost(null);
    setHasReference(false);
    setCurrentDelta(null);
    setShowGhostPicker(false);
  }, [ghost]);

  // Wrap startRecording: in race mode, show ghost picker first
  const handleStart = useCallback(async () => {
    if (isRaceMode) {
      await handleOpenGhostPicker();
    } else {
      await recording.startRecording();
    }
  }, [isRaceMode, handleOpenGhostPicker, recording]);

  // After ghost picker completes, start recording
  const handleGhostSelectAndStart = useCallback(
    async (route: { id: string; title: string; distanceKm: number | null; durationSeconds: number | null; createdAt: string }) => {
      handleGhostSelect(route);
      await recording.startRecording();
    },
    [handleGhostSelect, recording],
  );

  const handleGhostSkipAndStart = useCallback(async () => {
    handleGhostSkip();
    await recording.startRecording();
  }, [handleGhostSkip, recording]);

  const handleSave = async (title: string, carId: string | null, description: string | null) => {
    await recording.saveRoute(title, carId, description);
    recording.reset();
    // Reset delta state
    setCurrentDelta(null);
    setHasReference(false);
    deltaCalcRef.current = new DeltaCalculator();
  };

  const handleDiscard = () => {
    recording.reset();
    setCurrentDelta(null);
    setHasReference(false);
    deltaCalcRef.current = new DeltaCalculator();
  };

  // Berechtigung noch nicht geladen
  if (permStatus === null) {
    return (
      <View style={{ backgroundColor: theme.background }} className="flex-1 items-center justify-center">
        <Text style={{ color: theme.textSecondary }}>Standort wird geprueft...</Text>
      </View>
    );
  }

  // Keine Berechtigung
  if (permStatus !== Location.PermissionStatus.GRANTED) {
    return (
      <View style={{ backgroundColor: theme.background }} className="flex-1 items-center justify-center px-8">
        <Ionicons name="location-outline" size={64} color={theme.primary} />
        <Text style={{ color: theme.primary }} className="mt-4 text-center text-xl font-bold">
          Standort-Zugriff benoetigt
        </Text>
        <Text style={{ color: theme.textSecondary }} className="mt-2 text-center">
          Um deine Tour aufzuzeichnen, benoetigt DriversLog Zugriff auf deinen Standort.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: theme.accent }}
          className="mt-6 rounded-xl px-8 py-4 active:opacity-80"
        >
          <Text style={{ color: theme.textLight }} className="font-bold">Standort freigeben</Text>
        </Pressable>
      </View>
    );
  }

  const currentRegion = recording.currentLocation
    ? {
        latitude: recording.currentLocation.lat,
        longitude: recording.currentLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 48.7758,
        longitude: 9.1829,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={{ backgroundColor: theme.background }} className="flex-1">
      {/* Delta Time Bar — nur im Race Mode waehrend Aufnahme */}
      {isRaceMode && isRecording && (
        <DeltaTimeBar currentDelta={currentDelta} hasReference={hasReference} />
      )}

      {/* Karte */}
      <View className={isRecording ? 'flex-[3]' : 'flex-1'}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={currentRegion}
          region={isRecording ? currentRegion : undefined}
          showsUserLocation
          showsMyLocationButton={!isRecording}
        >
          {/* Ghost Polyline */}
          {isRaceMode && ghost.selectedGhost && ghost.selectedGhost.polyline.length > 1 && (
            <Polyline
              coordinates={ghost.selectedGhost.polyline.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor="rgba(255, 255, 255, 0.3)"
              strokeWidth={3}
              lineDashPattern={[10, 6]}
            />
          )}

          {/* Aktuelle Polyline */}
          {recording.points.length > 1 && (
            <Polyline
              coordinates={recording.points.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor={theme.polylineColor}
              strokeWidth={4}
            />
          )}

          {/* Waypoint-Marker */}
          {recording.waypoints.map((wp, i) => (
            <Marker
              key={`wp-${i}`}
              coordinate={{ latitude: wp.lat, longitude: wp.lng }}
              pinColor={theme.warm}
            />
          ))}
        </MapView>
      </View>

      {/* Unterer Bereich */}
      <View className="pb-6 pt-3">
        {isRecording && (
          <RecordingOverlay
            elapsedSeconds={recording.elapsedSeconds}
            distanceKm={recording.distanceKm}
            currentAltitude={recording.currentAltitude}
          />
        )}

        {/* Auto-Auswahl im Idle-Zustand */}
        {!isRecording && !isFinished && (
          <ActiveCarSelector cars={cars} activeCar={activeCar} onSelect={setActiveCar} />
        )}

        <RecordingControls
          status={recording.status}
          onStart={handleStart}
          onStop={recording.stopRecording}
          onAddWaypoint={recording.addWaypoint}
        />
      </View>

      {/* Ghost Picker Modal */}
      <GhostPickerModal
        visible={showGhostPicker}
        routes={ghost.nearbyRoutes}
        loading={ghost.loading}
        onSelect={handleGhostSelectAndStart}
        onSkip={handleGhostSkipAndStart}
      />

      {/* Save Modal */}
      <SaveRouteModal
        visible={isFinished}
        distanceKm={recording.distanceKm}
        durationSeconds={recording.elapsedSeconds}
        preselectedCarId={activeCar?.id ?? null}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </View>
  );
}
