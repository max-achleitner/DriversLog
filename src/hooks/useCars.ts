import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { Car, CarInsert } from '../types/supabase';

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

  const userId = getCurrentUserId();

  const fetchCars = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<Car[]>();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCars(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  const addCar = useCallback(async (data: Omit<CarInsert, 'user_id'>) => {
    setError(null);

    const insertData: CarInsert = { ...data, user_id: userId };
    const { error: insertError } = await supabase
      .from('cars')
      .insert(insertData);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await fetchCars();
  }, [userId, fetchCars]);

  const deleteCar = useCallback(async (id: string) => {
    setError(null);

    const { error: deleteError } = await supabase
      .from('cars')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setCars((prev) => prev.filter((car) => car.id !== id));
  }, [userId]);

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  return { cars, loading, error, fetchCars, addCar, deleteCar };
}
