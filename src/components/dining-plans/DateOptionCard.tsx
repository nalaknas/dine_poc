import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/shadows';
import type { DiningPlanDateOption } from '../../types';

interface DateOptionCardProps {
  option: DiningPlanDateOption;
  proposerName?: string;
  /** User's current vote: true=upvote, false=downvote, null=none */
  userVote: boolean | null;
  onUpvote: () => void;
  onDownvote: () => void;
}

export function DateOptionCard({
  option,
  proposerName,
  userVote,
  onUpvote,
  onDownvote,
}: DateOptionCardProps) {
  const date = new Date(option.proposed_date);
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const upvotes = option.upvotes ?? 0;
  const downvotes = option.downvotes ?? 0;
  const netScore = upvotes - downvotes;

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Date info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={16} color="#007AFF" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
              {formatted}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {time}
            </Text>
          </View>
          {proposerName && (
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, marginLeft: 22 }}>
              Suggested by {proposerName}
            </Text>
          )}
        </View>

        {/* Vote controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={onUpvote}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: userVote === true ? 'rgba(16,185,129,0.12)' : '#F9FAFB',
            }}
          >
            <Ionicons
              name={userVote === true ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={userVote === true ? '#059669' : '#9CA3AF'}
            />
            <Text
              style={{
                fontSize: 12,
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
              gap: 3,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: userVote === false ? 'rgba(239,68,68,0.12)' : '#F9FAFB',
            }}
          >
            <Ionicons
              name={userVote === false ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color={userVote === false ? '#DC2626' : '#9CA3AF'}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: userVote === false ? '#DC2626' : '#6B7280',
              }}
            >
              {downvotes}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
