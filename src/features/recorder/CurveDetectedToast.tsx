import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRaceMode } from '../../contexts/RaceModeContext';
import { CurveHighlight } from '../../types/supabase';

interface CurveDetectedToastProps {
  curve: CurveHighlight | null;
  onDismiss: () => void;
}

function classifyCurve(angle: number): string {
  if (angle > 150) return 'Kehre';
  if (angle >= 90) return 'Scharfe Kurve';
  return 'Kurve';
}

export function CurveDetectedToast({ curve, onDismiss }: CurveDetectedToastProps) {
  const { theme, isRaceMode } = useRaceMode();
  const translateY = useRef(new Animated.Value(100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = curve !== null;
  const accentColor = isRaceMode ? theme.accent : '#00BCD4';

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible, translateY]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visible) {
      timerRef.current = setTimeout(onDismiss, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, curve?.timestamp, onDismiss]);

  if (!visible) return null;

  const label = classifyCurve(curve.curveAngle);

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: 'absolute',
        bottom: 200,
        left: 16,
        right: 16,
        backgroundColor: theme.overlayBg,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="navigate-circle-outline" size={24} color={accentColor} />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: theme.textLight, fontWeight: '700', fontSize: 15 }}>
          {label} erkannt ({curve.curveAngle}&deg;)
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
          {curve.avgSpeedKmh} km/h Durchschnitt
        </Text>
      </View>

      <Pressable onPress={onDismiss} style={{ padding: 4 }}>
        <Ionicons name="close" size={20} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}
