/**
 * DriversLog — Geofencing Background Task
 *
 * WICHTIG / IMPORTANT:
 * Dieses Feature erfordert die "Immer zulassen" ("Always Allow") Standort-Berechtigung.
 * - iOS:  Info.plist → NSLocationAlwaysAndWhenInUseUsageDescription
 *         (wird ueber das expo-location Plugin in app.json konfiguriert)
 * - Android: ACCESS_BACKGROUND_LOCATION Permission
 *         (wird ueber das expo-location Plugin in app.json konfiguriert)
 *
 * Ohne "Always Allow" kann das Geraet keine Geofencing-Events im Hintergrund
 * ausloesen. Der User muss die Berechtigung explizit in den Systemeinstellungen erteilen.
 *
 * Diese Datei MUSS im Global Scope importiert werden (z.B. in app/_layout.tsx),
 * damit TaskManager.defineTask() ausgefuehrt wird, BEVOR React-Komponenten mounten.
 * Expo/TaskManager erfordert, dass Tasks beim App-Start registriert sind — auch
 * wenn die App aus dem Hintergrund aufgewacht wird.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Konstanten ──────────────────────────────────────────────

export const GEOFENCING_TASK = 'DRIVERSLOG_GEOFENCING_TASK';
const SETTINGS_KEY = 'driverslog_settings';

/**
 * AsyncStorage-Key: wird auf 'true' gesetzt, wenn der Task ein
 * Background-Recording gestartet hat. Die App liest diesen Flag
 * beim naechsten Oeffnen, um den Recording-Screen fortzusetzen.
 */
export const BG_RECORDING_ACTIVE_KEY = 'driverslog_bg_recording_active';

// ── Interfaces (nur lokale, schmale Typen) ──────────────────

interface GeofencingSettings {
  autoStartEnabled: boolean;
  autoStopEnabled: boolean;
  homeLat: number | null;
  homeLng: number | null;
  homeRadiusMeters: number;
}

interface GeofencingEventData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

// ── Notification-Setup ──────────────────────────────────────

// Notifications muessen im Vordergrund sichtbar sein
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Hilfsfunktionen ─────────────────────────────────────────

async function loadSettings(): Promise<GeofencingSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeofencingSettings;
  } catch {
    return null;
  }
}

async function sendLocalNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // sofort
  });
}

// ── Task-Definition (Global Scope!) ─────────────────────────
//
// TaskManager.defineTask wird EINMAL beim JS-Bundle-Load ausgefuehrt.
// Der Callback wird vom OS aufgerufen, wenn ein Geofencing-Event eintritt —
// auch wenn die App im Hintergrund oder beendet ist.

TaskManager.defineTask<GeofencingEventData>(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Geofencing] Task-Fehler:', error.message);
    return;
  }

  if (!data) return;

  const settings = await loadSettings();
  if (!settings) return;

  const { eventType } = data;

  // ── Verlassen der Homezone → Recording starten ──
  if (eventType === Location.GeofencingEventType.Exit) {
    if (!settings.autoStartEnabled) return;

    // Markiere, dass ein Background-Recording aktiv ist.
    // Das eigentliche watchPositionAsync laeuft erst, wenn die App
    // in den Vordergrund kommt (oder ueber einen separaten Background-Location-Task).
    // Hier setzen wir den Flag und benachrichtigen den User.
    await AsyncStorage.setItem(BG_RECORDING_ACTIVE_KEY, 'true');

    await sendLocalNotification(
      'Fahrt erkannt',
      'Du hast deine Homezone verlassen — Recording gestartet.',
    );
  }

  // ── Ankunft in Homezone → Recording stoppen ──
  if (eventType === Location.GeofencingEventType.Enter) {
    if (!settings.autoStopEnabled) return;

    const wasRecording = await AsyncStorage.getItem(BG_RECORDING_ACTIVE_KEY);
    if (wasRecording !== 'true') return;

    // Recording-Flag zuruecksetzen
    await AsyncStorage.setItem(BG_RECORDING_ACTIVE_KEY, 'false');

    await sendLocalNotification(
      'Willkommen zurueck',
      'Du bist in deiner Homezone angekommen — Tour wird gespeichert.',
    );
  }
});

// ── Start / Stop Helfer (aus React-Code aufgerufen) ─────────

export async function startGeofencing(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Promise<void> {
  await Location.startGeofencingAsync(GEOFENCING_TASK, [
    {
      identifier: 'home',
      latitude,
      longitude,
      radius: radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    },
  ]);
}

export async function stopGeofencing(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
  }
}

export async function isGeofencingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
}
