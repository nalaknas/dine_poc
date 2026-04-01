import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import type { LeaderboardEntry, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Medal colors by rank */
const RANK_COLORS: Record<number, string> = {
  1: '#FFD700', // gold
  2: '#C0C0C0', // silver
  3: '#CD7F32', // bronze
};

const DEFAULT_RANK_COLOR = '#9CA3AF';

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
}

export function LeaderboardCard({ entry }: LeaderboardCardProps) {
  const navigation = useNavigation<Nav>();
  const rankColor = RANK_COLORS[entry.rank] ?? DEFAULT_RANK_COLOR;
  const isTopThree = entry.rank <= 3;

  const handlePress = useCallback(() => {
    navigation.navigate('RestaurantDetail', {
      name: entry.restaurant_name,
      city: entry.city || undefined,
    });
  }, [navigation, entry]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        {
          backgroundColor: '#FFFFFF',
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 16,
          padding: 14,
          gap: 10,
        },
        Shadows.card,
      ]}
    >
      {/* Top row: rank + name + score */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Rank circle */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: rankColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: isTopThree ? 18 : 16,
              fontWeight: '800',
              color: isTopThree ? '#FFFFFF' : '#FFFFFF',
            }}
          >
            {entry.rank}
          </Text>
        </View>

        {/* Name + subtitle */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}
            numberOfLines={1}
          >
            {entry.restaurant_name}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
            {[entry.cuisine_type, entry.city].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Score badge */}
        {entry.rank === 1 ? (
          <View style={{ borderRadius: 10, overflow: 'hidden' }}>
            <LinearGradient
              colors={['#F59E0B', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                {entry.leaderboard_score.toFixed(1)}
              </Text>
            </LinearGradient>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: 'rgba(0,122,255,0.1)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#007AFF' }}>
              {entry.leaderboard_score.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Score breakdown row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="star" size={13} color="#F59E0B" />
          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
            {entry.avg_rating.toFixed(1)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="document-text-outline" size={13} color="#6B7280" />
          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
            {entry.post_count} post{entry.post_count !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="people-outline" size={13} color="#6B7280" />
          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
            {entry.unique_visitors} visitor{entry.unique_visitors !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Top dishes */}
      {entry.top_dishes.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 56 }}>
          {entry.top_dishes.map((dish, idx) => (
            <View
              key={dish.dish_name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(245,158,11,0.1)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              {idx === 0 && <Text style={{ fontSize: 11, marginRight: 3 }}>🔥</Text>}
              <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' }}>
                {dish.dish_name}
              </Text>
              <Text style={{ fontSize: 10, color: '#B45309', marginLeft: 4 }}>
                {dish.avg_rating.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </AnimatedPressable>
  );
}
