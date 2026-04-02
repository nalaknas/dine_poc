import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { TierGateBadge } from './TierGateBadge';
import { Shadows } from '../../constants/shadows';
import type { PerkType, UserTier } from '../../types';

// ─── Perk type → icon mapping ───────────────────────────────────────────────

const PERK_TYPE_ICONS: Record<PerkType, keyof typeof Ionicons.glyphMap> = {
  discount: 'pricetag-outline',
  free_item: 'gift-outline',
  upgrade: 'arrow-up-circle-outline',
  experience: 'sparkles-outline',
};

const PERK_TYPE_COLORS: Record<PerkType, string> = {
  discount: '#10B981',
  free_item: '#8B5CF6',
  upgrade: '#F59E0B',
  experience: '#EC4899',
};

// ─── Tier ordering for lock detection ───────────────────────────────────────

const TIER_ORDER: UserTier[] = ['rock', 'bronze', 'silver', 'gold', 'platinum', 'black'];

function isTierUnlocked(userTier: UserTier, requiredTier: string): boolean {
  const userIdx = TIER_ORDER.indexOf(userTier);
  const reqIdx = TIER_ORDER.indexOf(requiredTier as UserTier);
  if (reqIdx === -1) return false;
  return userIdx >= reqIdx;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface PerkCardProps {
  title: string;
  description: string;
  perkType: PerkType;
  tierRequired: string;
  userTier: UserTier;
  usesRemaining: number;
  restaurantName: string;
  onPress: () => void;
}

/**
 * Card shown in the perks catalog list.
 * Displays perk icon, title, description, tier badge, and uses remaining.
 * Locked perks show at reduced opacity with a lock indicator.
 */
export function PerkCard({
  title,
  description,
  perkType,
  tierRequired,
  userTier,
  usesRemaining,
  restaurantName,
  onPress,
}: PerkCardProps) {
  const unlocked = isTierUnlocked(userTier, tierRequired);
  const iconName = PERK_TYPE_ICONS[perkType] ?? 'gift-outline';
  const iconColor = PERK_TYPE_COLORS[perkType] ?? '#007AFF';

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          opacity: unlocked ? 1 : 0.55,
        },
        Shadows.card,
      ]}
    >
      {/* Left: type icon */}
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: `${iconColor}14`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {unlocked ? (
          <Ionicons name={iconName} size={22} color={iconColor} />
        ) : (
          <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
        )}
      </View>

      {/* Middle: title + description */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
          {restaurantName}
        </Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
          {description}
        </Text>
      </View>

      {/* Right: tier badge + uses */}
      <View style={{ alignItems: 'flex-end', marginLeft: 8, gap: 4 }}>
        <TierGateBadge requiredTier={tierRequired} userTier={userTier} variant="compact" />
        {unlocked && (
          <Text style={{
            fontSize: 11,
            fontWeight: '500',
            color: usesRemaining > 0 ? '#10B981' : '#EF4444',
          }}>
            {usesRemaining > 0 ? `${usesRemaining} left` : 'Used up'}
          </Text>
        )}
        {!unlocked && (
          <Text style={{ fontSize: 10, color: '#9CA3AF' }}>
            Unlock at {tierRequired}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}
