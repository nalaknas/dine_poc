import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/shadows';
import type { DiningPlanRestaurant, RestaurantSource } from '../../types';

const SOURCE_LABELS: Record<RestaurantSource, { label: string; color: string }> = {
  suggestion: { label: 'Suggested', color: '#6B7280' },
  recommendation: { label: 'AI Pick', color: '#5856D6' },
  wishlist: { label: 'Wishlist', color: '#007AFF' },
};

interface VoteableRestaurantCardProps {
  restaurant: DiningPlanRestaurant;
  /** User's current vote on this restaurant: true=upvote, false=downvote, null=none */
  userVote: boolean | null;
  onUpvote: () => void;
  onDownvote: () => void;
}

export function VoteableRestaurantCard({
  restaurant,
  userVote,
  onUpvote,
  onDownvote,
}: VoteableRestaurantCardProps) {
  const sourceMeta = SOURCE_LABELS[restaurant.source];
  const upvotes = restaurant.upvotes ?? 0;
  const downvotes = restaurant.downvotes ?? 0;
  const netScore = restaurant.net_score ?? 0;

  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
        },
        Shadows.card,
      ]}
    >
      {/* Restaurant info */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>
            {restaurant.restaurant_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {restaurant.city && (
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                {restaurant.city}{restaurant.state ? `, ${restaurant.state}` : ''}
              </Text>
            )}
            {restaurant.cuisine_type && (
              <View
                style={{
                  backgroundColor: 'rgba(0,122,255,0.08)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 11, color: '#007AFF', fontWeight: '500' }}>
                  {restaurant.cuisine_type}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Source badge */}
        <View
          style={{
            backgroundColor: `${sourceMeta.color}15`,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '600', color: sourceMeta.color }}>
            {sourceMeta.label}
          </Text>
        </View>
      </View>

      {/* Vote controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={onUpvote}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: userVote === true ? 'rgba(16,185,129,0.12)' : '#F9FAFB',
            }}
          >
            <Ionicons
              name={userVote === true ? 'thumbs-up' : 'thumbs-up-outline'}
              size={18}
              color={userVote === true ? '#059669' : '#9CA3AF'}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: userVote === true ? '#059669' : '#6B7280',
              }}
            >
              {upvotes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDownvote}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: userVote === false ? 'rgba(239,68,68,0.12)' : '#F9FAFB',
            }}
          >
            <Ionicons
              name={userVote === false ? 'thumbs-down' : 'thumbs-down-outline'}
              size={18}
              color={userVote === false ? '#DC2626' : '#9CA3AF'}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: userVote === false ? '#DC2626' : '#6B7280',
              }}
            >
              {downvotes}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Net score */}
        <View
          style={{
            backgroundColor: netScore > 0 ? 'rgba(16,185,129,0.12)' : netScore < 0 ? 'rgba(239,68,68,0.12)' : '#F3F4F6',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: netScore > 0 ? '#059669' : netScore < 0 ? '#DC2626' : '#6B7280',
            }}
          >
            {netScore > 0 ? '+' : ''}{netScore}
          </Text>
        </View>
      </View>
    </View>
  );
}
