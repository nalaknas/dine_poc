import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { InsightCard } from '../../components/insights/InsightCard';
import { CuisineBreakdownChart } from '../../components/insights/CuisineBreakdownChart';
import { DishRecommendationCard } from '../../components/insights/DishRecommendationCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonRect } from '../../components/ui/Skeleton';
import { Shadows } from '../../constants/shadows';
import { useAuthStore } from '../../stores/authStore';
import {
  fetchTasteInsights,
  fetchCuisineBreakdown,
  fetchDishRecommendations,
} from '../../services/taste-insights-service';
import type { TasteInsight, CuisineDataPoint, DishRecommendation } from '../../types';

/** Minimum ratings required before insights can be generated (server-side matches) */
const MIN_RATINGS = 5;

export function TasteInsightsScreen() {
  const { user } = useAuthStore();

  const [insights, setInsights] = useState<TasteInsight[]>([]);
  const [cuisineData, setCuisineData] = useState<CuisineDataPoint[]>([]);
  const [recommendations, setRecommendations] = useState<DishRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insufficientData, setInsufficientData] = useState(false);
  const [ratingsNeeded, setRatingsNeeded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [insightsResult, cuisineResult, recsResult] = await Promise.allSettled([
        fetchTasteInsights(user.id),
        fetchCuisineBreakdown(user.id),
        fetchDishRecommendations(user.id, 8),
      ]);

      if (insightsResult.status === 'fulfilled') {
        setInsights(insightsResult.value.insights);
        setInsufficientData(insightsResult.value.insufficientData);
        setRatingsNeeded(insightsResult.value.ratingsNeeded);
      }
      if (cuisineResult.status === 'fulfilled') {
        setCuisineData(cuisineResult.value);
      }
      if (recsResult.status === 'fulfilled') {
        setRecommendations(recsResult.value);
      }

      // If all failed, show error
      if (
        insightsResult.status === 'rejected' &&
        cuisineResult.status === 'rejected' &&
        recsResult.status === 'rejected'
      ) {
        setError('Unable to load taste insights. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  // ─── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <InsightsSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Insufficient data state ────────────────────────────────────────────
  if (insufficientData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
        <EmptyState
          icon="analytics-outline"
          title="Almost there!"
          description={`Rate ${ratingsNeeded} more ${ratingsNeeded === 1 ? 'dish' : 'dishes'} to unlock your personalized taste insights.`}
          actionLabel="Start Rating"
        />
      </SafeAreaView>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error && insights.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          description={error}
          actionLabel="Retry"
          onAction={() => loadData()}
        />
      </SafeAreaView>
    );
  }

  // ─── Populated state ───────────────────────────────────────────────────
  const metricInsights = insights.filter((i) => i.type === 'metric');
  const fullWidthInsights = insights.filter((i) => i.type !== 'metric');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#EFF6FF', '#FFFFFF']}
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: 'rgba(0,122,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="analytics" size={26} color="#007AFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937' }}>
                Your Taste Profile
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                Personalized insights from your dining history
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Section 1: Insight cards */}
        {insights.length > 0 && (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {/* Metric cards in 2-column grid */}
            {metricInsights.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {metricInsights.map((insight) => (
                  <View key={insight.id} style={{ flex: 1 }}>
                    <InsightCard insight={insight} />
                  </View>
                ))}
              </View>
            )}

            {/* Full-width cards for standard and comparison */}
            {fullWidthInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </View>
        )}

        {/* Section 2: Cuisine Breakdown */}
        {(cuisineData.length > 0 || !isLoading) && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <SectionHeader title="Cuisine Breakdown" icon="pie-chart-outline" />
            <View style={{ marginTop: 12 }}>
              <CuisineBreakdownChart data={cuisineData} />
            </View>
          </View>
        )}

        {/* Section 3: Dish Recommendations */}
        {recommendations.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <SectionHeader title="Recommended For You" icon="sparkles-outline" />
            <View style={{ marginTop: 12, gap: 10 }}>
              {recommendations.map((rec, index) => (
                <DishRecommendationCard
                  key={`${rec.dish_name}-${rec.restaurant_name}-${index}`}
                  recommendation={rec}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color="#1F2937" />
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>{title}</Text>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      {/* Header skeleton */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkeletonRect width={48} height={48} borderRadius={14} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonRect width="60%" height={20} />
          <SkeletonRect width="80%" height={12} />
        </View>
      </View>

      {/* Metric cards row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SkeletonRect width="100%" height={120} borderRadius={16} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonRect width="100%" height={120} borderRadius={16} />
        </View>
      </View>

      {/* Full-width cards */}
      <SkeletonRect width="100%" height={100} borderRadius={16} />
      <SkeletonRect width="100%" height={140} borderRadius={16} />

      {/* Section header + bars */}
      <SkeletonRect width="50%" height={18} />
      <SkeletonRect width="100%" height={200} borderRadius={16} />

      {/* Recommendation section */}
      <SkeletonRect width="55%" height={18} />
      {[0, 1, 2].map((i) => (
        <SkeletonRect key={i} width="100%" height={80} borderRadius={16} />
      ))}
    </View>
  );
}
