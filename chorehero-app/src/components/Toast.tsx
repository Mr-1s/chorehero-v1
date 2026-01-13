import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../utils/constants';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const getIconForType = (type: ToastType): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (type) {
    case 'success':
      return { name: 'checkmark-circle', color: '#10B981' };
    case 'warning':
      return { name: 'warning', color: '#F59E0B' };
    case 'error':
      return { name: 'close-circle', color: '#EF4444' };
    case 'info':
    default:
      return { name: 'information-circle', color: '#3B82F6' };
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(({ message, type = 'info', durationMs = 3000 }: ToastOptions) => {
    setMessage(message);
    setType(type);
    setVisible(true);

    if (hideTimeout.current) clearTimeout(hideTimeout.current);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();

    hideTimeout.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 100, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }, durationMs);
  }, [opacity, translateY, scale]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const icon = getIconForType(type);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {visible && (
        <Animated.View style={[styles.container, { transform: [{ translateY }, { scale }], opacity }]}> 
          <View style={[styles.toast, styles[type]]}>
            <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
              <Ionicons name={icon.name} size={22} color={icon.color} />
            </View>
            <Text style={styles.text} numberOfLines={2}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110, // Above floating nav
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  success: { borderColor: 'rgba(16,185,129,0.25)', borderLeftWidth: 4, borderLeftColor: '#10B981' },
  warning: { borderColor: 'rgba(245,158,11,0.25)', borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  error: { borderColor: 'rgba(239,68,68,0.25)', borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  info: { borderColor: 'rgba(59,130,246,0.25)', borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
});


