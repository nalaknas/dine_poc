import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LeaderboardFilters } from '../../components/leaderboard/LeaderboardFilters';
import { LeaderboardCard } from '../../components/leaderboard/LeaderboardCard';
import { LeaderboardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { fetchLeaderboard, fetchLeaderboardCities } from '../../services/leaderboard-service';
import type { RootStackParamList, LeaderboardEntry, LeaderboardTimePeriod } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

/** Human-readable label for each time period */
const PERIOD_LABELS: Record<LeaderboardTimePeriod, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
};

export function LeaderboardScreen({ route }: Props) {
  const initialCity = route.params?.city ?? null;
  const initialCuisine = route.params?.cuisine ?? 'All';
  const initialPeriod = route.params?.period ?? 'month';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [period, setPeriod] = useState<LeaderboardTimePeriod>(initialPeriod);
  const [selectedCity, setSelectedCity] = useState<string | null>(initialCity);
  const [selectedCuisine, setSelectedCuisine] = useState(initialCuisine);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [leaderboardData, cityData] = await Promise.all([
        fetchLeaderboard({
          city: selectedCity ?? undefined,
          cuisine: selectedCuisine === 'All' ? undefined : selectedCuisine,
          period,
        }),
        fetchLeaderboardCities(),
      ]);
      setEntries(leaderboardData);
      setCities(cityData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCity, selectedCuisine, period]);

  // Fetch on mount and when filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  /** Build subtitle string from active filters */
  const subtitle = [
    selectedCity ?? 'All Cities',
    PERIOD_LABELS[period],
  ].join(' · ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="trophy" size={28} color="#F59E0B" />
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937', marginLeft: 8 }}>
            Top 10 Restaurants
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4, marginLeft: 36 }}>
          {subtitle}
        </Text>
      </View>

      {isLoading ? (
        <LeaderboardSkeleton />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load leaderboard"
          description={error}
          actionLabel="Retry"
          onAction={() => loadData()}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        >
          {/* Filters */}
          <LeaderboardFilters
            selectedPeriod={period}
            selectedCity={selectedCity}
            selectedCuisine={selectedCuisine}
            cities={cities}
            onPeriodChange={setPeriod}
            onCityChange={setSelectedCity}
            onCuisineChange={setSelectedCuisine}
          />

          {/* Results */}
          {entries.length === 0 ? (
            <EmptyState
              icon="restaurant-outline"
              title="No restaurants yet"
              description="There aren't enough posts in this time period to rank restaurants. Try a longer time range or different filters."
            />
          ) : (
            <View style={{ marginTop: 8 }}>
              {entries.map((entry) => (
                <LeaderboardCard key={`${entry.restaurant_name}-${entry.city}`} entry={entry} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
