import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DishRating } from '../../types';

interface StarDishesProps {
  dishRatings: DishRating[];
}

export function StarDishes({ dishRatings }: StarDishesProps) {
  const starDishes = dishRatings.filter((d) => d.is_star_dish);
  if (starDishes.length === 0) return null;

  return (
    <View className="mx-3 mb-3 bg-background-secondary rounded-xl p-3">
      <View className="flex-row items-center mb-2">
        <Ionicons name="star" size={14} color="#F59E0B" />
        <Text className="text-sm font-semibold text-text-primary ml-1">Star Dishes</Text>
      </View>
      {starDishes.map((dish) => (
        <View key={dish.id} className="flex-row justify-between items-center py-1">
          <Text className="text-sm text-text-primary flex-1 mr-2" numberOfLines={1}>
            {dish.dish_name}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text className="text-sm font-semibold text-gold ml-0.5">
              {dish.rating.toFixed(1)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
