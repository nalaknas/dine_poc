import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, SectionList, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PerkCard } from '../../components/perks/PerkCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonRect } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { fetchAvailablePerks } from '../../services/perks-service';
import type { RootStackParamList, PerkWithRestaurant, PerkType, UserTier } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Section labels by perk type ────────────────────────────────────────────

const SECTION_LABELS: Record<PerkType, string> = {
  discount: 'Discounts',
  free_item: 'Free Items',
  upgrade: 'Upgrades',
  experience: 'Experiences',
};

const SECTION_ORDER: PerkType[] = ['discount', 'free_item', 'upgrade', 'experience'];

// ─── Skeleton ───────────────────────────────────────────────────────────────

function CatalogSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* City pills */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[80, 70, 90, 60].map((w, i) => (
          <SkeletonRect key={i} width={w} height={32} borderRadius={16} />
        ))}
      </View>
      {/* Cards */}
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonRect key={i} width="100%" height={76} borderRadius={16} />
      ))}
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export function PerksCatalogScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { profile } = useUserProfileStore();

  const [perks, setPerks] = useState<PerkWithRestaurant[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTier = (profile?.current_tier ?? 'rock') as UserTier;

  const citiesLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      // When no city filter, use unfiltered results to also extract cities
      const data = await fetchAvailablePerks(user.id, selectedCity ?? undefined);
      setPerks(data);

      // Extract unique cities from unfiltered results (first load only)
      if (!citiesLoadedRef.current && !selectedCity) {
        const uniqueCities = [...new Set(data.map((p) => p.city).filter(Boolean))].sort();
        setCities(uniqueCities);
        citiesLoadedRef.current = true;
      }
    } catch (e) {
      setError('Failed to load perks. Pull to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedCity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Group perks by type into sections
  const sections = useMemo(() => {
    const grouped: Record<PerkType, PerkWithRestaurant[]> = {
      discount: [],
      free_item: [],
      upgrade: [],
      experience: [],
    };

    perks.forEach((p) => {
      if (grouped[p.perk_type]) {
        grouped[p.perk_type].push(p);
      }
    });

    return SECTION_ORDER
      .filter((type) => grouped[type].length > 0)
      .map((type) => ({
        title: SECTION_LABELS[type],
        data: grouped[type],
      }));
  }, [perks]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="gift" size={28} color="#8B5CF6" />
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937', marginLeft: 8 }}>
              Perks & Rewards
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('RedemptionHistory')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <CatalogSkeleton />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Something went wrong"
          description={error}
          actionLabel="Try Again"
          onAction={() => { setIsLoading(true); loadData(); }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
          }
          ListHeaderComponent={
            cities.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedCity(null)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 16,
                    backgroundColor: selectedCity === null ? '#007AFF' : '#F3F4F6',
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: selectedCity === null ? '#FFFFFF' : '#6B7280',
                  }}>
                    All Cities
                  </Text>
                </TouchableOpacity>
                {cities.map((city) => (
                  <TouchableOpacity
                    key={city}
                    onPress={() => setSelectedCity(city === selectedCity ? null : city)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      backgroundColor: city === selectedCity ? '#007AFF' : '#F3F4F6',
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: city === selectedCity ? '#FFFFFF' : '#6B7280',
                    }}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <PerkCard
                title={item.title}
                description={item.description}
                perkType={item.perk_type}
                tierRequired={item.tier_required}
                userTier={userTier}
                usesRemaining={item.uses_remaining}
                restaurantName={item.restaurant_name}
                onPress={() => navigation.navigate('PerkDetail', { perkId: item.id })}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="gift-outline"
              title="No perks available"
              description="No perks available in your area yet. Check back soon!"
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
