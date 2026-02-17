import '../global.css';

// Geofencing-Task MUSS im Global Scope importiert werden, damit
// TaskManager.defineTask() beim JS-Bundle-Load ausgefuehrt wird —
// noch bevor React-Komponenten mounten. Ohne diesen Import werden
// Hintergrund-Events vom OS ignoriert.
import '../src/services/geofencing';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useBackgroundLocation } from '../src/hooks/useBackgroundLocation';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import { RaceModeProvider, useRaceMode } from '../src/contexts/RaceModeContext';

function RootStack() {
  const { isRaceMode, theme } = useRaceMode();

  useBackgroundLocation();

  return (
    <>
      <StatusBar style={isRaceMode ? 'light' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.primary },
          headerTintColor: theme.textLight,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings/index"
          options={{
            title: 'Einstellungen',
            headerBackTitle: 'Zurueck',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RaceModeProvider>
        <RootStack />
      </RaceModeProvider>
    </SettingsProvider>
  );
}
