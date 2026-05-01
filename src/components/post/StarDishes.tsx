import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../ui/Avatar';
import type { DishRating } from '../../types';

export interface UserInfo {
  displayName: string;
  avatarUrl?: string;
}

interface GroupedDish {
  dishName: string;
  avgRating: number;
  ratings: { userId: string; displayName: string; avatarUrl?: string; rating: number; notes?: string }[];
}

interface StarDishesProps {
  dishRatings: DishRating[];
  /** Map of user_id → { displayName, avatarUrl }. Built from post.author + post.tagged_friends. */
  userInfo?: Record<string, UserInfo>;
}

const MAX_VISIBLE = 3;

function groupDishRatings(
  dishRatings: DishRating[],
  userInfo: Record<string, UserInfo>,
): GroupedDish[] {
  const groups = new Map<string, GroupedDish>();

  for (const r of dishRatings) {
    const key = r.dish_name.toLowerCase().trim();
    const existing = groups.get(key);
    const info = userInfo[r.user_id ?? ''];
    const entry = {
      userId: r.user_id ?? '',
      displayName: info?.displayName ?? 'Unknown',
      avatarUrl: info?.avatarUrl,
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

export function StarDishes({ dishRatings, userInfo = {} }: StarDishesProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedDish, setExpandedDish] = useState<string | null>(null);

  const grouped = groupDishRatings(dishRatings, userInfo);

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
    <View style={{ marginHorizontal: 12, marginBottom: 12, borderRadius: 16, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#FFF7E0', '#FCEBB0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Ionicons name="star" size={14} color="#F7B52E" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#6E6A63', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                <Text
                  style={{ fontSize: 14, color: '#0A0A0A', flex: 1, marginRight: 6 }}
                  numberOfLines={1}
                >
                  {dish.dishName}
                </Text>

                {/* Inline avatar stack */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
                  {dish.ratings.slice(0, 3).map((r, i) => (
                    <View key={r.userId} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }}>
                      <Avatar uri={r.avatarUrl} displayName={r.displayName} size={18} />
                    </View>
                  ))}
                  {dish.ratings.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#9B9791', marginLeft: 2 }}>
                      +{dish.ratings.length - 3}
                    </Text>
                  )}
                </View>

                {hasMultipleRaters && (
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color="#9B9791"
                    style={{ marginRight: 4 }}
                  />
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={11} color="#F7B52E" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#DB9C1F', marginLeft: 2 }}>
                    {dish.avgRating.toFixed(1)}
                  </Text>
                  {hasMultipleRaters && (
                    <Text style={{ fontSize: 10, color: '#9B9791', marginLeft: 4 }}>
                      avg
                    </Text>
                  )}
                </View>
              </Pressable>

              {/* Per-user breakdown with avatars */}
              {isOpen && (
                <View style={{ paddingLeft: 4, paddingBottom: 4 }}>
                  {dish.ratings.map((r) => (
                    <View
                      key={r.userId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 3,
                      }}
                    >
                      <Avatar
                        uri={r.avatarUrl}
                        displayName={r.displayName}
                        size={20}
                      />
                      <Text
                        style={{ fontSize: 12, color: '#6E6A63', marginLeft: 6, flex: 1 }}
                        numberOfLines={1}
                      >
                        {r.displayName}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#B07C15' }}>
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
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#B07C15', textAlign: 'center' }}>
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
