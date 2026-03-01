import React from 'react';
import { TouchableOpacity, Text, type TouchableOpacityProps } from 'react-native';

interface TagChipProps extends TouchableOpacityProps {
  label: string;
  selected?: boolean;
  size?: 'sm' | 'md';
}

export function TagChip({ label, selected = false, size = 'md', ...props }: TagChipProps) {
  const isSmall = size === 'sm';
  return (
    <TouchableOpacity
      {...props}
      className={`rounded-full border mr-2 mb-2 ${
        isSmall ? 'px-3 py-1' : 'px-4 py-2'
      } ${
        selected
          ? 'bg-accent border-accent'
          : 'bg-transparent border-border'
      }`}
    >
      <Text
        className={`font-medium ${isSmall ? 'text-xs' : 'text-sm'} ${
          selected ? 'text-white' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
