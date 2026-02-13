import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRaceMode } from '../../contexts/RaceModeContext';
import { PickerModal } from '../../components/PickerModal';
import { Car } from '../../types/supabase';

interface ActiveCarSelectorProps {
  cars: Car[];
  activeCar: Car | null;
  onSelect: (car: Car) => void;
}

function formatCarLabel(car: Car): string {
  return `${car.make} ${car.model}${car.year ? ` (${car.year})` : ''}`;
}

export function ActiveCarSelector({ cars, activeCar, onSelect }: ActiveCarSelectorProps) {
  const { theme } = useRaceMode();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  // Keine Autos in der Garage — Hinweis zeigen
  if (cars.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/(tabs)/garage')}
        style={{ backgroundColor: theme.backgroundCard, borderColor: theme.textMuted + '40' }}
        className="mx-4 mb-3 flex-row items-center rounded-xl border px-4 py-3 active:opacity-70"
      >
        <Ionicons name="car-sport-outline" size={20} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted }} className="ml-3 flex-1 text-base">
          Erst ein Fahrzeug in der Garage anlegen
        </Text>
        <Ionicons name="arrow-forward" size={18} color={theme.textMuted} />
      </Pressable>
    );
  }

  const options = cars.map((c) => formatCarLabel(c));
  const selectedLabel = activeCar ? formatCarLabel(activeCar) : '';

  const handleSelect = (label: string) => {
    const car = cars.find((c) => formatCarLabel(c) === label);
    if (car) onSelect(car);
  };

  return (
    <>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={{ backgroundColor: theme.backgroundCard, borderColor: theme.textMuted + '40' }}
        className="mx-4 mb-3 flex-row items-center rounded-xl border px-4 py-3 active:opacity-70"
      >
        <Ionicons name="car-sport-outline" size={20} color={theme.accent} />
        <View className="ml-3 flex-1">
          {activeCar ? (
            <>
              <Text style={{ color: theme.textDefault }} className="text-base font-semibold">
                {activeCar.make} {activeCar.model}
              </Text>
              {activeCar.year && (
                <Text style={{ color: theme.textMuted }} className="text-xs">
                  {activeCar.year}{activeCar.modifications ? ` · ${activeCar.modifications}` : ''}
                </Text>
              )}
            </>
          ) : (
            <Text style={{ color: theme.textMuted }} className="text-base">
              Fahrzeug waehlen...
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
      </Pressable>

      <PickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelect}
        options={options}
        title="Fahrzeug waehlen"
        selected={selectedLabel}
      />
    </>
  );
}
