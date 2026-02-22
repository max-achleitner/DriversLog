/**
 * ToastContext.tsx
 *
 * Global, app-wide toast/notification system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ type: 'success', message: 'Route gespeichert!' });
 *   showToast({ type: 'error',   message: 'Fehler beim Speichern.' });
 *
 * Toast types: 'success' | 'error' | 'warning' | 'info'
 * Auto-dismiss: 3 s (errors: 5 s). Tap to dismiss manually.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type: ToastType;
  message: string;
  /** Override auto-dismiss duration in ms. Default: 3000 (errors: 5000). */
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

// ── Config ────────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }
> = {
  success: { icon: 'checkmark-circle', bg: '#1A4731', text: '#D1FAE5' },
  error:   { icon: 'close-circle',     bg: '#7F1D1D', text: '#FEE2E2' },
  warning: { icon: 'warning',          bg: '#78350F', text: '#FEF3C7' },
  info:    { icon: 'information-circle', bg: '#1B3A4B', text: '#DBEAFE' },
};

// ── ToastItem component ───────────────────────────────────────────────────────

interface ToastItemProps {
  options: ToastOptions;
  onDismiss: () => void;
}

function ToastItem({ options, onDismiss }: ToastItemProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const config = TOAST_CONFIG[options.type];

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 9,
    }).start();
  }, [translateY]);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: insets.top + 8,
          backgroundColor: config.bg,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={styles.toastPressable}
        accessibilityRole="button"
        accessibilityLabel="Benachrichtigung schließen"
      >
        <Ionicons name={config.icon} size={22} color={config.text} style={styles.icon} />
        <Text style={[styles.toastText, { color: config.text }]} numberOfLines={3}>
          {options.message}
        </Text>
        <Ionicons name="close" size={18} color={config.text} style={styles.closeIcon} />
      </Pressable>
    </Animated.View>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      // Cancel any existing timer so back-to-back toasts work correctly
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setActiveToast(options);

      const duration = options.duration ?? (options.type === 'error' ? 5000 : 3000);
      timerRef.current = setTimeout(dismiss, duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={styles.root}>
        {children}
        {activeToast !== null && (
          <ToastItem options={activeToast} onDismiss={dismiss} />
        )}
      </View>
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 99,
    zIndex: 9999,
  },
  toastPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeIcon: {
    marginLeft: 8,
    opacity: 0.7,
    flexShrink: 0,
  },
});
