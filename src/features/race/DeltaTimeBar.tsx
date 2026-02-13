import { Text, View } from 'react-native';

interface DeltaTimeBarProps {
  currentDelta: number | null;
  hasReference: boolean;
}

const COLOR_FASTER = '#39ff14';
const COLOR_SLOWER = '#ff3333';
const COLOR_NEUTRAL = '#555555';

function formatDelta(delta: number): string {
  const sign = delta < 0 ? '-' : '+';
  const abs = Math.abs(delta);
  return `${sign}${abs.toFixed(2)}s`;
}

export function DeltaTimeBar({ currentDelta, hasReference }: DeltaTimeBarProps) {
  if (!hasReference) {
    return (
      <View
        style={{ backgroundColor: COLOR_NEUTRAL }}
        className="w-full items-center justify-center py-3"
      >
        <Text className="text-lg font-bold text-white">Setting Baseline...</Text>
      </View>
    );
  }

  if (currentDelta === null) {
    return (
      <View
        style={{ backgroundColor: COLOR_NEUTRAL }}
        className="w-full items-center justify-center py-3"
      >
        <Text className="text-lg font-bold text-white">--</Text>
      </View>
    );
  }

  const isFaster = currentDelta < 0;
  const barColor = isFaster ? COLOR_FASTER : COLOR_SLOWER;

  return (
    <View
      style={{ backgroundColor: barColor }}
      className="w-full items-center justify-center py-3"
    >
      <Text className="text-3xl font-black text-white">{formatDelta(currentDelta)}</Text>
    </View>
  );
}
