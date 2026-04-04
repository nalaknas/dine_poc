import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE_CONFIG: Record<BadgeSize, {
  outer: number;
  border: number;
  fontSize: number;
}> = {
  sm: { outer: 40, border: 3, fontSize: 11 },
  md: { outer: 64, border: 4, fontSize: 16 },
  lg: { outer: 88, border: 5, fontSize: 22 },
};

/** Returns the ring color based on compatibility percentage */
function getCompatibilityColor(score: number): string {
  if (score >= 85) return '#F59E0B'; // gold
  if (score >= 70) return '#10B981'; // green
  if (score >= 50) return '#007AFF'; // blue
  return '#9CA3AF'; // gray
}

interface TasteCompatibilityBadgeProps {
  /** Compatibility score from 0-100. Null means no data available. */
  score: number | null;
  /** Visual size preset */
  size?: BadgeSize;
  /** Whether to show a label below the badge */
  showLabel?: boolean;
}

/**
 * Circular badge showing taste compatibility percentage.
 * Uses a colored border ring with animated opacity on mount.
 * Color-coded by score range: <50% gray, 50-70% blue, 70-85% green, 85%+ gold.
 */
export function TasteCompatibilityBadge({
  score,
  size = 'md',
  showLabel = false,
}: TasteCompatibilityBadgeProps) {
  const config = SIZE_CONFIG[size];
  const animatedOpacity = useSharedValue(0);
  const animatedScale = useSharedValue(0.8);

  useEffect(() => {
    if (score !== null) {
      animatedOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      animatedScale.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [score]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
    transform: [{ scale: animatedScale.value }],
  }));

  if (score === null) {
    return null;
  }

  const color = getCompatibilityColor(score);
  const inner = config.outer - config.border * 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[
          {
            width: config.outer,
            height: config.outer,
            borderRadius: config.outer / 2,
            borderWidth: config.border,
            borderColor: color,
            backgroundColor: `${color}10`,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedContainerStyle,
        ]}
      >
        <Text
          style={{
            fontSize: config.fontSize,
            fontWeight: '700',
            color,
          }}
        >
          {Math.round(score)}%
        </Text>
      </Animated.View>
      {showLabel && (
        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
          Taste Match
        </Text>
      )}
    </View>
  );
}
