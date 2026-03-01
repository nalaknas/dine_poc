import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { getRecommendations, getTasteProfile } from '../../services/recommendation-service';
import { formatCurrency } from '../../utils/format';
import type { RestaurantRecommendation } from '../../types';

type RecMode = 'solo' | 'couple' | 'group';

export function RecommendationsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile, diningPartners } = useUserProfileStore();

  const [mode, setMode] = useState<RecMode>('solo');
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RestaurantRecommendation[]>([]);
  const [tasteProfile, setTasteProfile] = useState<{ topCuisines: string[]; totalRatings: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      getTasteProfile(user.id).then(setTasteProfile);
      loadRecs();
    }
  }, [user, mode, selectedPartnerIds]);

  const loadRecs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const recs = await getRecommendations({
        userId: user.id,
        partnerIds: mode !== 'solo' ? selectedPartnerIds : [],
        mode,
        city: profile?.city,
      });
      setRecommendations(recs);
    } catch {
      // Show empty state on error
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, mode, selectedPartnerIds, profile?.city]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecs();
    setRefreshing(false);
  };

  const togglePartner = (partnerId: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(partnerId) ? prev.filter((id) => id !== partnerId) : [...prev, partnerId]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Taste profile summary */}
        {tasteProfile && tasteProfile.totalRatings > 0 && (
          <View className="mx-4 mt-4 bg-accent/10 border border-accent/20 rounded-xl p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="sparkles" size={16} color="#007AFF" />
              <Text className="text-sm font-semibold text-accent ml-1">Your Taste Profile</Text>
            </View>
            <Text className="text-xs text-text-secondary">
              Based on {tasteProfile.totalRatings} dish rating{tasteProfile.totalRatings !== 1 ? 's' : ''}
            </Text>
            {tasteProfile.topCuisines.length > 0 && (
              <View className="flex-row flex-wrap mt-2">
                {tasteProfile.topCuisines.map((c) => (
                  <View key={c} className="bg-accent/20 rounded-full px-2 py-0.5 mr-1 mt-1">
                    <Text className="text-xs text-accent font-medium">{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Mode selector */}
        <View className="flex-row mx-4 mt-4 bg-background-secondary rounded-xl overflow-hidden">
          {(['solo', 'couple', 'group'] as RecMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              className={`flex-1 py-2.5 items-center ${mode === m ? 'bg-accent' : ''}`}
            >
              <Text className={`text-sm font-semibold capitalize ${mode === m ? 'text-white' : 'text-text-secondary'}`}>
                {m === 'couple' ? '💑 Couple' : m === 'group' ? '👥 Group' : '🙋 Solo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Partner selector */}
        {mode !== 'solo' && diningPartners.length > 0 && (
          <View className="mx-4 mt-3">
            <Text className="text-xs text-text-secondary mb-2">Select dining partner(s):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {diningPartners.map((dp) => {
                const selected = selectedPartnerIds.includes(dp.partner_id);
                return (
                  <TouchableOpacity
                    key={dp.id}
                    onPress={() => togglePartner(dp.partner_id)}
                    className={`mr-2 px-3 py-1.5 rounded-full border ${
                      selected ? 'bg-accent border-accent' : 'border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-text-secondary'}`}>
                      {dp.partner?.display_name ?? dp.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* No taste data message */}
        {tasteProfile && tasteProfile.totalRatings === 0 && (
          <View className="mx-4 mt-6 items-center py-8">
            <Ionicons name="restaurant-outline" size={48} color="#D1D5DB" />
            <Text className="text-lg font-semibold text-text-primary mt-4">No taste data yet</Text>
            <Text className="text-sm text-text-secondary text-center mt-2">
              Rate dishes when you post meals to unlock personalized restaurant recommendations.
            </Text>
          </View>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#007AFF" />
            <Text className="text-sm text-text-secondary mt-2">
              {mode === 'solo' ? 'Finding places for you...' : 'Finding places you\'ll both love...'}
            </Text>
          </View>
        )}

        {/* Recommendations list */}
        {!isLoading && recommendations.length > 0 && (
          <View className="mt-4">
            <Text className="text-base font-semibold text-text-primary px-4 mb-3">
              {mode === 'solo' ? 'For You' : mode === 'couple' ? 'Places You\'ll Both Love' : 'Perfect for Your Group'}
            </Text>
            {recommendations.map((rec, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => navigation.navigate('RestaurantDetail', { name: rec.restaurant_name, city: rec.city })}
                className="mx-4 mb-3 bg-background-secondary border border-border rounded-xl p-4"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-base font-bold text-text-primary">{rec.restaurant_name}</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Ionicons name="location" size={11} color="#9CA3AF" />
                      <Text className="text-xs text-text-secondary ml-0.5">{rec.city}{rec.state ? `, ${rec.state}` : ''}</Text>
                      {rec.cuisine_type && <Text className="text-xs text-text-secondary ml-2">• {rec.cuisine_type}</Text>}
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center bg-accent/10 px-2 py-1 rounded-lg">
                      <Ionicons name="sparkles" size={12} color="#007AFF" />
                      <Text className="text-xs font-bold text-accent ml-0.5">
                        {Math.round(rec.match_score * 100)}% match
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Why recommended */}
                <Text className="text-xs text-text-secondary mb-2">{rec.explanation}</Text>

                {/* Matched dishes */}
                {rec.matched_dishes.length > 0 && (
                  <View className="flex-row flex-wrap">
                    {rec.matched_dishes.slice(0, 3).map((dish, j) => (
                      <View key={j} className="bg-gold/10 border border-gold/30 rounded-full px-2 py-0.5 mr-1 mb-1">
                        <View className="flex-row items-center">
                          <Ionicons name="star" size={9} color="#F59E0B" />
                          <Text className="text-xs text-gold font-medium ml-0.5">{dish.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
