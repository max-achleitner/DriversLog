/**
 * useBackgroundLocation
 *
 * Registriert / deregistriert Geofencing basierend auf den User-Settings.
 * Muss in einer Top-Level-Komponente eingebunden werden (z.B. app/_layout.tsx).
 *
 * WICHTIG: Geofencing erfordert die "Immer zulassen" ("Always Allow") Permission.
 * - iOS:  Der User muss in den Systemeinstellungen → App → Standort → "Immer" waehlen.
 * - Android: ACCESS_BACKGROUND_LOCATION muss explizit vom User bestaetigt werden.
 *
 * Wenn nur "Waehrend der Nutzung" gewaehrt ist, kann kein Geofencing im
 * Hintergrund stattfinden. Der Hook prueft dies und startet Geofencing nur,
 * wenn die Background-Permission vorliegt.
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useSettings } from './useSettings';
import {
  startGeofencing,
  stopGeofencing,
  isGeofencingActive,
} from '../services/geofencing';

export function useBackgroundLocation(): void {
  const { settings, loading } = useSettings();
  const activeRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const needsGeofencing =
      (settings.autoStartEnabled || settings.autoStopEnabled) &&
      settings.homeLat !== null &&
      settings.homeLng !== null;

    async function sync() {
      if (needsGeofencing) {
        // ── Schritt 1: Background-Permission pruefen ──
        let fgStatus: Location.PermissionStatus;
        try {
          const result = await Location.getForegroundPermissionsAsync();
          fgStatus = result.status;
        } catch {
          // Location services unavailable (e.g. missing Info.plist keys in dev)
          return;
        }
        if (fgStatus !== Location.PermissionStatus.GRANTED) {
          // Ohne Vordergrund-Berechtigung koennen wir nichts tun
          return;
        }

        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== Location.PermissionStatus.GRANTED) {
          // Background-Permission fehlt — anfordern.
          // WICHTIG: Auf iOS zeigt requestBackgroundPermissionsAsync() nur einmal
          // den System-Dialog. Danach muss der User manuell in die Einstellungen.
          const { status: newBgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (newBgStatus !== Location.PermissionStatus.GRANTED) {
            console.warn(
              '[useBackgroundLocation] Background-Permission verweigert. ' +
              'Geofencing erfordert "Immer zulassen" / "Always Allow".',
            );
            return;
          }
        }

        // ── Schritt 2: Notification-Permission pruefen ──
        const { status: notifStatus } = await Notifications.getPermissionsAsync();
        if (notifStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        // ── Schritt 3: Geofencing starten ──
        await startGeofencing(
          settings.homeLat!,
          settings.homeLng!,
          settings.homeRadiusMeters,
        );
        activeRef.current = true;
      } else {
        // Geofencing nicht mehr benoetigt — aufraumen
        if (activeRef.current) {
          await stopGeofencing();
          activeRef.current = false;
        }
      }
    }

    sync();
  }, [
    loading,
    settings.autoStartEnabled,
    settings.autoStopEnabled,
    settings.homeLat,
    settings.homeLng,
    settings.homeRadiusMeters,
  ]);

  // Cleanup beim Unmount (sollte normalerweise nicht passieren fuer Root-Layout)
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        stopGeofencing();
        activeRef.current = false;
      }
    };
  }, []);
}
