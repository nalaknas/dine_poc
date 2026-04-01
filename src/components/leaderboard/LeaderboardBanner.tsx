import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LeaderboardBannerProps {
  /** Optional city to pre-filter the leaderboard */
  city?: string;
}

export function LeaderboardBanner({ city }: LeaderboardBannerProps) {
  const navigation = useNavigation<Nav>();

  const handlePress = useCallback(() => {
    navigation.navigate('Leaderboard', { city });
  }, [navigation, city]);

  return (
    <AnimatedPressable onPress={handlePress} style={[{ marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden' }, Shadows.card]}>
      <LinearGradient
        colors={['#007AFF', '#5856D6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trophy" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            Top 10{city ? ` in ${city}` : ' Restaurants'}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            See this month's rankings
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
      </LinearGradient>
    </AnimatedPressable>
  );
}
