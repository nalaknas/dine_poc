import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../ui/Avatar';
import type { FriendVisit, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FriendStarDishesProps {
  friends: FriendVisit[];
}

/** Rating color matching RestaurantDetailScreen convention */
function ratingColor(r: number): string {
  if (r >= 8) return '#22C55E';
  if (r >= 6) return '#F59E0B';
  if (r >= 4) return '#F97316';
  return '#EF4444';
}

function ratingBg(r: number): string {
  if (r >= 8) return 'bg-green-500/10';
  if (r >= 6) return 'bg-gold/10';
  if (r >= 4) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

/**
 * Shows inline friend star dishes and ratings on RestaurantDetailScreen.
 * Each friend who has star dishes is displayed as a compact row.
 */
export function FriendStarDishes({ friends }: FriendStarDishesProps) {
  const navigation = useNavigation<Nav>();

  // Only show friends that actually have star dishes
  const friendsWithDishes = friends.filter((f) => f.starDishes.length > 0);
  if (friendsWithDishes.length === 0) return null;

  return (
    <View className="mx-4 mb-4">
      <View className="flex-row items-center mb-3">
        <Ionicons name="sparkles" size={18} color="#F59E0B" />
        <Text className="text-lg font-bold text-text-primary ml-2">
          Friends' Top Picks
        </Text>
      </View>

      {friendsWithDishes.map((friend) => (
        <View
          key={friend.userId}
          className="bg-background-secondary rounded-xl p-3 mb-2"
        >
          {/* Friend header */}
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: friend.userId })}
            className="flex-row items-center mb-2"
          >
            <Avatar
              uri={friend.avatarUrl}
              displayName={friend.displayName}
              size={28}
            />
            <Text className="text-sm font-semibold text-text-primary ml-2">
              {friend.displayName}
            </Text>
            <Text className="text-xs text-text-secondary ml-1">
              rated {friend.latestRating.toFixed(1)} overall
            </Text>
          </TouchableOpacity>

          {/* Star dishes */}
          <View className="flex-row flex-wrap gap-2">
            {friend.starDishes.map((dish) => (
              <View
                key={`${friend.userId}-${dish.dishName}`}
                className={`flex-row items-center px-2.5 py-1.5 rounded-full ${ratingBg(dish.rating)}`}
              >
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text className="text-xs font-medium text-text-primary ml-1">
                  {dish.dishName}
                </Text>
                <Text
                  className="text-xs font-bold ml-1.5"
                  style={{ color: ratingColor(dish.rating) }}
                >
                  {dish.rating.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
