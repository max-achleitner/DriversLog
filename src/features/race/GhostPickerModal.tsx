import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useRaceMode } from '../../contexts/RaceModeContext';
import { formatDuration, formatDistanceKm } from '../../utils/geo';

interface GhostRoute {
  id: string;
  title: string;
  distanceKm: number | null;
  durationSeconds: number | null;
  createdAt: string;
}

interface GhostPickerModalProps {
  visible: boolean;
  routes: GhostRoute[];
  loading: boolean;
  onSelect: (route: GhostRoute) => void;
  onSkip: () => void;
}

export function GhostPickerModal({
  visible,
  routes,
  loading,
  onSelect,
  onSkip,
}: GhostPickerModalProps) {
  const { theme } = useRaceMode();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end">
        <View
          style={{ backgroundColor: theme.backgroundCard }}
          className="max-h-[70%] rounded-t-3xl px-6 pb-10 pt-6"
        >
          <Text style={{ color: theme.textDefault }} className="mb-1 text-xl font-bold">
            Ghost auswaehlen
          </Text>
          <Text style={{ color: theme.textSecondary }} className="mb-4 text-sm">
            Gegen welche fruehere Runde willst du fahren?
          </Text>

          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={{ color: theme.textMuted }} className="mt-3">
                Strecken werden geladen...
              </Text>
            </View>
          ) : routes.length === 0 ? (
            <View className="items-center py-10">
              <Text style={{ color: theme.textMuted }} className="text-center">
                Keine frueheren Runden in der Naehe gefunden.{'\n'}
                Die erste Runde wird zur Baseline.
              </Text>
            </View>
          ) : (
            <FlatList
              data={routes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={{ backgroundColor: theme.background }}
                  className="mb-2 rounded-xl px-4 py-3 active:opacity-70"
                >
                  <Text style={{ color: theme.textDefault }} className="text-base font-semibold">
                    {item.title}
                  </Text>
                  <View className="mt-1 flex-row gap-4">
                    {item.distanceKm != null && (
                      <Text style={{ color: theme.textSecondary }} className="text-sm">
                        {formatDistanceKm(item.distanceKm)}
                      </Text>
                    )}
                    {item.durationSeconds != null && (
                      <Text style={{ color: theme.textSecondary }} className="text-sm">
                        {formatDuration(item.durationSeconds)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: theme.textMuted }} className="mt-0.5 text-xs">
                    {new Date(item.createdAt).toLocaleDateString('de-DE')}
                  </Text>
                </Pressable>
              )}
            />
          )}

          <Pressable
            onPress={onSkip}
            style={{ backgroundColor: theme.accent }}
            className="mt-4 items-center rounded-xl py-4 active:opacity-80"
          >
            <Text style={{ color: theme.textLight }} className="text-base font-bold">
              {routes.length === 0 ? 'Ohne Ghost starten' : 'Ohne Ghost fahren'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
