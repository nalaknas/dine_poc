import React from 'react';
import { View, Text } from 'react-native';
import type { DiningPlanStatus } from '../../types';

/** Maps plan status to background and text colors. */
const STATUS_STYLES: Record<DiningPlanStatus, { bg: string; text: string; label: string }> = {
  inviting: { bg: 'rgba(0,122,255,0.12)', text: '#007AFF', label: 'Inviting' },
  voting: { bg: 'rgba(88,86,214,0.12)', text: '#5856D6', label: 'Voting' },
  scheduling: { bg: 'rgba(245,158,11,0.12)', text: '#D97706', label: 'Scheduling' },
  confirmed: { bg: 'rgba(16,185,129,0.12)', text: '#059669', label: 'Confirmed' },
  completed: { bg: 'rgba(156,163,175,0.12)', text: '#6B7280', label: 'Completed' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', text: '#DC2626', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: DiningPlanStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <View
      style={{
        backgroundColor: style.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: style.text }}>
        {style.label}
      </Text>
    </View>
  );
}
