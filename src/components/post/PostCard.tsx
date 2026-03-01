import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../ui/Avatar';
import { PhotoCarousel } from './PhotoCarousel';
import { StarDishes } from './StarDishes';
import { LikeButton } from './LikeButton';
import type { Post, RootStackParamList } from '../../types';
import { formatTimeAgo } from '../../utils/format';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PostCard({ post, onLike, onComment }: PostCardProps) {
  const navigation = useNavigation<Nav>();

  const handleAuthorPress = useCallback(() => {
    navigation.navigate('UserProfile', { userId: post.author_id });
  }, [navigation, post.author_id]);

  const handleRestaurantPress = useCallback(() => {
    navigation.navigate('RestaurantDetail', {
      name: post.restaurant_name,
      city: post.city,
    });
  }, [navigation, post]);

  const handlePostPress = useCallback(() => {
    navigation.navigate('MealDetail', { postId: post.id });
  }, [navigation, post.id]);

  const author = post.author;

  return (
    <View className="bg-background mb-2 border-b border-border-light">
      {/* Header */}
      <View className="flex-row items-center px-3 py-3">
        <TouchableOpacity onPress={handleAuthorPress} className="flex-row items-center flex-1">
          <Avatar
            uri={author?.avatar_url}
            displayName={author?.display_name ?? 'User'}
            size={38}
          />
          <View className="ml-2 flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              {author?.username ?? 'unknown'}
            </Text>
            <TouchableOpacity onPress={handleRestaurantPress} className="flex-row items-center">
              <Ionicons name="restaurant" size={11} color="#007AFF" />
              <Text className="text-xs text-accent ml-0.5" numberOfLines={1}>
                {post.restaurant_name}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Rating badge */}
        {post.overall_rating > 0 && (
          <View className="flex-row items-center bg-background-secondary px-2 py-1 rounded-lg">
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text className="text-xs font-bold text-text-primary ml-0.5">
              {post.overall_rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Location line */}
      {(post.city || post.price_range) && (
        <View className="flex-row items-center px-3 pb-2">
          {post.city && (
            <>
              <Ionicons name="location" size={11} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-0.5">
                {post.city}{post.state ? `, ${post.state}` : ''}
              </Text>
            </>
          )}
          {post.price_range && (
            <Text className="text-xs text-text-secondary ml-2">• {post.price_range}</Text>
          )}
        </View>
      )}

      {/* Photos */}
      {post.food_photos.length > 0 && (
        <Pressable onPress={handlePostPress}>
          <PhotoCarousel photos={post.food_photos} />
        </Pressable>
      )}

      {/* Action bar */}
      <View className="flex-row items-center px-3 pt-3 pb-2 gap-4">
        <LikeButton
          isLiked={post.is_liked ?? false}
          likeCount={post.like_count}
          onToggle={onLike}
        />
        <TouchableOpacity onPress={onComment} className="flex-row items-center">
          <Ionicons name="chatbubble-outline" size={22} color="#6B7280" />
          {post.comment_count > 0 && (
            <Text className="text-sm text-text-secondary ml-1">{post.comment_count}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center">
          <Ionicons name="paper-plane-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Caption */}
      <View className="px-3 pb-2">
        {post.caption ? (
          <Text className="text-sm text-text-primary leading-5">
            <Text className="font-semibold">{author?.username ?? ''} </Text>
            {post.caption}
          </Text>
        ) : null}
      </View>

      {/* Star dishes */}
      {post.dish_ratings && post.dish_ratings.length > 0 && (
        <StarDishes dishRatings={post.dish_ratings} />
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <View className="flex-row flex-wrap px-3 pb-2">
          {post.tags.map((tag) => (
            <Text key={tag} className="text-xs text-accent mr-2">
              #{tag}
            </Text>
          ))}
        </View>
      )}

      {/* Tagged friends */}
      {post.tagged_friends && post.tagged_friends.length > 0 && (
        <Text className="px-3 pb-2 text-xs text-text-secondary">
          with {post.tagged_friends.map((f) => f.display_name).join(', ')}
        </Text>
      )}

      {/* Comments hint */}
      {post.comment_count > 0 && (
        <TouchableOpacity onPress={onComment} className="px-3 pb-2">
          <Text className="text-xs text-text-secondary">
            View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Timestamp */}
      <Text className="px-3 pb-3 text-xs text-text-secondary">
        {formatTimeAgo(post.created_at)}
      </Text>
    </View>
  );
}
