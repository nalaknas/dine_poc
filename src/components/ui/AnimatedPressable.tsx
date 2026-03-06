import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends PressableProps {
  /** How far to scale down on press (default 0.97) */
  scaleValue?: number;
}

/**
 * A Pressable that scales down on press with a spring animation.
 * Drop-in replacement for Pressable — pass style / className as usual.
 */
export function AnimatedPressable({
  scaleValue = 0.97,
  onPressIn,
  onPressOut,
  style,
  children,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={(e) => {
        scale.value = withSpring(scaleValue, { damping: 15, stiffness: 300 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
