import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  options: string[];
  title: string;
  selected?: string;
}

export function PickerModal({
  visible,
  onClose,
  onSelect,
  options,
  title,
  selected,
}: PickerModalProps) {
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = (value: string) => {
    onSelect(value);
    setSearch('');
    setShowCustom(false);
    setCustomInput('');
    onClose();
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (trimmed.length > 0) {
      handleSelect(trimmed);
    }
  };

  const handleClose = () => {
    setSearch('');
    setShowCustom(false);
    setCustomInput('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable className="flex-1 bg-black/40" onPress={handleClose}>
        <View className="mt-auto max-h-[80%] rounded-t-3xl bg-background px-6 pb-8 pt-4">
          <Pressable>
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-primary">{title}</Text>
              <Pressable onPress={handleClose} className="rounded-full p-1">
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </Pressable>
            </View>

            {/* Search */}
            <View className="mb-3 flex-row items-center rounded-xl border border-text-muted/30 bg-background-card px-4 py-2">
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Suchen..."
                placeholderTextColor="#9CA3AF"
                className="ml-2 flex-1 text-base text-text"
                autoCorrect={false}
              />
            </View>

            {showCustom ? (
              <View className="mt-2">
                <Text className="mb-2 text-sm text-text-secondary">
                  Eigenen Wert eingeben:
                </Text>
                <TextInput
                  value={customInput}
                  onChangeText={setCustomInput}
                  placeholder="Eingeben..."
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  className="mb-3 rounded-xl border border-text-muted/30 bg-background-card px-4 py-3 text-base text-text"
                />
                <Pressable
                  onPress={handleCustomSubmit}
                  disabled={customInput.trim().length === 0}
                  className={`items-center rounded-xl py-3 ${
                    customInput.trim().length > 0
                      ? 'bg-accent'
                      : 'bg-text-muted'
                  }`}
                >
                  <Text className="text-base font-bold text-text-light">
                    Uebernehmen
                  </Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${
                      item === selected ? 'bg-accent/10' : ''
                    }`}
                  >
                    <Text
                      className={`text-base ${
                        item === selected
                          ? 'font-semibold text-accent'
                          : 'text-text'
                      }`}
                    >
                      {item}
                    </Text>
                    {item === selected && (
                      <Ionicons name="checkmark" size={20} color="#2E5A3C" />
                    )}
                  </Pressable>
                )}
                ListFooterComponent={
                  <Pressable
                    onPress={() => setShowCustom(true)}
                    className="mt-1 flex-row items-center rounded-xl px-4 py-3"
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#6B7280" />
                    <Text className="ml-2 text-base text-text-secondary">
                      Andere...
                    </Text>
                  </Pressable>
                }
                ListEmptyComponent={
                  <View className="items-center py-6">
                    <Text className="text-text-muted">Keine Treffer</Text>
                  </View>
                }
              />
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
