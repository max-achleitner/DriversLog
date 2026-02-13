import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRaceMode } from '../../contexts/RaceModeContext';

interface RecordingControlsProps {
  status: 'idle' | 'recording' | 'finished';
  onStart: () => void;
  onStop: () => void;
  onAddWaypoint: () => void;
}

export function RecordingControls({
  status,
  onStart,
  onStop,
  onAddWaypoint,
}: RecordingControlsProps) {
  const { isRaceMode, theme } = useRaceMode();

  if (status === 'idle') {
    return (
      <View className="mx-4 mt-4">
        <Pressable
          onPress={onStart}
          style={{ backgroundColor: theme.accent }}
          className="flex-row items-center justify-center rounded-2xl py-5 active:opacity-80"
        >
          <Ionicons
            name={isRaceMode ? 'speedometer-outline' : 'navigate'}
            size={22}
            color={theme.textLight}
          />
          <Text style={{ color: theme.textLight }} className="ml-3 text-lg font-bold">
            {isRaceMode ? 'Enter Cockpit' : 'Tour starten'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'recording') {
    return (
      <View className="mx-4 mt-4 flex-row gap-3">
        <Pressable
          onPress={onAddWaypoint}
          style={{ borderColor: theme.warm }}
          className="flex-1 flex-row items-center justify-center rounded-2xl border-2 py-4 active:opacity-80"
        >
          <Ionicons name="bookmark-outline" size={20} color={theme.warm} />
          <Text style={{ color: theme.warm }} className="ml-2 font-bold">
            Moment
          </Text>
        </Pressable>

        <Pressable
          onPress={onStop}
          className="flex-1 flex-row items-center justify-center rounded-2xl border-2 border-error py-4 active:opacity-80"
        >
          <Ionicons name="stop-circle-outline" size={20} color="#B91C1C" />
          <Text className="ml-2 font-bold text-error">Beenden</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}
