import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { TasteCompatibilityBadge } from './TasteCompatibilityBadge';
import { Shadows } from '../../constants/shadows';
import type { DishRecommendation } from '../../types';

interface DishRecommendationCardProps {
  recommendation: DishRecommendation;
  onPress?: () => void;
}

/** Horizontal card showing a recommended dish with match score and social proof. */
export function DishRecommendationCard({ recommendation, onPress }: DishRecommendationCardProps) {
  const { dish_name, restaurant_name, city, avg_rating, recommender_count, match_score } =
    recommendation;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 14,
          gap: 12,
        },
        Shadows.card,
      ]}
    >
      {/* Match score badge */}
      <TasteCompatibilityBadge score={match_score} size="sm" />

      {/* Dish info */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
          {dish_name}
        </Text>
        <Text style={{ fontSize: 13, color: '#6B7280' }} numberOfLines={1}>
          {restaurant_name}
          {city ? ` \u00B7 ${city}` : ''}
        </Text>

        {/* Rating + social proof row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
          {/* Star rating */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1F2937' }}>
              {(avg_rating ?? 0).toFixed(1)}
            </Text>
          </View>

          {/* Social proof */}
          {recommender_count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="people-outline" size={13} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                {recommender_count} {recommender_count === 1 ? 'friend' : 'friends'} loved this
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </AnimatedPressable>
  );
}
