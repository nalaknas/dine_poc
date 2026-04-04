import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SkeletonRect } from '../ui/Skeleton';
import { Shadows } from '../../constants/shadows';
import type { TasteInsight } from '../../types';

interface InsightCardProps {
  insight: TasteInsight;
  isLoading?: boolean;
}

/** Renders a single insight in one of three variants: standard, metric, or comparison. */
export function InsightCard({ insight, isLoading }: InsightCardProps) {
  if (isLoading) {
    return <InsightCardSkeleton variant={insight.type} />;
  }

  switch (insight.type) {
    case 'metric':
      return <MetricCard insight={insight} />;
    case 'comparison':
      return <ComparisonCard insight={insight} />;
    default:
      return <StandardCard insight={insight} />;
  }
}

// ─── Standard Variant ─────────────────────────────────────────────────────

function StandardCard({ insight }: { insight: TasteInsight }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          gap: 8,
        },
        Shadows.card,
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${insight.color}15`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={insight.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={insight.color}
        />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
        {insight.title}
      </Text>
      <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 18 }}>
        {insight.subtitle}
      </Text>
    </View>
  );
}

// ─── Metric Variant ───────────────────────────────────────────────────────

function MetricCard({ insight }: { insight: TasteInsight }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          alignItems: 'center',
          gap: 4,
        },
        Shadows.card,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${insight.color}15`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={insight.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={insight.color}
        />
      </View>
      <Text style={{ fontSize: 28, fontWeight: '700', color: insight.color, marginTop: 4 }}>
        {insight.value ?? '---'}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}>
        {insight.title}
      </Text>
      <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
        {insight.subtitle}
      </Text>
    </View>
  );
}

// ─── Comparison Variant ───────────────────────────────────────────────────

function ComparisonCard({ insight }: { insight: TasteInsight }) {
  const userWidth = useSharedValue(0);
  const avgWidth = useSharedValue(0);

  const maxVal = Math.max(insight.userValue ?? 0, insight.averageValue ?? 0, 1);
  const userPct = ((insight.userValue ?? 0) / maxVal) * 100;
  const avgPct = ((insight.averageValue ?? 0) / maxVal) * 100;

  React.useEffect(() => {
    userWidth.value = withTiming(userPct, { duration: 800, easing: Easing.out(Easing.cubic) });
    avgWidth.value = withTiming(avgPct, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [userPct, avgPct]);

  const userBarStyle = useAnimatedStyle(() => ({
    width: `${userWidth.value}%` as `${number}%`,
  }));

  const avgBarStyle = useAnimatedStyle(() => ({
    width: `${avgWidth.value}%` as `${number}%`,
  }));

  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          gap: 12,
        },
        Shadows.card,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: `${insight.color}15`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={insight.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={insight.color}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
            {insight.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>{insight.subtitle}</Text>
        </View>
      </View>

      {/* User bar */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1F2937' }}>You</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: insight.color }}>
            {insight.userValue ?? 0}
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <Animated.View
            style={[
              {
                height: 8,
                borderRadius: 4,
                backgroundColor: insight.color,
              },
              userBarStyle,
            ]}
          />
        </View>
      </View>

      {/* Average bar */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>Average</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#9CA3AF' }}>
            {insight.averageValue ?? 0}
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <Animated.View
            style={[
              {
                height: 8,
                borderRadius: 4,
                backgroundColor: '#D1D5DB',
              },
              avgBarStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function InsightCardSkeleton({ variant }: { variant: string }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          gap: 10,
        },
        Shadows.card,
      ]}
    >
      <SkeletonRect width={40} height={40} borderRadius={12} />
      {variant === 'metric' ? (
        <>
          <SkeletonRect width={60} height={28} borderRadius={6} />
          <SkeletonRect width="80%" height={12} />
        </>
      ) : (
        <>
          <SkeletonRect width="60%" height={14} />
          <SkeletonRect width="90%" height={12} />
          {variant === 'comparison' && (
            <>
              <SkeletonRect width="100%" height={8} borderRadius={4} />
              <SkeletonRect width="100%" height={8} borderRadius={4} />
            </>
          )}
        </>
      )}
    </View>
  );
}
