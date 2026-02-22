import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { safeSupabaseCall } from '../lib/api';
import { getCurrentUserId } from '../lib/auth';
import { isOnline } from '../lib/network';
import { addToQueue, generateId } from '../lib/offlineStore';
import { Car, CarInsert } from '../types/supabase';
import { useToast } from '../contexts/ToastContext';

interface UseCarsReturn {
  cars: Car[];
  loading: boolean;
  error: string | null;
  fetchCars: () => Promise<void>;
  addCar: (data: Omit<CarInsert, 'user_id'>) => Promise<void>;
  deleteCar: (id: string) => Promise<void>;
}

export function useCars(): UseCarsReturn {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const userId = getCurrentUserId();

  const fetchCars = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await safeSupabaseCall<Car[]>(async () =>
      supabase
        .from('cars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .returns<Car[]>(),
    );

    if (fetchError) {
      setError(fetchError);
      showToast({ type: 'error', message: 'Garage konnte nicht geladen werden.' });
    } else {
      setCars(data ?? []);
    }

    setLoading(false);
  }, [userId, showToast]);

  const addCar = useCallback(
    async (data: Omit<CarInsert, 'user_id'>) => {
      setError(null);

      const carId = generateId(); // pre-generated UUID for idempotency
      const insertData: CarInsert & { id: string } = {
        id: carId,
        ...data,
        user_id: userId,
      };

      const online = await isOnline();

      if (online) {
        const { error: insertError } = await safeSupabaseCall(async () =>
          supabase.from('cars').insert(insertData),
        );

        if (insertError) {
          // Online insert failed — fall through to queue
        } else {
          showToast({ type: 'success', message: 'Fahrzeug hinzugefügt.' });
          await fetchCars();
          return;
        }
      }

      // Offline or online-insert failed: queue the create
      await addToQueue({ type: 'car_create', payload: { car: insertData } });
      showToast({
        type: 'info',
        message: 'Fahrzeug lokal gespeichert. Wird synchronisiert, sobald du wieder online bist.',
      });
      // Optimistically add to local list so the user sees it immediately
      const optimisticCar: Car = {
        id: carId,
        user_id: userId,
        make: insertData.make,
        model: insertData.model,
        year: insertData.year ?? null,
        modifications: insertData.modifications ?? null,
        photo_url: insertData.photo_url ?? null,
        created_at: new Date().toISOString(),
      };
      setCars((prev) => [optimisticCar, ...prev]);
    },
    [userId, fetchCars, showToast],
  );

  const deleteCar = useCallback(
    async (id: string) => {
      setError(null);

      const online = await isOnline();

      if (online) {
        const { error: deleteError } = await safeSupabaseCall(async () =>
          supabase.from('cars').delete().eq('id', id).eq('user_id', userId),
        );

        if (deleteError) {
          setError(deleteError);
          showToast({ type: 'error', message: 'Fahrzeug konnte nicht gelöscht werden.' });
          return;
        }

        setCars((prev) => prev.filter((car) => car.id !== id));
        showToast({ type: 'success', message: 'Fahrzeug gelöscht.' });
        return;
      }

      // Offline: queue the delete + remove optimistically from list
      await addToQueue({ type: 'car_delete', payload: { carId: id } });
      setCars((prev) => prev.filter((car) => car.id !== id));
      showToast({
        type: 'info',
        message: 'Fahrzeug wird gelöscht, sobald du wieder online bist.',
      });
    },
    [userId, showToast],
  );

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  return { cars, loading, error, fetchCars, addCar, deleteCar };
}
