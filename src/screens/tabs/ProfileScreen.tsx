import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, Pressable, FlatList, RefreshControl,
  Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { ProfileSkeleton } from '../../components/ui/Skeleton';
import { TierBadge } from '../../components/ui/TierBadge';
import { Shadows } from '../../constants/shadows';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSocialStore } from '../../stores/socialStore';
import { getUserPosts, getTaggedPosts } from '../../services/post-service';
import type { Post } from '../../types';
import { getFollowerCount, getFollowingCount } from '../../services/user-service';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { profile, followersCount, followingCount, setFollowCounts } = useUserProfileStore();
  const { myPosts, setMyPosts } = useSocialStore();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'map' | 'tagged'>('grid');
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [posts, followers, following, tagged] = await Promise.allSettled([
        getUserPosts(user.id, user.id),
        getFollowerCount(user.id),
        getFollowingCount(user.id),
        getTaggedPosts(user.id),
      ]);
      if (posts.status === 'fulfilled') setMyPosts(posts.value);
      if (tagged.status === 'fulfilled') setTaggedPosts(tagged.value);
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

  const header = (
    <View>
      {/* Header bar */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }, Shadows.header]}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937' }}>@{profile?.username ?? ''}</Text>
        <AnimatedPressable onPress={() => navigation.navigate('Settings')} style={{ padding: 4 }}>
          <Ionicons name="settings-outline" size={24} color="#1F2937" />
        </AnimatedPressable>
      </View>

      {/* Gradient banner */}
      <LinearGradient colors={['#EFF6FF', '#FFFFFF']} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={profile?.avatar_url} displayName={profile?.display_name ?? 'Me'} size={72} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { label: 'Meals', value: myPosts.length },
                { label: 'Followers', value: followersCount },
                { label: 'Following', value: followingCount },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    {
                      alignItems: 'center',
                      backgroundColor: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                    },
                    Shadows.sm,
                  ]}
                >
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937' }}>{stat.value}</Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Name + bio */}
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>{profile?.display_name}</Text>
            {profile?.current_tier && <TierBadge tier={profile.current_tier} variant="profile" className="ml-2" />}
          </View>
          {profile?.bio ? (
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{profile.bio}</Text>
          ) : null}
          {profile?.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 2 }}>
                {profile.city}{profile.state ? `, ${profile.state}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Edit profile */}
        <AnimatedPressable
          onPress={() => navigation.navigate('EditProfile')}
          style={[{
            marginTop: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
          }, Shadows.sm]}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>Edit Profile</Text>
        </AnimatedPressable>
      </LinearGradient>

      {/* Grid tabs */}
      <View style={{ borderTopWidth: 0.5, borderTopColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 }}>
          {([
            { key: 'grid' as const, icon: 'grid-outline' },
            { key: 'list' as const, icon: 'list-outline' },
            { key: 'map' as const, icon: 'map-outline' },
            { key: 'tagged' as const, icon: 'pricetag-outline' },
          ]).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: 16,
                paddingBottom: 8,
                borderBottomWidth: activeTab === tab.key ? 2 : 0,
                borderBottomColor: '#1F2937',
              }}
            >
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={activeTab === tab.key ? '#1F2937' : '#9CA3AF'}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  if (isLoading && myPosts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }, Shadows.header]}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937' }}>Profile</Text>
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <FlatList
        data={activeTab === 'tagged' ? taggedPosts : myPosts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ paddingHorizontal: 16, gap: 4 }}
        renderItem={({ item }) => {
          // For tagged tab, check if unrated
          const tagEntry = activeTab === 'tagged'
            ? item.tagged_friends?.find((f) => f.user_id === user?.id)
            : undefined;
          const isUnrated = tagEntry && !tagEntry.has_rated;

          return (
            <AnimatedPressable
              onPress={() => navigation.navigate('MealDetail', { postId: item.id })}
              style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, marginBottom: 4, borderRadius: 8, overflow: 'hidden' }}
            >
              {item.food_photos?.length > 0 ? (
                <Image
                  source={{ uri: item.food_photos[0] }}
                  style={{ flex: 1 }}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={['#F3F4F6', '#E5E7EB']}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="receipt-outline" size={28} color="#9CA3AF" />
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
                    {item.restaurant_name || 'Meal'}
                  </Text>
                </LinearGradient>
              )}
              {/* Unrated badge overlay */}
              {isUnrated && (
                <View style={{
                  position: 'absolute', bottom: 4, right: 4,
                  backgroundColor: '#10B981', borderRadius: 6,
                  paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>RATE</Text>
                </View>
              )}
            </AnimatedPressable>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          activeTab === 'tagged' ? (
            <EmptyState
              icon="pricetag-outline"
              title="No tagged meals"
              description="When friends tag you in their meals, they'll appear here."
            />
          ) : (
            <EmptyState
              icon="restaurant-outline"
              title="No meals yet"
              description="Create your first post to build your dining journal."
              actionLabel="Add Meal"
              onAction={() => navigation.navigate('PostCreation' as any)}
            />
          )
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
