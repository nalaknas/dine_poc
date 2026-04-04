import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DiningPlanCard } from '../../components/dining-plans/DiningPlanCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { fetchMyPlans } from '../../services/dining-plan-service';
import { useAuthStore } from '../../stores/authStore';
import { Shadows, glowShadow } from '../../constants/shadows';
import type { DiningPlan, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Active statuses vs past/terminal */
const ACTIVE_STATUSES = new Set(['inviting', 'voting', 'scheduling', 'confirmed']);

export function DiningPlansScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  const [plans, setPlans] = useState<DiningPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPlans = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const data = await fetchMyPlans(user.id);
      setPlans(data);
    } catch (err) {
      // Silently fail — empty state will show
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Reload on screen focus to pick up changes from detail screens
  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  const activePlans = plans.filter((p) => ACTIVE_STATUSES.has(p.status));
  const pastPlans = plans.filter((p) => !ACTIVE_STATUSES.has(p.status));

  const sections = [
    ...(activePlans.length > 0 ? [{ title: 'Active', data: activePlans }] : []),
    ...(pastPlans.length > 0 ? [{ title: 'Past', data: pastPlans }] : []),
  ];

  const renderItem = useCallback(({ item }: { item: DiningPlan }) => (
    <DiningPlanCard plan={item} />
  ), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="people" size={28} color="#007AFF" />
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937', marginLeft: 8 }}>
            Dinner Plans
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4, marginLeft: 36 }}>
          Coordinate group dinners with friends
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: '#9CA3AF' }}>Loading plans...</Text>
        </View>
      ) : plans.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No dinner plans yet"
          description="Start coordinating group dinners with friends. Pick a restaurant, vote on dates, and split the bill together."
          actionLabel="Plan a Dinner"
          onAction={() => navigation.navigate('CreateDiningPlan')}
        />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadPlans(true)}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            activePlans.length > 0 && pastPlans.length > 0 ? null : undefined
          }
          // Group headers rendered inline via section-style approach
          ItemSeparatorComponent={() => null}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('CreateDiningPlan')}
        style={[
          {
            position: 'absolute',
            bottom: 32,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#007AFF',
            alignItems: 'center',
            justifyContent: 'center',
          },
          glowShadow('#007AFF'),
        ]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
