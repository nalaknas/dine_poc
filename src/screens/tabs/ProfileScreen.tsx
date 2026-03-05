import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl,
  Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSocialStore } from '../../stores/socialStore';
import { getUserPosts } from '../../services/post-service';
import { getFollowerCount, getFollowingCount } from '../../services/user-service';
import type { Post, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 3;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuthStore();
  const { profile, followersCount, followingCount, setFollowCounts } = useUserProfileStore();
  const { myPosts, setMyPosts } = useSocialStore();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [posts, followers, following] = await Promise.allSettled([
        getUserPosts(user.id, user.id),
        getFollowerCount(user.id),
        getFollowingCount(user.id),
      ]);
      if (posts.status === 'fulfilled') {
        setMyPosts(posts.value);
      }
      setFollowCounts(
        followers.status === 'fulfilled' ? followers.value : 0,
        following.status === 'fulfilled' ? following.value : 0,
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    signOut();
  };

  const header = (
    <View>
      {/* Header bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-light">
        <Text className="text-xl font-bold text-text-primary">@{profile?.username ?? ''}</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile info */}
      <View className="px-4 py-4">
        <View className="flex-row items-center">
          <Avatar uri={profile?.avatar_url} displayName={profile?.display_name ?? 'Me'} size={72} />
          <View className="flex-1 ml-4">
            <View className="flex-row justify-around">
              {[
                { label: 'Meals', value: profile?.total_meals ?? 0 },
                { label: 'Followers', value: followersCount },
                { label: 'Following', value: followingCount },
              ].map((stat) => (
                <View key={stat.label} className="items-center">
                  <Text className="text-xl font-bold text-text-primary">{stat.value}</Text>
                  <Text className="text-xs text-text-secondary">{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Name + bio */}
        <View className="mt-3">
          <Text className="text-base font-semibold text-text-primary">{profile?.display_name}</Text>
          {profile?.bio ? (
            <Text className="text-sm text-text-secondary mt-0.5">{profile.bio}</Text>
          ) : null}
          {profile?.city && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={13} color="#9CA3AF" />
              <Text className="text-xs text-text-secondary ml-0.5">
                {profile.city}{profile.state ? `, ${profile.state}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Edit profile */}
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          className="mt-3 border border-border rounded-lg py-2 items-center"
        >
          <Text className="text-sm font-semibold text-text-primary">Edit Profile</Text>
        </TouchableOpacity>

        {/* Taste recommendations CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Recommendations')}
          className="mt-2 bg-accent/10 border border-accent/20 rounded-lg py-2 items-center flex-row justify-center"
        >
          <Ionicons name="sparkles" size={16} color="#007AFF" />
          <Text className="text-sm font-semibold text-accent ml-1">For You</Text>
        </TouchableOpacity>
      </View>

      {/* Grid header */}
      <View className="border-t border-border-light">
        <View className="flex-row justify-around py-2">
          <View className="items-center pb-1 border-b-2 border-text-primary px-4">
            <Ionicons name="grid-outline" size={22} color="#1F2937" />
          </View>
        </View>
      </View>
    </View>
  );

  if (isLoading && myPosts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={myPosts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('MealDetail', { postId: item.id })}
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, padding: 1 }}
          >
            {item.food_photos?.length > 0 ? (
              <Image
                source={{ uri: item.food_photos[0] }}
                style={{ flex: 1 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt-outline" size={28} color="#9CA3AF" />
                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
                  {item.restaurant_name || 'Meal'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            title="No meals yet"
            description="Create your first post to build your dining journal."
            actionLabel="Add Meal"
            onAction={() => navigation.navigate('PostCreation' as any)}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
