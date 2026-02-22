import { useState } from 'react';
import {
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
import { useCars } from '../../hooks/useCars';
import { PickerModal } from '../../components/PickerModal';
import { formatDuration, formatDistanceKm } from '../../utils/geo';
import { useToast } from '../../contexts/ToastContext';

interface SaveRouteModalProps {
  visible: boolean;
  distanceKm: number;
  durationSeconds: number;
  preselectedCarId?: string | null;
  onSave: (title: string, carId: string | null, description: string | null) => Promise<void>;
  onDiscard: () => void;
}

export function SaveRouteModal({
  visible,
  distanceKm,
  durationSeconds,
  preselectedCarId,
  onSave,
  onDiscard,
}: SaveRouteModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [showCarPicker, setShowCarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { cars } = useCars();
  const { showToast } = useToast();

  // Vorauswahl uebernehmen wenn Modal sichtbar wird
  if (visible && !initialized) {
    if (preselectedCarId) {
      setSelectedCarId(preselectedCarId);
    }
    setInitialized(true);
  }
  if (!visible && initialized) {
    setInitialized(false);
  }

  const carOptions = cars.map((c) => `${c.make} ${c.model}`);
  const selectedCarLabel = selectedCarId
    ? cars.find((c) => c.id === selectedCarId)
      ? `${cars.find((c) => c.id === selectedCarId)!.make} ${cars.find((c) => c.id === selectedCarId)!.model}`
      : ''
    : '';

  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(title.trim(), selectedCarId, description.trim() || null);
      setTitle('');
      setDescription('');
      setSelectedCarId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tour konnte nicht gespeichert werden.';
      showToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert('Tour verwerfen?', 'Die aufgezeichneten Daten gehen verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verwerfen',
        style: 'destructive',
        onPress: () => {
          setTitle('');
          setDescription('');
          setSelectedCarId(null);
          onDiscard();
        },
      },
    ]);
  };

  const handleCarSelect = (label: string) => {
    const car = cars.find((c) => `${c.make} ${c.model}` === label);
    setSelectedCarId(car?.id ?? null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-background px-6 pb-8 pt-4">
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-primary">Tour speichern</Text>
              <Pressable onPress={handleDiscard} className="rounded-full p-1">
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </Pressable>
            </View>

            {/* Zusammenfassung */}
            <View className="mb-5 flex-row justify-around rounded-xl bg-primary/10 py-3">
              <View className="items-center">
                <Text className="text-xs text-text-secondary">Strecke</Text>
                <Text className="text-lg font-bold text-primary">
                  {formatDistanceKm(distanceKm)}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-text-secondary">Dauer</Text>
                <Text className="text-lg font-bold text-primary">
                  {formatDuration(durationSeconds)}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Titel */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Titel *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Schwarzwald-Runde"
                placeholderTextColor="#9CA3AF"
                className="mb-4 rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 text-base text-text"
              />

              {/* Auto */}
              {cars.length > 0 && (
                <>
                  <Text className="mb-1 text-sm font-semibold text-text-secondary">
                    Fahrzeug
                  </Text>
                  <Pressable
                    onPress={() => setShowCarPicker(true)}
                    className="mb-4 flex-row items-center justify-between rounded-xl border border-text-muted/30 bg-background-card px-4 py-3"
                  >
                    <Text
                      className={`text-base ${selectedCarId ? 'text-text' : 'text-text-muted'}`}
                    >
                      {selectedCarLabel || 'Fahrzeug waehlen...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                  </Pressable>
                </>
              )}

              {/* Beschreibung */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Beschreibung
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Wie war die Tour?"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="mb-6 rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 text-base text-text"
                style={{ minHeight: 80 }}
              />

              {/* Buttons */}
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                className={`items-center rounded-xl py-4 ${
                  canSave ? 'bg-accent' : 'bg-text-muted'
                }`}
              >
                <Text className="text-base font-bold text-text-light">
                  {saving ? 'Speichern...' : 'Tour speichern'}
                </Text>
              </Pressable>

              <Pressable onPress={handleDiscard} className="mt-3 items-center py-3">
                <Text className="text-sm font-semibold text-error">Verwerfen</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showCarPicker}
        onClose={() => setShowCarPicker(false)}
        onSelect={handleCarSelect}
        options={carOptions}
        title="Fahrzeug waehlen"
        selected={selectedCarLabel}
      />
    </Modal>
  );
}
