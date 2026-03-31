import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../ui/Avatar';
import { PhotoCarousel } from './PhotoCarousel';
import { StarDishes } from './StarDishes';
import { LikeButton } from './LikeButton';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { TierBadge } from '../ui/TierBadge';
import { PlaylistPickerModal } from '../ui/PlaylistPickerModal';
import { Shadows } from '../../constants/shadows';
import { toggleBookmark, isRestaurantBookmarked } from '../../services/bookmark-service';
import { useAuthStore } from '../../stores/authStore';
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
  const { user } = useAuthStore();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const isTogglingRef = useRef(false);

  // Initialize bookmark state from server
  useEffect(() => {
    if (!user || !post.restaurant_name) return;
    isRestaurantBookmarked(user.id, post.restaurant_name)
      .then(setIsBookmarked)
      .catch(() => {});
  }, [user, post.restaurant_name]);

  const handleBookmarkPress = useCallback(async () => {
    if (!user || isTogglingRef.current) return;
    isTogglingRef.current = true;
    try {
      const result = await toggleBookmark(
        user.id, post.restaurant_name, post.city, post.state, post.cuisine_type,
      );
      setIsBookmarked(result);
    } finally {
      isTogglingRef.current = false;
    }
  }, [user, post]);

  const handleBookmarkLongPress = useCallback(() => {
    setShowPlaylistPicker(true);
  }, []);

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

  // Build userInfo map for StarDishes avatars
  const userInfo: Record<string, { displayName: string; avatarUrl?: string }> = {};
  if (author) {
    userInfo[post.author_id] = {
      displayName: author.display_name ?? author.username ?? 'Author',
      avatarUrl: author.avatar_url,
    };
  }
  for (const f of post.tagged_friends ?? []) {
    if (f.user_id && f.display_name) {
      userInfo[f.user_id] = {
        displayName: f.display_name,
        avatarUrl: f.user?.avatar_url,
      };
    }
  }

  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          marginHorizontal: 12,
          marginBottom: 12,
          borderRadius: 16,
          overflow: 'hidden',
        },
        Shadows.card,
      ]}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <AnimatedPressable onPress={handleAuthorPress} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar
            uri={author?.avatar_url}
            displayName={author?.display_name ?? 'User'}
            size={38}
          />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                {author?.username ?? 'unknown'}
              </Text>
              {author?.current_tier && <TierBadge tier={author.current_tier} variant="inline" />}
            </View>
            <Pressable onPress={handleRestaurantPress}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,122,255,0.08)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  marginTop: 2,
                }}
              >
                <Ionicons name="restaurant" size={10} color="#007AFF" />
                <Text
                  style={{ fontSize: 11, color: '#007AFF', marginLeft: 3, fontWeight: '500' }}
                  numberOfLines={1}
                >
                  {post.restaurant_name}
                </Text>
              </View>
            </Pressable>
            {post.is_discoverer && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  marginTop: 2,
                }}
              >
                <Ionicons name="compass" size={10} color="#D97706" />
                <Text
                  style={{ fontSize: 10, color: '#D97706', marginLeft: 2, fontWeight: '700' }}
                >
                  Discoverer
                </Text>
              </View>
            )}
            {post.is_quick_post && (
              <View className="flex-row items-center bg-gold/10 px-1.5 py-0.5 rounded-md self-start mt-0.5">
                <Ionicons name="flash" size={10} color="#F59E0B" />
                <Text className="text-[10px] text-gold ml-0.5 font-semibold">Quick Post</Text>
              </View>
            )}
          </View>
        </AnimatedPressable>

        {/* Rating badge */}
        {post.overall_rating > 0 && (
          post.overall_rating >= 8.0 ? (
            <View style={{ borderRadius: 10, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#F59E0B', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Ionicons name="star" size={12} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginLeft: 3 }}>
                  {post.overall_rating.toFixed(1)}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 10,
              }}
            >
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1F2937', marginLeft: 3 }}>
                {post.overall_rating.toFixed(1)}
              </Text>
            </View>
          )
        )}
      </View>

      {/* Location line */}
      {(post.city || post.price_range) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 }}>
          {post.city && (
            <>
              <Ionicons name="location" size={11} color="#6B7280" />
              <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 2 }}>
                {post.city}{post.state ? `, ${post.state}` : ''}
              </Text>
            </>
          )}
          {post.price_range && (
            <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 8 }}>• {post.price_range}</Text>
          )}
        </View>
      )}

      {/* Photos */}
      {post.food_photos.length > 0 && (
        <Pressable onPress={handlePostPress}>
          <PhotoCarousel photos={post.food_photos} photoLabels={post.photo_labels} />
        </Pressable>
      )}

      {/* Star dishes — always shown when present */}
      {post.dish_ratings && post.dish_ratings.length > 0 && (
        <StarDishes dishRatings={post.dish_ratings} userInfo={userInfo} />
      )}

      {/* Action bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
        <LikeButton
          isLiked={post.is_liked ?? false}
          likeCount={post.like_count}
          onToggle={onLike}
        />
        <Pressable onPress={onComment} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
          <Ionicons name="chatbubble-outline" size={22} color="#6B7280" />
          {post.comment_count > 0 && (
            <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }}>{post.comment_count}</Text>
          )}
        </Pressable>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
          <Ionicons name="paper-plane-outline" size={22} color="#6B7280" />
        </Pressable>
        {/* Bookmark on far right */}
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleBookmarkPress} onLongPress={handleBookmarkLongPress}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isBookmarked ? '#007AFF' : '#6B7280'}
          />
        </Pressable>
      </View>

      {/* Playlist picker modal (long press bookmark) */}
      {user && (
        <PlaylistPickerModal
          visible={showPlaylistPicker}
          userId={user.id}
          restaurantName={post.restaurant_name}
          city={post.city}
          state={post.state}
          cuisineType={post.cuisine_type}
          onDismiss={() => setShowPlaylistPicker(false)}
        />
      )}

      {/* Caption */}
      {post.caption ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text style={{ fontSize: 13, color: '#1F2937', lineHeight: 20 }}>
            <Text style={{ fontWeight: '600' }} onPress={handleAuthorPress}>{author?.username ?? ''} </Text>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 8 }}>
          {post.tags.map((tag) => (
            <Text key={tag} style={{ fontSize: 12, color: '#007AFF', marginRight: 8 }}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      {/* Tagged friends */}
      {post.tagged_friends && post.tagged_friends.length > 0 && (
        <Text style={{ paddingHorizontal: 12, paddingBottom: 8, fontSize: 11, color: '#6B7280' }}>
          with {post.tagged_friends.map((f) => f.display_name).join(', ')}
        </Text>
      )}

      {/* Comments */}
      {post.comment_count > 0 && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          {post.comment_count > (post.recent_comments?.length ?? 0) && (
            <Pressable onPress={onComment} style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
          {post.recent_comments?.map((comment) => (
            <Text key={comment.id} style={{ fontSize: 13, color: '#1F2937', lineHeight: 19, marginBottom: 2 }}>
              <Text style={{ fontWeight: '600' }}>{comment.author?.username ?? 'user'} </Text>
              {comment.content}
            </Text>
          ))}
        </View>
      )}

      {/* Timestamp */}
      <Text style={{ paddingHorizontal: 12, paddingBottom: 12, fontSize: 11, color: '#9CA3AF' }}>
        {formatTimeAgo(post.created_at)}
      </Text>
    </View>
  );
}
