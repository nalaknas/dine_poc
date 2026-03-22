import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { DishRating } from '../../types';

interface GroupedDish {
  dishName: string;
  avgRating: number;
  ratings: { userId: string; displayName: string; rating: number; notes?: string }[];
}

interface StarDishesProps {
  dishRatings: DishRating[];
  /** Map of user_id → display name. Built from post.author + post.tagged_friends. */
  userDisplayNames?: Record<string, string>;
}

const MAX_VISIBLE = 3;

function groupDishRatings(
  dishRatings: DishRating[],
  userDisplayNames: Record<string, string>,
): GroupedDish[] {
  const groups = new Map<string, GroupedDish>();

  for (const r of dishRatings) {
    const key = r.dish_name.toLowerCase().trim();
    const existing = groups.get(key);
    const entry = {
      userId: r.user_id ?? '',
      displayName: userDisplayNames[r.user_id ?? ''] ?? 'Unknown',
      rating: r.rating,
      notes: r.notes,
    };

    if (existing) {
      existing.ratings.push(entry);
      existing.avgRating =
        existing.ratings.reduce((sum, e) => sum + e.rating, 0) / existing.ratings.length;
    } else {
      groups.set(key, {
        dishName: r.dish_name,
        avgRating: r.rating,
        ratings: [entry],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.avgRating - a.avgRating);
}

export function StarDishes({ dishRatings, userDisplayNames = {} }: StarDishesProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedDish, setExpandedDish] = useState<string | null>(null);

  const grouped = groupDishRatings(dishRatings, userDisplayNames);

  // Star dishes: avg >= 7, or fallback to top dish
  let starDishes = grouped.filter((d) => d.avgRating >= 7);
  if (starDishes.length === 0 && grouped.length > 0) {
    const top = grouped[0];
    if (top.avgRating > 0) starDishes = [top];
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
        {visible.map((dish) => {
          const key = dish.dishName.toLowerCase().trim();
          const hasMultipleRaters = dish.ratings.length > 1;
          const isOpen = expandedDish === key;

          return (
            <View key={key}>
              <Pressable
                onPress={hasMultipleRaters ? () => setExpandedDish(isOpen ? null : key) : undefined}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Text
                    style={{ fontSize: 13, color: '#1F2937', flex: 1 }}
                    numberOfLines={1}
                  >
                    {dish.dishName}
                  </Text>
                  {hasMultipleRaters && (
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color="#9CA3AF"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#F59E0B', marginLeft: 2 }}>
                    {dish.avgRating.toFixed(1)}
                  </Text>
                  {hasMultipleRaters && (
                    <Text style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>
                      avg
                    </Text>
                  )}
                </View>
              </Pressable>

              {/* Per-user breakdown */}
              {isOpen && (
                <View style={{ paddingLeft: 12, paddingBottom: 4 }}>
                  {dish.ratings.map((r) => (
                    <View
                      key={r.userId}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        {r.displayName}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#D97706' }}>
                        {r.rating.toFixed(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
