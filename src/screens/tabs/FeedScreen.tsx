import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PostCard } from '../../components/post/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { FeedSkeleton } from '../../components/ui/Skeleton';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import { useSocialStore } from '../../stores/socialStore';
import { useAuthStore } from '../../stores/authStore';
import { getFeedPosts, likePost, unlikePost } from '../../services/post-service';
import { trackPostLiked } from '../../lib/analytics';
import type { Post, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { feedPosts, setFeedPosts, toggleLike, isLoadingFeed, setLoadingFeed } = useSocialStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingFeed(true);
      const posts = await getFeedPosts(user.id);
      setFeedPosts(posts);
    } catch (err) {
      console.warn('Feed load error:', err);
    } finally {
      setLoadingFeed(false);
    }
  }, [user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = useCallback(async (post: Post) => {
    if (!user) return;
    toggleLike(post.id, user.id);
    try {
      if (post.is_liked) {
        await unlikePost(post.id, user.id);
      } else {
        trackPostLiked(post.id, post.author_id);
        await likePost(post.id, user.id, post.author_id);
      }
    } catch {
      toggleLike(post.id, user.id);
    }
  }, [user, toggleLike]);

  const handleComment = useCallback((postId: string) => {
    navigation.navigate('Comments', { postId });
  }, [navigation]);

  if (isLoadingFeed && feedPosts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }, Shadows.header]}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937' }}>Dine</Text>
        </View>
        <FeedSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }, Shadows.header]}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937' }}>Dine</Text>
        <AnimatedPressable
          onPress={() => navigation.navigate('Activity' as any)}
          style={{ padding: 4 }}
        >
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
        </AnimatedPressable>
      </View>

      <FlatList
        data={feedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => handleLike(item)}
            onComment={() => handleComment(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            title="No posts yet"
            description="Follow friends to see their dining experiences here."
            actionLabel="Discover Friends"
            onAction={() => navigation.navigate('Main' as any)}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}
