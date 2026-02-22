import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRaceMode } from '../../contexts/RaceModeContext';
import { useToast } from '../../contexts/ToastContext';
import { WaypointType } from '../../types/supabase';
import { pickImageFromGallery, takePhoto, compressImage } from '../../lib/media';

interface WaypointTypeSheetProps {
  visible: boolean;
  onSelect: (type: WaypointType, note: string | undefined, localImageUri: string | undefined) => void;
  onClose: () => void;
}

interface TypeOption {
  type: WaypointType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'PHOTO_SPOT', label: 'Fotopunkt', icon: 'camera-outline' },
  { type: 'FOOD', label: 'Essen', icon: 'restaurant-outline' },
  { type: 'PARKING_SAFE', label: 'Parkplatz', icon: 'car-outline' },
  { type: 'FUEL_HIGH_OCTANE', label: 'Tankstelle', icon: 'speedometer-outline' },
  { type: 'SOUND_TUNNEL', label: 'Sound-Tunnel', icon: 'volume-high-outline' },
  { type: 'DRIVING_HIGHLIGHT', label: 'Highlight', icon: 'star-outline' },
];

export function WaypointTypeSheet({
  visible,
  onSelect,
  onClose,
}: WaypointTypeSheetProps) {
  const { theme } = useRaceMode();
  const { showToast } = useToast();
  const [selectedType, setSelectedType] = useState<WaypointType | null>(null);
  const [note, setNote] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const handlePickFromGallery = async () => {
    setImageLoading(true);
    try {
      const image = await pickImageFromGallery();
      if (image) {
        const compressed = await compressImage(image.uri);
        setLocalImageUri(compressed);
      }
    } catch {
      showToast({ type: 'error', message: 'Bild konnte nicht geladen werden.' });
    } finally {
      setImageLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    setImageLoading(true);
    try {
      const image = await takePhoto();
      if (image) {
        const compressed = await compressImage(image.uri);
        setLocalImageUri(compressed);
      }
    } catch {
      showToast({ type: 'error', message: 'Foto konnte nicht aufgenommen werden.' });
    } finally {
      setImageLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setLocalImageUri(null);
  };

  const handleSave = () => {
    if (!selectedType) return;
    onSelect(selectedType, note.trim() || undefined, localImageUri ?? undefined);
    setSelectedType(null);
    setNote('');
    setLocalImageUri(null);
  };

  const handleClose = () => {
    setSelectedType(null);
    setNote('');
    setLocalImageUri(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingBottom: 32,
              paddingTop: 16,
              maxHeight: '90%',
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.primary }}>
                  Was ist hier?
                </Text>
                <Pressable onPress={handleClose} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={theme.textDefault} />
                </Pressable>
              </View>

              {/* ── Image Section ─────────────────────────────────── */}
              {localImageUri ? (
                // Thumbnail with remove button
                <View style={{ marginBottom: 12 }}>
                  <View style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: localImageUri }}
                      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }}
                      resizeMode="cover"
                    />
                    {/* Remove image button */}
                    <Pressable
                      onPress={handleRemoveImage}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 16,
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                // Placeholder when no image
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 16 / 9,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: theme.textMuted + '40',
                    borderStyle: 'dashed',
                    backgroundColor: theme.backgroundCard,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {imageLoading ? (
                    <ActivityIndicator size="large" color={theme.accent} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={36} color={theme.textMuted} />
                      <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>
                        Kein Foto ausgewählt
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Camera / Gallery buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <Pressable
                  onPress={handleTakePhoto}
                  disabled={imageLoading}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: theme.accent + '60',
                    backgroundColor: theme.backgroundCard,
                    opacity: imageLoading ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.accent }}>
                    Foto aufnehmen
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handlePickFromGallery}
                  disabled={imageLoading}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: theme.accent + '60',
                    backgroundColor: theme.backgroundCard,
                    opacity: imageLoading ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="images-outline" size={18} color={theme.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.accent }}>
                    Aus Galerie
                  </Text>
                </Pressable>
              </View>

              {/* ── Type Grid ─────────────────────────────────────── */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {TYPE_OPTIONS.map((opt) => {
                  const isSelected = selectedType === opt.type;
                  return (
                    <Pressable
                      key={opt.type}
                      onPress={() => setSelectedType(opt.type)}
                      style={{
                        width: '30%',
                        alignItems: 'center',
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.accent : theme.textMuted + '40',
                        backgroundColor: isSelected ? theme.accent + '15' : theme.backgroundCard,
                      }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={26}
                        color={isSelected ? theme.accent : theme.textSecondary}
                      />
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSelected ? theme.accent : theme.textSecondary,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* ── Note ─────────────────────────────────────────── */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 }}>
                Notiz (optional)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="z.B. Toller Ausblick auf die Alpen"
                placeholderTextColor={theme.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: theme.textMuted + '40',
                  borderRadius: 12,
                  backgroundColor: theme.backgroundCard,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: theme.textDefault,
                  marginBottom: 20,
                }}
              />

              {/* ── Save Button ───────────────────────────────────── */}
              <Pressable
                onPress={handleSave}
                disabled={!selectedType || imageLoading}
                style={{
                  backgroundColor: selectedType && !imageLoading ? theme.accent : theme.textMuted,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 15 }}>
                  Speichern
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
