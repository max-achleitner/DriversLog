import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCars } from './useCars';
import { Car } from '../types/supabase';

const LAST_CAR_KEY = 'driverslog_last_car_id';

interface UseActiveCarReturn {
  cars: Car[];
  activeCar: Car | null;
  loading: boolean;
  setActiveCar: (car: Car) => void;
}

export function useActiveCar(): UseActiveCarReturn {
  const { cars, loading: carsLoading } = useCars();
  const [activeCarId, setActiveCarId] = useState<string | null>(null);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  // Restore last used car from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(LAST_CAR_KEY)
      .then((id) => {
        if (id) setActiveCarId(id);
      })
      .finally(() => setRestoredFromStorage(true));
  }, []);

  // Auto-select: if no active car but cars are loaded, pick the stored one or first
  useEffect(() => {
    if (!restoredFromStorage || carsLoading || cars.length === 0) return;

    const storedCarExists = activeCarId && cars.some((c) => c.id === activeCarId);
    if (!storedCarExists) {
      setActiveCarId(cars[0].id);
      AsyncStorage.setItem(LAST_CAR_KEY, cars[0].id);
    }
  }, [restoredFromStorage, carsLoading, cars, activeCarId]);

  const activeCar = cars.find((c) => c.id === activeCarId) ?? null;

  const setActiveCar = useCallback((car: Car) => {
    setActiveCarId(car.id);
    AsyncStorage.setItem(LAST_CAR_KEY, car.id);
  }, []);

  return {
    cars,
    activeCar,
    loading: carsLoading || !restoredFromStorage,
    setActiveCar,
  };
}
