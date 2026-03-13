import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Shadows } from '../../constants/shadows';

interface AvatarProps {
  uri?: string | null;
  displayName?: string;
  size?: number;
}

export function Avatar({ uri, displayName, size = 40 }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const initials = displayName
    ? displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const fontSize = Math.max(size * 0.38, 10);
  const borderWidth = size >= 40 ? 2 : 1.5;

  if (uri) {
    return (
      <View
        style={[
          {
            width: size + borderWidth * 2,
            height: size + borderWidth * 2,
            borderRadius: (size + borderWidth * 2) / 2,
            borderWidth,
            borderColor: '#FFFFFF',
            backgroundColor: '#E5E7EB',
          },
          Shadows.sm,
        ]}
      >
        <Image
          source={{ uri }}
          onLoad={() => setLoaded(true)}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
        {loaded && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size + borderWidth * 2,
          height: size + borderWidth * 2,
          borderRadius: (size + borderWidth * 2) / 2,
          borderWidth,
          borderColor: '#FFFFFF',
          overflow: 'hidden',
        },
        Shadows.sm,
      ]}
    >
      <LinearGradient
        colors={['#007AFF', '#5856D6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize, fontWeight: '600' }}>{initials}</Text>
      </LinearGradient>
    </View>
  );
}
