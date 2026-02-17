import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRaceMode } from '../../contexts/RaceModeContext';

interface StopDetectedBannerProps {
  visible: boolean;
  onMark: () => void;
  onDismiss: () => void;
}

export function StopDetectedBanner({
  visible,
  onMark,
  onDismiss,
}: StopDetectedBannerProps) {
  const { theme } = useRaceMode();
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: 'absolute',
        bottom: 140,
        left: 16,
        right: 16,
        backgroundColor: theme.overlayBg,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="location-outline" size={24} color={theme.warm} />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 15 }}>
          Pause erkannt
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
          Ort als Stop markieren?
        </Text>
      </View>

      <Pressable
        onPress={onMark}
        style={{
          backgroundColor: theme.accent,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 13 }}>
          Markieren
        </Text>
      </Pressable>

      <Pressable onPress={onDismiss} style={{ marginLeft: 8, padding: 4 }}>
        <Ionicons name="close" size={20} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}
