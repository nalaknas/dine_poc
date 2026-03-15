import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

type ToastType = 'error' | 'success' | 'info';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastConfig {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  showToast: (config: Omit<ToastConfig, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
};

const BG_MAP: Record<ToastType, string> = {
  error: '#EF4444',
  success: '#10B981',
  info: '#007AFF',
};

const DEFAULT_DURATION = 3500;

function Toast({ toast, onDismiss }: { toast: ToastConfig; onDismiss: () => void }) {
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(80, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    timerRef.current = setTimeout(dismiss, toast.duration ?? DEFAULT_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleAction = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    toast.action?.onPress();
    dismiss();
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 90,
          left: 16,
          right: 16,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={dismiss}
        style={{
          backgroundColor: BG_MAP[toast.type],
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name={ICON_MAP[toast.type]} size={20} color="#fff" />
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '500',
            flex: 1,
            marginLeft: 8,
          }}
        >
          {toast.message}
        </Text>
        {toast.action && (
          <Pressable
            onPress={handleAction}
            style={{
              marginLeft: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
              {toast.action.label}
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastConfig[]>([]);

  const showToast = useCallback((config: Omit<ToastConfig, 'id'>) => {
    const id = `${Date.now()}_${Math.random()}`;
    setQueue((prev) => [...prev, { ...config, id }]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const current = queue[0] ?? null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {current && (
        <Toast key={current.id} toast={current} onDismiss={dismissCurrent} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
