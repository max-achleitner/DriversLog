/**
 * permissions.ts
 *
 * Reusable, async permission handlers for foreground and background location.
 * All user-facing strings are in German.
 *
 * Usage:
 *   const result = await ensureLocationPermission();
 *   if (result !== 'granted') return; // abort
 */

import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

/** Result of a permission request. */
export type PermissionResult = 'granted' | 'denied' | 'blocked';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Shows a pre-prompt Alert explaining why the permission is needed.
 * Returns true if the user agreed to proceed.
 */
function showPrePrompt(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Standort-Zugriff',
      message,
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Weiter', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Shows an Alert informing the user that permission is blocked and they must
 * open Settings to re-enable it.
 */
function showBlockedDialog(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      'Standort-Zugriff blockiert',
      'Du hast den Standort-Zugriff abgelehnt. Bitte aktiviere ihn in den Einstellungen, um deine Tour aufzuzeichnen.',
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Einstellungen öffnen',
          onPress: () => {
            void Linking.openSettings();
            resolve();
          },
        },
      ],
      { cancelable: false },
    );
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensures foreground location permission is granted.
 *
 * Flow:
 *   GRANTED      → returns 'granted' immediately
 *   UNDETERMINED → shows explanation dialog, then requests system permission
 *   DENIED       → shows "open Settings" dialog, returns 'blocked'
 */
export async function ensureLocationPermission(): Promise<PermissionResult> {
  let { status } = await Location.getForegroundPermissionsAsync();

  if (status === Location.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (status === Location.PermissionStatus.UNDETERMINED) {
    const proceed = await showPrePrompt(
      'DriversLog zeichnet deine Route auf — dafür benötigen wir Zugriff auf deinen Standort.',
    );

    if (!proceed) {
      return 'denied';
    }

    const result = await Location.requestForegroundPermissionsAsync();
    status = result.status;

    if (status === Location.PermissionStatus.GRANTED) {
      return 'granted';
    }

    // User denied the system dialog
    await showBlockedDialog();
    return 'blocked';
  }

  // Status is DENIED — user previously denied, must open Settings
  await showBlockedDialog();
  return 'blocked';
}

/**
 * Ensures background location permission is granted.
 * Should only be called AFTER ensureLocationPermission() returned 'granted'.
 *
 * Note: On iOS, the system shows the background permission dialog only once.
 * After that, the user must manually enable it in Settings → App → Location → "Immer".
 */
export async function ensureBackgroundLocationPermission(): Promise<PermissionResult> {
  let { status } = await Location.getBackgroundPermissionsAsync();

  if (status === Location.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (status === Location.PermissionStatus.UNDETERMINED) {
    const proceed = await showPrePrompt(
      'Damit die Aufzeichnung auch bei gesperrtem Bildschirm weiterläuft, benötigen wir dauerhaften Standort-Zugriff.',
    );

    if (!proceed) {
      return 'denied';
    }

    const result = await Location.requestBackgroundPermissionsAsync();
    status = result.status;

    if (status === Location.PermissionStatus.GRANTED) {
      return 'granted';
    }

    await showBlockedDialog();
    return 'blocked';
  }

  // DENIED — open Settings
  await showBlockedDialog();
  return 'blocked';
}
