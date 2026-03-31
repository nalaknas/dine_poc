import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { TierBadge } from '../ui/TierBadge';
import type { Post } from '../../types';

export interface ShareCardHandle {
  capture: () => Promise<string>;
}

interface ShareCardProps {
  post: Post;
}

/**
 * A branded card rendered off-screen, captured as an image for sharing.
 * Shows: restaurant name, photo, rating, star dishes, tier badge, and watermark.
 */
export const ShareCard = forwardRef<ShareCardHandle, ShareCardProps>(
  ({ post }, ref) => {
    const viewShotRef = useRef<ViewShot>(null);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        if (!viewShotRef.current?.capture) {
          throw new Error('ViewShot not ready');
        }
        return viewShotRef.current.capture();
      },
    }));

    const author = post.author;
    const starDishes = (post.dish_ratings ?? [])
      .filter((d) => d.rating >= 7)
      .slice(0, 3);
    const photo = post.food_photos?.[0];

    return (
      <View style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1, result: 'tmpfile' }}
        >
          <View style={{ width: 375, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
            {/* Header gradient */}
            <LinearGradient
              colors={['#007AFF', '#5856D6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', flex: 1 }}>
                  {post.restaurant_name}
                </Text>
                {post.overall_rating > 0 && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginLeft: 4 }}>
                      {post.overall_rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Author + tier */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>
                  @{author?.username ?? 'user'}
                </Text>
                {author?.current_tier && (
                  <TierBadge tier={author.current_tier} variant="inline" />
                )}
              </View>
            </LinearGradient>

            {/* Photo */}
            {photo && (
              <Image
                source={{ uri: photo }}
                style={{ width: 375, height: 280 }}
                resizeMode="cover"
              />
            )}

            {/* Star dishes */}
            {starDishes.length > 0 && (
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8 }}>
                  STAR DISHES
                </Text>
                {starDishes.map((dish) => (
                  <View
                    key={dish.dish_name}
                    style={{
                      flexDirection: 'row', alignItems: 'center', marginBottom: 6,
                    }}
                  >
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', marginLeft: 6, flex: 1 }}>
                      {dish.dish_name}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>
                      {dish.rating}/10
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Caption excerpt */}
            {post.caption ? (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={{ fontSize: 14, color: '#4B5563', lineHeight: 20 }} numberOfLines={2}>
                  "{post.caption}"
                </Text>
              </View>
            ) : null}

            {/* Watermark footer */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#F9FAFB', paddingVertical: 12,
              borderTopWidth: 1, borderTopColor: '#F3F4F6',
            }}>
              <Ionicons name="restaurant" size={14} color="#007AFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#007AFF', marginLeft: 4 }}>
                Posted on Dine
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8 }}>
                dine.app
              </Text>
            </View>
          </View>
        </ViewShot>
      </View>
    );
  },
);
