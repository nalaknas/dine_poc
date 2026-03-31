import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
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
import {
  getPost, likePost, unlikePost, notifyTaggedParticipants,
  addTaggedUserPhoto, toggleDishEndorsement, getDishEndorsements,
} from '../../services/post-service';
import { uploadFoodPhoto } from '../../services/receipt-service';
import { createNotification } from '../../services/user-service';
import { supabase } from '../../lib/supabase';
import { MentionText } from '../../components/ui/MentionText';
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
  const [endorsements, setEndorsements] = useState<Record<string, { user_id: string; emoji: string }[]>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Tagged user state
  const isTaggedUser = post?.tagged_friends?.some(
    (f) => f.user_id === user?.id && f.user_id !== post.author_id,
  ) ?? false;
  const hasRated = post?.tagged_friends?.find(
    (f) => f.user_id === user?.id,
  )?.has_rated ?? false;

  // Build userId → user info map for StarDishes grouping + avatars
  const userInfo: Record<string, { displayName: string; avatarUrl?: string }> = {};
  if (post?.author) {
    userInfo[post.author_id] = {
      displayName: post.author.display_name ?? post.author.username ?? 'Author',
      avatarUrl: post.author.avatar_url,
    };
  }
  for (const f of post?.tagged_friends ?? []) {
    if (f.user_id && f.display_name) {
      userInfo[f.user_id] = {
        displayName: f.display_name,
        avatarUrl: f.user?.avatar_url,
      };
    }
  }

  // Current user's own ratings on this post
  const myRatings = (post?.dish_ratings ?? []).filter((r) => r.user_id === user?.id);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [params.postId]);

  const loadPost = async () => {
    const p = await getPost(params.postId, user?.id);
    setPost(p);
    setIsLoading(false);

    // Load endorsements for dish ratings
    if (p?.dish_ratings && p.dish_ratings.length > 0) {
      const ratingIds = p.dish_ratings.filter((r) => r.id).map((r) => r.id);
      if (ratingIds.length > 0) {
        getDishEndorsements(ratingIds).then(setEndorsements).catch(() => {});
      }
    }
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

  const handleAddPhoto = async () => {
    if (!user || !post) return;
    // Use launchImageLibrary via expo-image-picker
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsUploadingPhoto(true);
      const url = await uploadFoodPhoto(result.assets[0].uri, user.id, `contrib_${Date.now()}.jpg`);
      await addTaggedUserPhoto(post.id, user.id, url);
      await loadPost(); // refresh to show new photo
    } catch {
      // silent
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleEndorsement = async (dishRatingId: string, emoji: string) => {
    if (!user) return;
    const added = await toggleDishEndorsement(dishRatingId, user.id, emoji);
    setEndorsements((prev) => {
      const current = prev[dishRatingId] ?? [];
      if (added) {
        return { ...prev, [dishRatingId]: [...current, { user_id: user.id, emoji }] };
      }
      return { ...prev, [dishRatingId]: current.filter((e) => e.user_id !== user.id) };
    });
  };

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

        // Notify post author (skip self)
        if (post.author_id !== user.id) {
          createNotification({
            userId: post.author_id,
            type: 'comment',
            fromUserId: user.id,
            postId: post.id,
            message: 'commented on your post',
          });
        }
        // Notify tagged meal participants
        notifyTaggedParticipants(post.id, user.id, 'comment', 'commented on a post you were part of');
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

          {/* Tagged user rate banner */}
          {isTaggedUser && !hasRated && (
            <TouchableOpacity
              onPress={() => navigation.navigate('TaggedRate', { postId: post.id })}
              className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-3 flex-row items-center"
            >
              <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center mr-3">
                <Ionicons name="restaurant" size={16} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">You dined here!</Text>
                <Text className="text-xs text-text-secondary">Rate this meal to build your taste profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#10B981" />
            </TouchableOpacity>
          )}

          {/* Your Ratings card (already rated) */}
          {isTaggedUser && hasRated && myRatings.length > 0 && (
            <View className="mx-4 mb-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                <Text className="text-sm font-semibold text-text-primary ml-1">Your Ratings</Text>
              </View>
              <View className="flex-row flex-wrap">
                {myRatings.map((r) => (
                  <Text key={r.id} className="text-xs text-text-secondary mr-3 mb-1">
                    {r.dish_name}: <Text className="font-semibold text-text-primary">{r.rating}</Text>
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('TaggedRate', { postId: post.id })}
                className="mt-2 flex-row items-center justify-end"
              >
                <Text className="text-xs font-semibold text-accent mr-1">Edit Ratings</Text>
                <Ionicons name="chevron-forward" size={14} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Photos (including contributed photos from tagged users) */}
          {(() => {
            const contributedPhotos = (post.tagged_friends ?? []).flatMap(
              (f) => f.contributed_photos ?? [],
            );
            const allPhotos = [...post.food_photos, ...contributedPhotos];
            return allPhotos.length > 0 ? (
              <PhotoCarousel photos={allPhotos} photoLabels={post.photo_labels} />
            ) : null;
          })()}

          {/* Actions */}
          <View className="flex-row items-center px-4 pt-3 gap-4">
            <LikeButton isLiked={post.is_liked ?? false} likeCount={post.like_count} onToggle={handleLike} />
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <Ionicons name="paper-plane-outline" size={24} color="#6B7280" />
            {isTaggedUser && (
              <TouchableOpacity onPress={handleAddPhoto} disabled={isUploadingPhoto}>
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="camera-outline" size={24} color="#6B7280" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Caption */}
          <View className="px-4 pt-2">
            <Text className="text-base text-text-primary">
              <Text className="font-semibold">{post.author?.username} </Text>
            </Text>
            {post.caption ? (
              <MentionText text={post.caption} style={{ fontSize: 16, color: '#1F2937' }} />
            ) : null}
          </View>

          {/* Star dishes with endorsements */}
          {post.dish_ratings && post.dish_ratings.length > 0 && (
            <View>
              <StarDishes dishRatings={post.dish_ratings} userInfo={userInfo} />
              {/* Endorsement buttons for each dish */}
              {post.dish_ratings.filter((d) => d.is_star_dish).length > 0 && (
                <View className="mx-4 mb-3">
                  {post.dish_ratings
                    .filter((d) => d.is_star_dish)
                    .map((dish) => {
                      const dishEndorsements = endorsements[dish.id] ?? [];
                      const userEndorsed = dishEndorsements.some((e) => e.user_id === user?.id);
                      return (
                        <View key={dish.id} className="flex-row items-center mb-1">
                          <Text className="text-xs text-text-secondary flex-1" numberOfLines={1}>
                            {dish.dish_name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleEndorsement(dish.id, '\u{1F525}')}
                            className={`flex-row items-center px-2 py-1 rounded-full ${
                              userEndorsed ? 'bg-orange-100' : 'bg-background-secondary'
                            }`}
                          >
                            <Text className="text-xs">{'\u{1F525}'}</Text>
                            {dishEndorsements.length > 0 && (
                              <Text className="text-xs text-text-secondary ml-1">
                                {dishEndorsements.length}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          )}

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
