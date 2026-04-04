import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Shadows } from '../../constants/shadows';
import type { CuisineDataPoint } from '../../types';

/** Color palette for cuisine bars — cycles through for large sets */
const BAR_COLORS = [
  '#007AFF', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#EC4899', '#14B8A6',
];

/** Number of cuisines shown before collapse */
const INITIAL_VISIBLE = 5;

interface CuisineBreakdownChartProps {
  data: CuisineDataPoint[];
}

/** Horizontal bar chart of cuisine preferences, sorted by rating. */
export function CuisineBreakdownChart({ data }: CuisineBreakdownChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) {
    return <CuisineEmptyState />;
  }

  const maxRating = Math.max(...data.map((d) => d.avgRating), 1);
  const visibleData = expanded ? data : data.slice(0, INITIAL_VISIBLE);
  const hiddenCount = data.length - INITIAL_VISIBLE;

  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          gap: 14,
        },
        Shadows.card,
      ]}
    >
      {visibleData.map((item, index) => (
        <CuisineBar
          key={item.cuisineType}
          item={item}
          maxRating={maxRating}
          color={BAR_COLORS[index % BAR_COLORS.length]}
          delay={index * 100}
        />
      ))}

      {hiddenCount > 0 && !expanded && (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 4,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>
            Show {hiddenCount} more
          </Text>
          <Ionicons name="chevron-down" size={16} color="#007AFF" />
        </TouchableOpacity>
      )}

      {expanded && hiddenCount > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded(false)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 4,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>
            Show less
          </Text>
          <Ionicons name="chevron-up" size={16} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Single Bar ───────────────────────────────────────────────────────────

function CuisineBar({
  item,
  maxRating,
  color,
  delay,
}: {
  item: CuisineDataPoint;
  maxRating: number;
  color: string;
  delay: number;
}) {
  const barWidth = useSharedValue(0);
  const targetWidth = (item.avgRating / maxRating) * 100;

  useEffect(() => {
    barWidth.value = withDelay(
      delay,
      withTiming(targetWidth, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [targetWidth, delay]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  }));

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
            {item.cuisineType}
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
            {item.dishCount} {item.dishCount === 1 ? 'dish' : 'dishes'}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>
          {item.avgRating.toFixed(1)}
        </Text>
      </View>

      <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
        <Animated.View
          style={[
            {
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
            },
            animatedBarStyle,
          ]}
        />
      </View>

      {item.favoriteDish && (
        <Text style={{ fontSize: 11, color: '#6B7280' }}>
          Favorite: {item.favoriteDish}
        </Text>
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function CuisineEmptyState() {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
          gap: 8,
        },
        Shadows.card,
      ]}
    >
      <Ionicons name="pie-chart-outline" size={32} color="#D1D5DB" />
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
        No cuisine data yet
      </Text>
      <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
        Rate dishes in your posts to see your cuisine breakdown.
      </Text>
    </View>
  );
}
