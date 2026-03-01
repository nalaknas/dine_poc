import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { PostCard } from '../../components/post/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useSocialStore } from '../../stores/socialStore';
import { useAuthStore } from '../../stores/authStore';
import { getFeedPosts, likePost, unlikePost } from '../../services/post-service';
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
        await likePost(post.id, user.id, post.author_id);
      }
    } catch {
      // Revert optimistic update
      toggleLike(post.id, user.id);
    }
  }, [user, toggleLike]);

  const handleComment = useCallback((postId: string) => {
    navigation.navigate('Comments', { postId });
  }, [navigation]);

  if (isLoadingFeed && feedPosts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-sm text-text-secondary mt-2">Loading your feed...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-light">
        <Text className="text-2xl font-bold text-text-primary">Dine</Text>
        <View className="flex-row gap-3">
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
        </View>
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
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
