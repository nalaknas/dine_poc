import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { PhotoCarousel } from '../../components/post/PhotoCarousel';
import { StarDishes } from '../../components/post/StarDishes';
import { LikeButton } from '../../components/post/LikeButton';
import { useAuthStore } from '../../stores/authStore';
import { useSocialStore } from '../../stores/socialStore';
import { getPost, likePost, unlikePost } from '../../services/post-service';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo, formatCurrency } from '../../utils/format';
import type { Post, Comment, RootStackParamList } from '../../types';

type DetailRoute = RouteProp<RootStackParamList, 'MealDetail'>;

export function MealDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { toggleLike } = useSocialStore();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [params.postId]);

  const loadPost = async () => {
    const p = await getPost(params.postId, user?.id);
    setPost(p);
    setIsLoading(false);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, author:users!comments_author_id_fkey(*)')
      .eq('post_id', params.postId)
      .order('created_at', { ascending: true })
      .limit(50);
    setComments((data ?? []) as Comment[]);
  };

  const handleLike = useCallback(async () => {
    if (!post || !user) return;
    toggleLike(post.id, user.id);
    setPost((p) =>
      p
        ? {
            ...p,
            is_liked: !p.is_liked,
            like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1,
          }
        : null
    );
    try {
      if (post.is_liked) {
        await unlikePost(post.id, user.id);
      } else {
        await likePost(post.id, user.id, post.author_id);
      }
    } catch {
      toggleLike(post.id, user.id);
    }
  }, [post, user]);

  const handleComment = async () => {
    if (!commentText.trim() || !user || !post) return;
    setIsCommenting(true);
    const text = commentText.trim();
    setCommentText('');
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: post.id, author_id: user.id, content: text })
        .select('*, author:users!comments_author_id_fkey(*)')
        .single();
      if (!error && data) {
        setComments((prev) => [...prev, data as Comment]);
        setPost((p) => p ? { ...p, comment_count: p.comment_count + 1 } : null);
      }
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setIsCommenting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-text-secondary">Post not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Author */}
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: post.author_id })}
            className="flex-row items-center px-4 py-3"
          >
            <Avatar uri={post.author?.avatar_url} displayName={post.author?.display_name ?? 'User'} size={40} />
            <View className="ml-2 flex-1">
              <Text className="text-base font-semibold text-text-primary">{post.author?.username}</Text>
              <Text className="text-sm text-accent">{post.restaurant_name}</Text>
            </View>
            {post.author_id === user?.id && (
              <TouchableOpacity onPress={() => navigation.navigate('EditPost', { postId: post.id })}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Photos */}
          {post.food_photos.length > 0 && <PhotoCarousel photos={post.food_photos} />}

          {/* Actions */}
          <View className="flex-row items-center px-4 pt-3 gap-4">
            <LikeButton isLiked={post.is_liked ?? false} likeCount={post.like_count} onToggle={handleLike} />
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <Ionicons name="paper-plane-outline" size={24} color="#6B7280" />
          </View>

          {/* Caption */}
          <View className="px-4 pt-2">
            <Text className="text-base text-text-primary">
              <Text className="font-semibold">{post.author?.username} </Text>
              {post.caption}
            </Text>
          </View>

          {/* Star dishes */}
          {post.dish_ratings && <StarDishes dishRatings={post.dish_ratings} />}

          {/* Bill split info */}
          {post.tagged_friends && post.tagged_friends.length > 0 && (
            <View className="mx-4 mb-3 bg-background-secondary rounded-xl p-3">
              <Text className="text-sm font-semibold text-text-secondary mb-2">BILL SPLIT</Text>
              {post.tagged_friends.map((f) => (
                <View key={f.id} className="flex-row justify-between py-1">
                  <Text className="text-sm text-text-primary">{f.display_name}</Text>
                  {f.amount_owed ? (
                    <Text className="text-sm font-semibold text-accent">
                      {formatCurrency(f.amount_owed)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <View className="flex-row flex-wrap px-4 mb-3">
              {post.tags.map((tag) => (
                <Text key={tag} className="text-sm text-accent mr-2">#{tag}</Text>
              ))}
            </View>
          )}

          {/* Timestamp */}
          <Text className="px-4 mb-4 text-xs text-text-secondary">{formatTimeAgo(post.created_at)}</Text>

          {/* Comments */}
          <View className="border-t border-border-light px-4 pt-4">
            <Text className="text-base font-semibold text-text-primary mb-3">Comments</Text>
            {comments.map((c) => (
              <View key={c.id} className="flex-row mb-3">
                <Avatar uri={c.author?.avatar_url} displayName={c.author?.display_name ?? 'User'} size={32} />
                <View className="flex-1 ml-2">
                  <Text className="text-sm text-text-primary">
                    <Text className="font-semibold">{c.author?.username ?? 'user'} </Text>
                    {c.content}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-0.5">{formatTimeAgo(c.created_at)}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 && (
              <Text className="text-sm text-text-secondary mb-4">Be the first to comment.</Text>
            )}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View className="flex-row items-center px-4 py-3 border-t border-border-light">
          <Avatar uri={undefined} displayName={user?.email ?? 'Me'} size={32} />
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 mx-3 text-base text-text-primary"
            returnKeyType="send"
            onSubmitEditing={handleComment}
          />
          <TouchableOpacity onPress={handleComment} disabled={!commentText.trim() || isCommenting}>
            <Ionicons
              name="send"
              size={22}
              color={commentText.trim() ? '#007AFF' : '#D1D5DB'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
