import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={56} color="#D1D5DB" />
      <Text className="text-xl font-semibold text-text-primary mt-4 text-center">{title}</Text>
      <Text className="text-base text-text-secondary mt-2 text-center leading-6">{description}</Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} className="mt-6" />
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <Button
          title={secondaryActionLabel}
          variant="ghost"
          onPress={onSecondaryAction}
          className="mt-2"
        />
      )}
    </View>
  );
}
