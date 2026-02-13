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
import { CarInsert } from '../../types/supabase';
import { PickerModal } from '../../components/PickerModal';
import { CAR_MAKES, CAR_MAKES_MODELS } from '../../constants/carData';

interface AddCarModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CarInsert, 'user_id'>) => Promise<void>;
}

export function AddCarModal({ visible, onClose, onSubmit }: AddCarModalProps) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [modifications, setModifications] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMakePicker, setShowMakePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const modelOptions = make && make in CAR_MAKES_MODELS
    ? CAR_MAKES_MODELS[make]
    : [];

  const canSubmit = make.trim().length > 0 && model.trim().length > 0;

  const handleMakeSelect = (value: string) => {
    setMake(value);
    setModel('');
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);

    const parsedYear = year.trim() ? parseInt(year.trim(), 10) : null;

    await onSubmit({
      make: make.trim(),
      model: model.trim(),
      year: parsedYear && !isNaN(parsedYear) ? parsedYear : null,
      modifications: modifications.trim() || null,
    });

    // Reset
    setMake('');
    setModel('');
    setYear('');
    setModifications('');
    setSubmitting(false);
    onClose();
  };

  const handleClose = () => {
    if (submitting) return;
    setMake('');
    setModel('');
    setYear('');
    setModifications('');
    onClose();
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
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-primary">
                Auto hinzufuegen
              </Text>
              <Pressable onPress={handleClose} className="rounded-full p-1">
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Marke */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Marke *
              </Text>
              <Pressable
                onPress={() => setShowMakePicker(true)}
                className="mb-4 flex-row items-center justify-between rounded-xl border border-text-muted/30 bg-background-card px-4 py-3"
              >
                <Text
                  className={`text-base ${make ? 'text-text' : 'text-text-muted'}`}
                >
                  {make || 'Marke waehlen...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </Pressable>

              {/* Modell */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Modell *
              </Text>
              <Pressable
                onPress={() => make && setShowModelPicker(true)}
                className={`mb-4 flex-row items-center justify-between rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 ${
                  !make ? 'opacity-50' : ''
                }`}
              >
                <Text
                  className={`text-base ${model ? 'text-text' : 'text-text-muted'}`}
                >
                  {model || (make ? 'Modell waehlen...' : 'Zuerst Marke waehlen')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </Pressable>

              {/* Baujahr */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Baujahr
              </Text>
              <TextInput
                value={year}
                onChangeText={setYear}
                placeholder="z.B. 1987"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={4}
                className="mb-4 rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 text-base text-text"
              />

              {/* Modifikationen */}
              <Text className="mb-1 text-sm font-semibold text-text-secondary">
                Modifikationen
              </Text>
              <TextInput
                value={modifications}
                onChangeText={setModifications}
                placeholder="z.B. KW Gewindefahrwerk, Akrapovic Auspuff"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="mb-6 rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 text-base text-text"
                style={{ minHeight: 80 }}
              />

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`items-center rounded-xl py-4 ${
                  canSubmit && !submitting ? 'bg-accent' : 'bg-text-muted'
                }`}
              >
                <Text className="text-base font-bold text-text-light">
                  {submitting ? 'Speichern...' : 'Hinzufuegen'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Picker Modals */}
      <PickerModal
        visible={showMakePicker}
        onClose={() => setShowMakePicker(false)}
        onSelect={handleMakeSelect}
        options={CAR_MAKES}
        title="Marke waehlen"
        selected={make}
      />

      <PickerModal
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        onSelect={setModel}
        options={modelOptions}
        title="Modell waehlen"
        selected={model}
      />
    </Modal>
  );
}
