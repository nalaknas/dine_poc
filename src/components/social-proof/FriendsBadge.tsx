import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFriendVisitCount } from '../../services/social-proof-service';

interface FriendsBadgeProps {
  currentUserId: string;
  restaurantName: string;
  /** Pre-fetched following IDs to avoid redundant queries in list views */
  followingIds?: string[];
}

/**
 * Small inline badge showing "X friends" next to a restaurant name.
 * Designed to sit in PostCard headers and restaurant cards in feeds.
 * Only renders when count > 0.
 */
export function FriendsBadge({
  currentUserId,
  restaurantName,
  followingIds,
}: FriendsBadgeProps) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!currentUserId || !restaurantName) return;

    let cancelled = false;
    getFriendVisitCount(currentUserId, restaurantName, followingIds)
      .then((c) => {
        if (!cancelled) setCount(c);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [currentUserId, restaurantName, followingIds]);

  if (count === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,122,255,0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 4,
      }}
    >
      <Ionicons name="people" size={9} color="#007AFF" />
      <Text
        style={{
          fontSize: 10,
          color: '#007AFF',
          marginLeft: 2,
          fontWeight: '600',
        }}
      >
        {count} {count === 1 ? 'friend' : 'friends'}
      </Text>
    </View>
  );
}
