/**
 * media.ts
 *
 * Image pick, capture, compress, upload, and delete functions for waypoint images.
 * All user-facing strings are in German.
 *
 * Storage bucket: waypoint-images
 * Upload path:    {userId}/{waypointId}/{timestamp}.jpg
 *
 * Usage:
 *   const image = await pickImageFromGallery();
 *   if (!image) return;
 *   const compressed = await compressImage(image.uri);
 *   const path = await uploadWaypointImage(userId, waypointId, compressed);
 *   if (path) { const url = getPublicImageUrl(path); }
 */

import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';
import { supabase } from './supabase';
import { isOnline } from './network';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MediaPermissionResult = 'granted' | 'denied' | 'blocked';

export interface ImagePickResult {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function showMediaBlockedDialog(type: 'camera' | 'gallery'): Promise<void> {
  const title =
    type === 'camera' ? 'Kamera-Zugriff blockiert' : 'Foto-Zugriff blockiert';
  const message =
    type === 'camera'
      ? 'Du hast den Kamera-Zugriff abgelehnt. Bitte aktiviere ihn in den Einstellungen, um Fotos aufzunehmen.'
      : 'Du hast den Zugriff auf deine Fotos abgelehnt. Bitte aktiviere ihn in den Einstellungen.';

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
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

// ── Permission helpers ────────────────────────────────────────────────────────

export async function ensureCameraPermission(): Promise<MediaPermissionResult> {
  const { status } = await ImagePicker.getCameraPermissionsAsync();

  if (status === 'granted') return 'granted';

  if (status === 'undetermined') {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    if (result.status === 'granted') return 'granted';
    await showMediaBlockedDialog('camera');
    return 'blocked';
  }

  // Previously denied
  await showMediaBlockedDialog('camera');
  return 'blocked';
}

export async function ensureGalleryPermission(): Promise<MediaPermissionResult> {
  const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (status === 'granted') return 'granted';

  if (status === 'undetermined') {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (result.status === 'granted') return 'granted';
    await showMediaBlockedDialog('gallery');
    return 'blocked';
  }

  // Previously denied
  await showMediaBlockedDialog('gallery');
  return 'blocked';
}

// ── Pick / Capture ────────────────────────────────────────────────────────────

/**
 * Opens the device photo gallery. Returns the selected image or null if
 * the user cancelled or permission was denied.
 */
export async function pickImageFromGallery(): Promise<ImagePickResult | null> {
  const perm = await ensureGalleryPermission();
  if (perm !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 1,
    aspect: [16, 9],
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/**
 * Opens the camera for capturing a new photo. Returns the captured image or
 * null if the user cancelled or permission was denied.
 */
export async function takePhoto(): Promise<ImagePickResult | null> {
  const perm = await ensureCameraPermission();
  if (perm !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 1,
    aspect: [16, 9],
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

// ── Compress ──────────────────────────────────────────────────────────────────

/**
 * Resizes and compresses an image to reduce file size before upload.
 * Defaults: max 1920×1080, JPEG quality 0.7.
 * Returns the local URI of the compressed file.
 */
export async function compressImage(
  uri: string,
  options: CompressionOptions = {},
): Promise<string> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.7 } = options;

  const result = await manipulateAsync(
    uri,
    [{ resize: { width: maxWidth, height: maxHeight } }],
    { compress: quality, format: SaveFormat.JPEG },
  );

  return result.uri;
}

// ── Upload / Delete ─────────────────────────────────────────────────────────

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '');
}──

/**
 * Uploads a compressed image to Supabase Storage.
 *
 * Returns the storage PATH (not full URL) on success, or null on failure.
 * Throws 'FILE_TOO_LARGE' if the file exceeds the 5 MB bucket limit.
 *
 * Offline check is performed first — returns null if not online.
 */
export async function uploadWaypointImage(
  userId: string,
  waypointId: string,
  imageUri: string,
): Promise<string | null> {
  const online = await isOnline();
  if (!online) return null;

  const filename = `${Date.now()}.jpg`;
  const safeUserId = sanitizePathSegment(userId);
  const safeWaypointId = sanitizePathSegment(waypointId);
  if (!safeUserId || !safeWaypointId) {
    throw new Error('Invalid userId or waypointId for image upload');
  }
  const storagePath = `${safeUserId}/${safeWaypointId}/${filename}`;

  // Read file as ArrayBuffer for upload
  const response = await fetch(imageUri);
  const arrayBuffer = await response.arrayBuffer();

  // Guard: 5 MB limit (matches bucket config)
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE');
  }

  const { error } = await supabase.storage
    .from('waypoint-images')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) return null;

  return storagePath;
}

/**
 * Returns the public CDN URL for a storage path.
 * Use this to display images with <Image source={{ uri: getPublicImageUrl(path) }}.
 */
export function getPublicImageUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('waypoint-images')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Deletes a single image from storage by its storage path.
 */
export async function deleteWaypointImage(storagePath: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from('waypoint-images')
    .remove([storagePath]);
  return !error;
}

/**
 * Deletes ALL images for a waypoint (the entire waypointId subfolder).
 * Call this when a waypoint or its parent route is deleted.
 */
export async function deleteAllWaypointImages(
  userId: string,
  waypointId: string,
): Promise<void> {
  const { data } = await supabase.storage
    .from('waypoint-images')
    .list(`${userId}/${waypointId}`);

  if (!data || data.length === 0) return;

  const paths = data.map((file) => `${userId}/${waypointId}/${file.name}`);
  await supabase.storage.from('waypoint-images').remove(paths);
}
