import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { DishRating } from '../../types';

interface StarDishesProps {
  dishRatings: DishRating[];
}

export function StarDishes({ dishRatings }: StarDishesProps) {
  const starDishes = dishRatings.filter((d) => d.is_star_dish);
  if (starDishes.length === 0) return null;

  return (
    <View style={{ marginHorizontal: 12, marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#FEF3C7', '#FFFBEB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937', marginLeft: 4 }}>
            Star Dishes
          </Text>
        </View>
        {starDishes.map((dish) => (
          <View
            key={dish.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 4,
            }}
          >
            <Text
              style={{ fontSize: 13, color: '#1F2937', flex: 1, marginRight: 8 }}
              numberOfLines={1}
            >
              {dish.dish_name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#F59E0B', marginLeft: 2 }}>
                {dish.rating.toFixed(1)}
              </Text>
            </View>
          </View>
        ))}
      </LinearGradient>
    </View>
  );
}
