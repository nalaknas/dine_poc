import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/shadows';
import type { RedemptionStatus } from '../../types';

// ─── Status → visual mapping ────────────────────────────────────────────────

const STATUS_CONFIG: Record<RedemptionStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  label: string;
  labelColor: string;
  badgeBg: string;
}> = {
  redeemed: {
    icon: 'checkmark-circle',
    iconColor: '#10B981',
    bgColor: 'rgba(16,185,129,0.12)',
    label: 'Redeemed',
    labelColor: '#10B981',
    badgeBg: 'rgba(16,185,129,0.1)',
  },
  expired: {
    icon: 'close-circle',
    iconColor: '#EF4444',
    bgColor: 'rgba(239,68,68,0.12)',
    label: 'Expired',
    labelColor: '#EF4444',
    badgeBg: 'rgba(239,68,68,0.1)',
  },
  pending: {
    icon: 'time',
    iconColor: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    label: 'Pending',
    labelColor: '#F59E0B',
    badgeBg: 'rgba(245,158,11,0.1)',
  },
};

// ─── Date formatting ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface RedemptionHistoryCardProps {
  perkTitle: string;
  restaurantName: string;
  status: RedemptionStatus;
  createdAt: string;
  redemptionCode: string;
}

/**
 * Card for displaying a past redemption in the history list.
 * Shows status icon, perk title, restaurant, date, and status badge.
 */
export function RedemptionHistoryCard({
  perkTitle,
  restaurantName,
  status,
  createdAt,
  redemptionCode,
}: RedemptionHistoryCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          padding: 14,
          marginBottom: 8,
        },
        Shadows.sm,
      ]}
    >
      {/* Status icon */}
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: config.bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={config.icon} size={20} color={config.iconColor} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>
          {perkTitle}
        </Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>
          {restaurantName}
        </Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
          {formatDate(createdAt)} · {redemptionCode}
        </Text>
      </View>

      {/* Status badge */}
      <View style={{
        backgroundColor: config.badgeBg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}>
        <Text style={{
          fontSize: 11,
          fontWeight: '600',
          color: config.labelColor,
        }}>
          {config.label}
        </Text>
      </View>
    </View>
  );
}
