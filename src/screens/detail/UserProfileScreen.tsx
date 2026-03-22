import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { getUserById } from '../../services/auth-service';
import { getUserPosts, getTaggedPosts } from '../../services/post-service';
import {
  isFollowing, followUser, unfollowUser,
  getFollowerCount, getFollowingCount,
} from '../../services/user-service';
import type { User, Post, RootStackParamList } from '../../types';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 3;

type ProfileRoute = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const { params } = useRoute<ProfileRoute>();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { setIsFollowing, isFollowing: followMap } = useUserProfileStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grid' | 'tagged'>('grid');

  const isMe = user?.id === params.userId;
  const currentlyFollowing = followMap[params.userId] ?? false;

  useEffect(() => {
    load();
  }, [params.userId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [u, userPosts, followersCount, followingCount, followingStatus, tagged] = await Promise.all([
        getUserById(params.userId),
        getUserPosts(params.userId, user?.id),
        getFollowerCount(params.userId),
        getFollowingCount(params.userId),
        user && !isMe ? isFollowing(user.id, params.userId) : Promise.resolve(false),
        getTaggedPosts(params.userId),
      ]);
      setProfile(u);
      setPosts(userPosts);
      setTaggedPosts(tagged);
      setFollowers(followersCount);
      setFollowing(followingCount);
      if (!isMe) setIsFollowing(params.userId, followingStatus);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || isMe) return;
    const prev = currentlyFollowing;
    setIsFollowing(params.userId, !prev);
    setFollowers((f) => f + (prev ? -1 : 1));
    try {
      if (prev) {
        await unfollowUser(user.id, params.userId);
      } else {
        await followUser(user.id, params.userId);
      }
    } catch {
      setIsFollowing(params.userId, prev);
      setFollowers((f) => f + (prev ? 1 : -1));
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={activeTab === 'tagged' ? taggedPosts : posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={
          <View>
            {/* Profile info */}
            <View className="px-4 py-4">
              <View className="flex-row items-center">
                <Avatar uri={profile?.avatar_url} displayName={profile?.display_name ?? 'User'} size={72} />
                <View className="flex-1 ml-4">
                  <View className="flex-row justify-around">
                    {[
                      { label: 'Meals', value: posts.length },
                      { label: 'Followers', value: followers },
                      { label: 'Following', value: following },
                    ].map((stat) => (
                      <View key={stat.label} className="items-center">
                        <Text className="text-xl font-bold text-text-primary">{stat.value}</Text>
                        <Text className="text-xs text-text-secondary">{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View className="mt-3">
                <Text className="text-base font-semibold text-text-primary">{profile?.display_name}</Text>
                {profile?.bio ? <Text className="text-sm text-text-secondary mt-0.5">{profile.bio}</Text> : null}
                {profile?.city && (
                  <Text className="text-xs text-text-secondary mt-1">📍 {profile.city}{profile.state ? `, ${profile.state}` : ''}</Text>
                )}
              </View>

              {/* Follow button */}
              {!isMe && (
                <TouchableOpacity
                  onPress={handleFollowToggle}
                  className={`mt-3 rounded-lg py-2 items-center border ${
                    currentlyFollowing ? 'border-border' : 'bg-accent border-accent'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${currentlyFollowing ? 'text-text-primary' : 'text-white'}`}>
                    {currentlyFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="border-t border-border-light py-2 px-4 flex-row" style={{ gap: 24 }}>
              <TouchableOpacity onPress={() => setActiveTab('grid')}>
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color={activeTab === 'grid' ? '#1F2937' : '#9CA3AF'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('tagged')}>
                <Ionicons
                  name="pricetag-outline"
                  size={22}
                  color={activeTab === 'tagged' ? '#1F2937' : '#9CA3AF'}
                />
              </TouchableOpacity>
            </View>
          </View>
        }
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
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
