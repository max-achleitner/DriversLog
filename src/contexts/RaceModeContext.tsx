import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';

// ── Theme-Tokens ────────────────────────────────────────────

export interface RaceModeTheme {
  background: string;
  backgroundCard: string;
  primary: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  textDefault: string;
  textSecondary: string;
  textLight: string;
  textMuted: string;
  warm: string;
  warmLight: string;
  polylineColor: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  overlayBg: string;
  overlayValue: string;
}

const TOURING_THEME: RaceModeTheme = {
  background: '#F5F2ED',
  backgroundCard: '#FFFFFF',
  primary: '#1B3A4B',
  primaryDark: '#0F2330',
  accent: '#2E5A3C',
  accentLight: '#3D7A50',
  textDefault: '#1A1A1A',
  textSecondary: '#6B7280',
  textLight: '#F5F2ED',
  textMuted: '#9CA3AF',
  warm: '#8B6F47',
  warmLight: '#B8956A',
  polylineColor: '#B8956A',
  tabBarBg: '#1B3A4B',
  tabBarBorder: '#0F2330',
  tabBarActive: '#B8956A',
  tabBarInactive: '#9CA3AF',
  overlayBg: '#1B3A4B',
  overlayValue: '#B8956A',
};

const RACE_THEME: RaceModeTheme = {
  background: '#0A0A0A',
  backgroundCard: '#1A1A1A',
  primary: '#E11D48',
  primaryDark: '#9F1239',
  accent: '#E11D48',
  accentLight: '#FB7185',
  textDefault: '#F5F5F5',
  textSecondary: '#A1A1AA',
  textLight: '#FFFFFF',
  textMuted: '#71717A',
  warm: '#E11D48',
  warmLight: '#FB7185',
  polylineColor: '#E11D48',
  tabBarBg: '#0A0A0A',
  tabBarBorder: '#1A1A1A',
  tabBarActive: '#E11D48',
  tabBarInactive: '#71717A',
  overlayBg: '#0A0A0A',
  overlayValue: '#E11D48',
};

// ── Context ─────────────────────────────────────────────────

interface RaceModeContextValue {
  isRaceMode: boolean;
  theme: RaceModeTheme;
}

const RaceModeContext = createContext<RaceModeContextValue>({
  isRaceMode: false,
  theme: TOURING_THEME,
});

export function RaceModeProvider({ children }: { children: ReactNode }) {
  const { settings, loading } = useSettings();

  const value = useMemo<RaceModeContextValue>(
    () => ({
      isRaceMode: settings.isRaceModeEnabled,
      theme: settings.isRaceModeEnabled ? RACE_THEME : TOURING_THEME,
    }),
    [settings.isRaceModeEnabled],
  );

  if (loading) return null;

  return (
    <RaceModeContext.Provider value={value}>{children}</RaceModeContext.Provider>
  );
}

export function useRaceMode(): RaceModeContextValue {
  return useContext(RaceModeContext);
}
