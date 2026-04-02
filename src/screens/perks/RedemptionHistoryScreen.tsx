import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RedemptionHistoryCard } from '../../components/perks/RedemptionHistoryCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { fetchRedemptionHistory } from '../../services/perks-service';
import type { PerkRedemption } from '../../types';

export function RedemptionHistoryScreen() {
  const { user } = useAuthStore();
  const [redemptions, setRedemptions] = useState<PerkRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchRedemptionHistory(user.id);
      setRedemptions(data);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time" size={24} color="#6B7280" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', marginLeft: 8 }}>
            Redemption History
          </Text>
        </View>
      </View>

      <FlatList
        data={redemptions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <RedemptionHistoryCard
            perkTitle={item.perk?.title ?? 'Perk'}
            restaurantName={item.restaurant_name ?? 'Restaurant'}
            status={item.status}
            createdAt={item.created_at}
            redemptionCode={item.redemption_code}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No redemptions yet"
            description="When you redeem perks at partner restaurants, they'll appear here."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
