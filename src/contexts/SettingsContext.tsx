import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  autoStartEnabled: boolean;
  autoStopEnabled: boolean;
  privacyZoneEnabled: boolean;
  homeLat: number | null;
  homeLng: number | null;
  homeRadiusMeters: number;
  isRaceModeEnabled: boolean;
}

const STORAGE_KEY = 'driverslog_settings';

const DEFAULTS: AppSettings = {
  autoStartEnabled: false,
  autoStopEnabled: false,
  privacyZoneEnabled: true,
  homeLat: null,
  homeLng: null,
  homeRadiusMeters: 200,
  isRaceModeEnabled: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  loading: true,
  update: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          setSettings({ ...DEFAULTS, ...parsed });
        } catch {
          // corrupt data — keep defaults
        }
      }
      setLoading(false);
    });
  }, []);

  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
