import { Text, View } from 'react-native';
import { formatDuration, formatDistanceKm } from '../../utils/geo';
import { useRaceMode } from '../../contexts/RaceModeContext';

interface RecordingOverlayProps {
  elapsedSeconds: number;
  distanceKm: number;
  currentAltitude: number | null;
}

export function RecordingOverlay({
  elapsedSeconds,
  distanceKm,
  currentAltitude,
}: RecordingOverlayProps) {
  const { theme } = useRaceMode();

  return (
    <View style={{ backgroundColor: theme.overlayBg }} className="mx-4 rounded-2xl px-6 py-5">
      <View className="flex-row items-start justify-between">
        {/* Zeit */}
        <View>
          <Text style={{ color: theme.textMuted }} className="text-xs uppercase tracking-widest">
            Dauer
          </Text>
          <Text style={{ color: theme.overlayValue }} className="mt-1 text-3xl font-bold">
            {formatDuration(elapsedSeconds)}
          </Text>
        </View>

        {/* Distanz */}
        <View className="items-end">
          <Text style={{ color: theme.textMuted }} className="text-xs uppercase tracking-widest">
            Strecke
          </Text>
          <Text style={{ color: theme.overlayValue }} className="mt-1 text-3xl font-bold">
            {formatDistanceKm(distanceKm)}
          </Text>
        </View>
      </View>

      {/* Hoehe */}
      {currentAltitude !== null && (
        <View className="mt-3 items-center">
          <Text style={{ color: theme.textMuted }} className="text-xs uppercase tracking-widest">
            Hoehe
          </Text>
          <Text style={{ color: theme.textLight }} className="mt-0.5 text-lg font-semibold">
            {Math.round(currentAltitude)} m
          </Text>
        </View>
      )}
    </View>
  );
}
