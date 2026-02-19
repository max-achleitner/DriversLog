import { Pressable, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useRouteRecording } from '../../src/hooks/useRouteRecording';
import { useStopDetection } from '../../src/hooks/useStopDetection';
import { useCurveDetection } from '../../src/hooks/useCurveDetection';
import { useGhostSelection } from '../../src/hooks/useGhostSelection';
import { useActiveCar } from '../../src/hooks/useActiveCar';
import { RecordingOverlay } from '../../src/features/recorder/RecordingOverlay';
import { RecordingControls } from '../../src/features/recorder/RecordingControls';
import { SaveRouteModal } from '../../src/features/recorder/SaveRouteModal';
import { StopDetectedBanner } from '../../src/features/recorder/StopDetectedBanner';
import { CurveDetectedToast } from '../../src/features/recorder/CurveDetectedToast';
import { WaypointTypeSheet } from '../../src/features/recorder/WaypointTypeSheet';
import { ActiveCarSelector } from '../../src/features/recorder/ActiveCarSelector';
import { DeltaTimeBar } from '../../src/features/race/DeltaTimeBar';
import { GhostPickerModal } from '../../src/features/race/GhostPickerModal';
import { useRaceMode } from '../../src/contexts/RaceModeContext';
import { DeltaCalculator, RoutePoint } from '../../src/utils/DeltaCalculator';
import { GeoPoint, WaypointType } from '../../src/types/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export default function RecordScreen() {
  const { status: permStatus, requestPermission } = useLocationPermission();
  const { theme, isRaceMode } = useRaceMode();
  const ghost = useGhostSelection();
  const { cars, activeCar, setActiveCar } = useActiveCar();
  const mapRef = useRef<MapView>(null);
  const deltaCalcRef = useRef(new DeltaCalculator());

  const [showGhostPicker, setShowGhostPicker] = useState(false);
  const [currentDelta, setCurrentDelta] = useState<number | null>(null);
  const [hasReference, setHasReference] = useState(false);
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [pendingStopCoords, setPendingStopCoords] = useState<GeoPoint | null>(null);

  // Bridge ref to avoid circular dependency between hooks
  const detectionCbRef = useRef<((loc: Location.LocationObject) => void) | null>(null);
  const recording = useRouteRecording({
    onLocationUpdate: (loc) => detectionCbRef.current?.(loc),
  });

  const isRecording = recording.status === 'recording';
  const isPaused = recording.status === 'paused';
  const isActiveSession = isRecording || isPaused;
  const isFinished = recording.status === 'finished';

  const stopDetection = useStopDetection({ isActive: isRecording });
  const curveDetection = useCurveDetection({ isActive: isRecording });
  detectionCbRef.current = (loc) => {
    stopDetection.onLocationUpdate(loc);
    curveDetection.onLocationUpdate(loc);
  };

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
    await recording.saveRoute(title, carId, description, curveDetection.completedCurves);
    recording.reset();
    curveDetection.resetCurves();
    // Reset delta state
    setCurrentDelta(null);
    setHasReference(false);
    deltaCalcRef.current = new DeltaCalculator();
  };

  const handleDiscard = () => {
    recording.reset();
    curveDetection.resetCurves();
    setCurrentDelta(null);
    setHasReference(false);
    deltaCalcRef.current = new DeltaCalculator();
  };

  // Stop detection: user taps "Markieren" on banner
  const handleMarkStop = useCallback(() => {
    if (stopDetection.stopDetectedLocation) {
      setPendingStopCoords(stopDetection.stopDetectedLocation);
      setShowTypeSheet(true);
    }
  }, [stopDetection.stopDetectedLocation]);

  // Stop detection: user selects type in sheet
  const handleTypeSelect = useCallback(
    (type: WaypointType, note: string | undefined) => {
      if (pendingStopCoords) {
        recording.addWaypoint(pendingStopCoords, type, note);
      }
      setPendingStopCoords(null);
      setShowTypeSheet(false);
      stopDetection.dismissStop();
    },
    [pendingStopCoords, recording, stopDetection],
  );

  const handleTypeSheetClose = useCallback(() => {
    setPendingStopCoords(null);
    setShowTypeSheet(false);
    stopDetection.dismissStop();
  }, [stopDetection]);

  // Handle notification tap (when app was in background)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'stop_detected' && typeof data.lat === 'number' && typeof data.lng === 'number') {
        setPendingStopCoords({ lat: data.lat, lng: data.lng });
        setShowTypeSheet(true);
      }
    });
    return () => sub.remove();
  }, []);

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
      <View className={isActiveSession ? 'flex-[3]' : 'flex-1'}>
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

          {/* Erkannte Kurven-Highlights */}
          {curveDetection.completedCurves.map((curve, i) => (
            <Polyline
              key={`curve-${i}`}
              coordinates={curve.curvePath.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor="#00BCD4"
              strokeWidth={6}
            />
          ))}

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
        {isActiveSession && (
          <RecordingOverlay
            elapsedSeconds={recording.elapsedSeconds}
            distanceKm={recording.distanceKm}
            currentAltitude={recording.currentAltitude}
          />
        )}

        {/* Auto-Auswahl im Idle-Zustand */}
        {!isActiveSession && !isFinished && (
          <ActiveCarSelector cars={cars} activeCar={activeCar} onSelect={setActiveCar} />
        )}

        <RecordingControls
          status={recording.status}
          onStart={handleStart}
          onStop={recording.stopRecording}
          onPause={recording.pauseRecording}
          onResume={recording.resumeRecording}
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

      {/* Stop Detected Banner */}
      <StopDetectedBanner
        visible={isActiveSession && stopDetection.stopDetectedLocation !== null}
        onMark={handleMarkStop}
        onDismiss={stopDetection.dismissStop}
      />

      {/* Curve Detected Toast */}
      <CurveDetectedToast
        curve={curveDetection.latestCurve}
        onDismiss={curveDetection.dismissLatest}
      />

      {/* Waypoint Type Sheet */}
      <WaypointTypeSheet
        visible={showTypeSheet}
        onSelect={handleTypeSelect}
        onClose={handleTypeSheetClose}
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
