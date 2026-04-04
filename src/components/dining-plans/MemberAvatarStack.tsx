import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../ui/Avatar';
import type { DiningPlanMember } from '../../types';

interface MemberAvatarStackProps {
  members: DiningPlanMember[];
  /** Maximum avatars to show before "+N" overflow circle. */
  maxVisible?: number;
  /** Avatar diameter in points. */
  size?: number;
}

/**
 * Stacked circular avatars with overlap. Shows first N members
 * and a "+X" circle for overflow.
 */
export function MemberAvatarStack({
  members,
  maxVisible = 4,
  size = 32,
}: MemberAvatarStackProps) {
  const visible = members.slice(0, maxVisible);
  const overflow = members.length - maxVisible;
  const overlap = size * 0.35;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((member, idx) => (
        <View
          key={member.id}
          style={{
            marginLeft: idx === 0 ? 0 : -overlap,
            zIndex: maxVisible - idx,
          }}
        >
          <Avatar
            uri={member.user?.avatar_url}
            displayName={member.user?.display_name}
            size={size}
          />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -overlap,
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
            backgroundColor: '#E5E7EB',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <Text style={{ fontSize: Math.max(size * 0.34, 10), fontWeight: '600', color: '#6B7280' }}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
