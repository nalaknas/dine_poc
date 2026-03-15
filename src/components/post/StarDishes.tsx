import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { DishRating } from '../../types';

interface StarDishesProps {
  dishRatings: DishRating[];
}

const MAX_VISIBLE = 3;

export function StarDishes({ dishRatings }: StarDishesProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort all dishes by rating descending
  const sorted = [...dishRatings].sort((a, b) => b.rating - a.rating);

  // Filter star dishes (sorted) or fall back to top-rated
  let starDishes = sorted.filter((d) => d.is_star_dish);
  if (starDishes.length === 0 && sorted.length > 0) {
    const top = sorted[0];
    if (top.rating > 0) starDishes = [top];
  }

  if (starDishes.length === 0) return null;

  const hasMore = starDishes.length > MAX_VISIBLE;
  const visible = expanded ? starDishes : starDishes.slice(0, MAX_VISIBLE);

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
        {visible.map((dish) => (
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
        {hasMore && (
          <Pressable
            onPress={() => setExpanded((prev) => !prev)}
            style={{ paddingTop: 6 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#D97706', textAlign: 'center' }}>
              {expanded
                ? 'Show less'
                : `Show ${starDishes.length - MAX_VISIBLE} more`}
            </Text>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}
