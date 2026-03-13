import React, { useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

interface LikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onToggle: () => void;
}

export function LikeButton({ isLiked, likeCount, onToggle }: LikeButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    onToggle();
  }, [onToggle]);

  return (
    <Pressable onPress={handlePress} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={24}
          color={isLiked ? '#EF4444' : '#6B7280'}
        />
      </Animated.View>
      {likeCount > 0 && (
        <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }}>{likeCount}</Text>
      )}
    </Pressable>
  );
}
