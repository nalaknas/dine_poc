import React, { useCallback } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface LikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onToggle: () => void;
}

export function LikeButton({ isLiked, likeCount, onToggle }: LikeButtonProps) {
  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }, [onToggle]);

  return (
    <TouchableOpacity onPress={handlePress} className="flex-row items-center">
      <Ionicons
        name={isLiked ? 'heart' : 'heart-outline'}
        size={24}
        color={isLiked ? '#EF4444' : '#6B7280'}
      />
      {likeCount > 0 && (
        <Text className="text-sm text-text-secondary ml-1">{likeCount}</Text>
      )}
    </TouchableOpacity>
  );
}
