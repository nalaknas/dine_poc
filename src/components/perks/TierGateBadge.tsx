import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserTier } from '../../types';

// ─── Tier ordering + colors ─────────────────────────────────────────────────

const TIER_ORDER: UserTier[] = ['rock', 'bronze', 'silver', 'gold', 'platinum', 'black'];

const TIER_COLORS: Record<UserTier, string> = {
  rock: '#9CA3AF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  black: '#1A1A1A',
};

const TIER_LABELS: Record<UserTier, string> = {
  rock: 'Rock',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  black: 'Black',
};

/** Returns true if userTier is at least requiredTier in the ordering. */
function isTierUnlocked(userTier: UserTier, requiredTier: string): boolean {
  const userIdx = TIER_ORDER.indexOf(userTier);
  const reqIdx = TIER_ORDER.indexOf(requiredTier as UserTier);
  if (reqIdx === -1) return false;
  return userIdx >= reqIdx;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface TierGateBadgeProps {
  requiredTier: string;
  userTier: UserTier;
  /** 'compact' shows just icon + tier, 'full' adds unlock text (default: compact) */
  variant?: 'compact' | 'full';
}

/**
 * Displays the tier required for a perk, with visual locked/unlocked state.
 * Compares the user's current tier against the required tier.
 */
export function TierGateBadge({ requiredTier, userTier, variant = 'compact' }: TierGateBadgeProps) {
  const unlocked = isTierUnlocked(userTier, requiredTier);
  const tierKey = requiredTier as UserTier;
  const color = TIER_COLORS[tierKey] ?? '#9CA3AF';
  const label = TIER_LABELS[tierKey] ?? requiredTier;

  if (variant === 'compact') {
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: unlocked ? `${color}18` : '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
      }}>
        <Ionicons
          name={unlocked ? 'checkmark-circle' : 'lock-closed'}
          size={13}
          color={unlocked ? '#10B981' : '#9CA3AF'}
        />
        <Text style={{
          fontSize: 11,
          fontWeight: '600',
          color: unlocked ? color : '#9CA3AF',
        }}>
          {label}
        </Text>
      </View>
    );
  }

  // Full variant
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: unlocked ? 'rgba(16,185,129,0.08)' : '#FEF2F2',
      borderWidth: 1,
      borderColor: unlocked ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: unlocked ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons
          name={unlocked ? 'checkmark-circle' : 'lock-closed'}
          size={18}
          color={unlocked ? '#10B981' : '#9CA3AF'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '600',
          color: unlocked ? '#10B981' : '#6B7280',
        }}>
          {unlocked ? 'Tier Unlocked' : `${label} Required`}
        </Text>
        {!unlocked && (
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
            Reach {label} tier to unlock this perk
          </Text>
        )}
      </View>
      <View style={{
        backgroundColor: `${color}20`,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
