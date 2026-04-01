import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../ui/Avatar';
import type { FriendVisit, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FriendsWhoveBeenHereProps {
  friends: FriendVisit[];
}

/**
 * Prominent friend avatar row with count, shown at top of RestaurantDetailScreen.
 * Tapping an avatar navigates to that friend's profile.
 */
export function FriendsWhoveBeenHere({ friends }: FriendsWhoveBeenHereProps) {
  const navigation = useNavigation<Nav>();

  if (friends.length === 0) return null;

  const friendLabel = friends.length === 1 ? 'friend has' : 'friends have';

  return (
    <View className="mx-4 mb-4 bg-accent/5 rounded-2xl p-4">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className="bg-accent/15 rounded-full p-1.5">
          <Ionicons name="people" size={16} color="#007AFF" />
        </View>
        <Text className="text-sm font-bold text-accent ml-2">
          {friends.length} {friendLabel} been here
        </Text>
      </View>

      {/* Avatar row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {friends.map((friend) => (
            <TouchableOpacity
              key={friend.userId}
              onPress={() => navigation.navigate('UserProfile', { userId: friend.userId })}
              className="items-center"
            >
              <View className="relative">
                <Avatar
                  uri={friend.avatarUrl}
                  displayName={friend.displayName}
                  size={48}
                />
                {/* Rating badge overlaid on avatar */}
                {friend.latestRating > 0 && (
                  <View className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 border border-gray-100">
                    <Text className="text-[10px] font-bold text-gold">
                      {friend.latestRating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                className="text-xs text-text-primary font-medium mt-1.5 max-w-[56px]"
                numberOfLines={1}
              >
                {friend.displayName.split(' ')[0]}
              </Text>
              {friend.visitCount > 1 && (
                <Text className="text-[10px] text-text-secondary">
                  {friend.visitCount}x
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
