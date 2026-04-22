import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
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
import { ShareCard, type ShareCardHandle } from './ShareCard';
import { Shadows } from '../../constants/shadows';
import { Gold, Indigo, Neutral, Onyx, Gradients } from '../../constants/colors';
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
  const shareCardRef = useRef<ShareCardHandle>(null);
  const [showShareCard, setShowShareCard] = useState(false);

  const handleShare = useCallback(async () => {
    // Lazy mount: show ShareCard, wait for render, then capture
    setShowShareCard(true);
    // Allow a tick for the ViewShot + image to render
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      if (shareCardRef.current) {
        const uri = await shareCardRef.current.capture();
        await Share.share({ url: uri });
      } else {
        await Share.share({
          message: `Check out ${post.restaurant_name} on Dine! dine.app/post/${post.id}`,
        });
      }
    } catch {
      // User cancelled share
    } finally {
      setShowShareCard(false);
    }
  }, [post]);

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
          marginHorizontal: 14,
          marginBottom: 16,
          borderRadius: 20,
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
            size={36}
          />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Neutral[800] }}>
                {author?.username ?? 'unknown'}
              </Text>
              {author?.current_tier && <TierBadge tier={author.current_tier} variant="inline" />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Pressable onPress={handleRestaurantPress}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(94,106,210,0.08)',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Ionicons name="restaurant" size={10} color={Indigo.linear} />
                  <Text
                    style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: Indigo.linear, marginLeft: 3 }}
                    numberOfLines={1}
                  >
                    {post.restaurant_name}
                  </Text>
                </View>
              </Pressable>
            </View>
            {post.is_discoverer && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(247,181,46,0.12)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  marginTop: 2,
                }}
              >
                <Ionicons name="compass" size={10} color={Gold[600]} />
                <Text
                  style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: Gold[600], marginLeft: 2 }}
                >
                  Discoverer
                </Text>
              </View>
            )}
            {post.is_quick_post && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(247,181,46,0.12)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  marginTop: 2,
                }}
              >
                <Ionicons name="flash" size={10} color={Gold[600]} />
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Gold[600], marginLeft: 2 }}>
                  Quick Post
                </Text>
              </View>
            )}
          </View>
        </AnimatedPressable>

        {/* Rating badge */}
        {post.overall_rating > 0 && (
          post.overall_rating >= 8.5 ? (
            <View style={{ borderRadius: 10, overflow: 'hidden' }}>
              <LinearGradient
                colors={[Gradients.gold[0], Gradients.gold[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                }}
              >
                <Ionicons name="star" size={12} color="#FFFFFF" />
                <Text style={{ fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 13, color: '#FFFFFF', marginLeft: 4 }}>
                  {post.overall_rating.toFixed(1)}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Neutral[50],
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 10,
              }}
            >
              <Ionicons name="star" size={12} color={Gold[400]} />
              <Text style={{ fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 13, color: Onyx[900], marginLeft: 4 }}>
                {post.overall_rating.toFixed(1)}
              </Text>
            </View>
          )
        )}
      </View>

      {/* Location line */}
      {(post.city || post.price_range) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 }}>
          {post.city && (
            <>
              <Ionicons name="location" size={11} color={Neutral[500]} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: Neutral[500], marginLeft: 3 }}>
                {post.city}{post.state ? `, ${post.state}` : ''}
              </Text>
            </>
          )}
          {post.price_range && (
            <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: Neutral[500], marginLeft: 8 }}>
              · {post.price_range}
            </Text>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
        <LikeButton
          isLiked={post.is_liked ?? false}
          likeCount={post.like_count}
          onToggle={onLike}
        />
        <Pressable onPress={onComment} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 18 }}>
          <Ionicons name="chatbubble-outline" size={22} color={Neutral[700]} />
          {post.comment_count > 0 && (
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: Neutral[700], marginLeft: 4 }}>
              {post.comment_count}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={handleShare} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 18 }}>
          <Ionicons name="paper-plane-outline" size={22} color={Neutral[700]} />
        </Pressable>
        {/* Bookmark on far right */}
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleBookmarkPress} onLongPress={handleBookmarkLongPress}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isBookmarked ? Indigo.linear : Neutral[700]}
          />
        </Pressable>
      </View>

      {/* ShareCard (lazy mount — only rendered when user taps share) */}
      {showShareCard && <ShareCard ref={shareCardRef} post={post} />}

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
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: Neutral[800], lineHeight: 20 }}>
            <Text
              style={{ fontFamily: 'Inter_600SemiBold', color: Neutral[800] }}
              onPress={handleAuthorPress}
            >
              {author?.username ?? ''}{' '}
            </Text>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 8 }}>
          {post.tags.map((tag) => (
            <Text key={tag} style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: Indigo.linear, marginRight: 8 }}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      {/* Tagged friends */}
      {post.tagged_friends && post.tagged_friends.length > 0 && (
        <Text style={{ paddingHorizontal: 14, paddingBottom: 8, fontFamily: 'Inter_500Medium', fontSize: 11, color: Neutral[500] }}>
          with {post.tagged_friends.map((f) => f.display_name).join(', ')}
        </Text>
      )}

      {/* Comments */}
      {post.comment_count > 0 && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          {post.comment_count > (post.recent_comments?.length ?? 0) && (
            <Pressable onPress={onComment} style={{ marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: Neutral[500] }}>
                View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
          {post.recent_comments?.map((comment) => (
            <Text
              key={comment.id}
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: Neutral[800], lineHeight: 19, marginBottom: 2 }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{comment.author?.username ?? 'user'}{' '}</Text>
              {comment.content}
            </Text>
          ))}
        </View>
      )}

      {/* Timestamp — uppercase, wide tracking (editorial signature) */}
      <Text
        style={{
          paddingHorizontal: 14,
          paddingBottom: 14,
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          color: '#8E8B84',
          textTransform: 'uppercase',
          letterSpacing: 0.55, // +0.05em at 11px
        }}
      >
        {formatTimeAgo(post.created_at)}
      </Text>
    </View>
  );
}
