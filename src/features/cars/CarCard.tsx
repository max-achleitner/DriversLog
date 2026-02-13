import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Car } from '../../types/supabase';

interface CarCardProps {
  car: Car;
  onDelete: (id: string) => void;
}

export function CarCard({ car, onDelete }: CarCardProps) {
  const handleDelete = () => {
    Alert.alert(
      'Auto entfernen',
      `Moechtest du "${car.make} ${car.model}" wirklich loeschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Loeschen', style: 'destructive', onPress: () => onDelete(car.id) },
      ],
    );
  };

  return (
    <View className="mx-4 mb-4 rounded-2xl bg-background-card p-4 shadow-md">
      {/* Platzhalter-Bild */}
      <View className="mb-3 h-40 items-center justify-center rounded-xl bg-primary/10">
        <Ionicons name="car-sport-outline" size={56} color="#1B3A4B" />
      </View>

      {/* Info */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-lg font-bold text-primary">
            {car.make} {car.model}
          </Text>
          {car.year && (
            <Text className="mt-0.5 text-sm text-text-secondary">
              Baujahr {car.year}
            </Text>
          )}
          {car.modifications && (
            <Text className="mt-1 text-sm text-text-muted">
              {car.modifications}
            </Text>
          )}
        </View>

        {/* Loeschen-Button */}
        <Pressable
          onPress={handleDelete}
          className="ml-2 rounded-full p-2 active:bg-error/10"
        >
          <Ionicons name="trash-outline" size={20} color="#B91C1C" />
        </Pressable>
      </View>
    </View>
  );
}
