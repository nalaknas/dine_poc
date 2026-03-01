import React from 'react';
import { View, Text, Image } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  displayName?: string;
  size?: number;
}

export function Avatar({ uri, displayName, size = 40 }: AvatarProps) {
  const initials = displayName
    ? displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const fontSize = Math.max(size * 0.38, 10);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#E5E7EB',
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#007AFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={{ color: '#fff', fontSize, fontWeight: '600' }}>{initials}</Text>
    </View>
  );
}
