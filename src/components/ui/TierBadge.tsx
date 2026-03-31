import React from 'react';
import { View, Text } from 'react-native';
import type { UserTier } from '../../types';

// ─── Tier color constants (domain-specific, not in tailwind config) ──────────

const TIER_COLORS: Record<UserTier, string> = {
  rock: '#9CA3AF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  black: '#1A1A1A',
};

/** Use white text on darker tier backgrounds, dark text on lighter ones */
const TIER_TEXT_COLORS: Record<UserTier, string> = {
  rock: '#FFFFFF',
  bronze: '#FFFFFF',
  silver: '#1F2937',
  gold: '#1F2937',
  platinum: '#1F2937',
  black: '#FFFFFF',
};

const TIER_LABELS: Record<UserTier, string> = {
  rock: 'Rock',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  black: 'Black',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface TierBadgeProps {
  tier: UserTier;
  variant?: 'inline' | 'profile' | 'mini';
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TierBadge({ tier, variant = 'inline', className }: TierBadgeProps) {
  const color = TIER_COLORS[tier];
  const textColor = TIER_TEXT_COLORS[tier];
  const label = TIER_LABELS[tier];

  if (variant === 'mini') {
    return (
      <View
        className={className}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: '#FFFFFF',
        }}
      />
    );
  }

  if (variant === 'profile') {
    return (
      <View
        className={`flex-row items-center self-start ${className ?? ''}`}
        style={{
          backgroundColor: color,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: textColor,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

  // variant === 'inline'
  return (
    <View
      className={className}
      style={{
        backgroundColor: color,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginLeft: 4,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: textColor,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
