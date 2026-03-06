import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
      <Animated.View style={floatStyle}>
        <LinearGradient
          colors={['#007AFF', '#5856D6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 100,
            height: 100,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={48} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937', marginTop: 20, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>{description}</Text>
      {actionLabel && onAction && (
        <View style={{ marginTop: 24 }}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <View style={{ marginTop: 8 }}>
          <Button title={secondaryActionLabel} variant="ghost" onPress={onSecondaryAction} />
        </View>
      )}
    </View>
  );
}
