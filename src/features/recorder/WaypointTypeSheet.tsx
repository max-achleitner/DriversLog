import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRaceMode } from '../../contexts/RaceModeContext';
import { WaypointType } from '../../types/supabase';

interface WaypointTypeSheetProps {
  visible: boolean;
  onSelect: (type: WaypointType, note: string | undefined) => void;
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
  const [selectedType, setSelectedType] = useState<WaypointType | null>(null);
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (!selectedType) return;
    onSelect(selectedType, note.trim() || undefined);
    setSelectedType(null);
    setNote('');
  };

  const handleClose = () => {
    setSelectedType(null);
    setNote('');
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
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.primary }}>
                Was ist hier?
              </Text>
              <Pressable onPress={handleClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={theme.textDefault} />
              </Pressable>
            </View>

            {/* Type Grid */}
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

            {/* Note */}
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

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={!selectedType}
              style={{
                backgroundColor: selectedType ? theme.accent : theme.textMuted,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 15 }}>
                Speichern
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
