import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../src/hooks/useCars';
import { CarCard } from '../../src/features/cars/CarCard';
import { AddCarModal } from '../../src/features/cars/AddCarModal';

export default function GarageScreen() {
  const { cars, loading, error, addCar, deleteCar } = useCars();
  const [modalVisible, setModalVisible] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#1B3A4B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {error && (
        <View className="mx-4 mt-4 rounded-xl bg-error/10 px-4 py-3">
          <Text className="text-sm text-error">{error}</Text>
        </View>
      )}

      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CarCard car={item} onDelete={deleteCar} />
        )}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="mt-20 items-center px-8">
            <Ionicons name="car-sport-outline" size={64} color="#9CA3AF" />
            <Text className="mt-4 text-center text-lg font-semibold text-text-secondary">
              Deine Garage ist leer
            </Text>
            <Text className="mt-2 text-center text-sm text-text-muted">
              Fuege dein erstes Auto hinzu und starte deine Touring-Erfahrung.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => setModalVisible(true)}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg active:bg-accent-dark"
      >
        <Ionicons name="add" size={28} color="#F5F2ED" />
      </Pressable>

      <AddCarModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={addCar}
      />
    </View>
  );
}
