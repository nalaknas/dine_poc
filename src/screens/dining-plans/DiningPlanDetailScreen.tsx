import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/dining-plans/StatusBadge';
import { MemberAvatarStack } from '../../components/dining-plans/MemberAvatarStack';
import { VoteableRestaurantCard } from '../../components/dining-plans/VoteableRestaurantCard';
import { DateOptionCard } from '../../components/dining-plans/DateOptionCard';
import {
  fetchPlanDetail,
  respondToInvite,
  updatePlanStatus,
  subscribeToPlan,
  fetchVoteResults,
  fetchMyRestaurantVotes,
  castVote,
  fetchDateResults,
  fetchMyDateVotes,
  castDateVote,
} from '../../services/dining-plan-service';
import { useAuthStore } from '../../stores/authStore';
import type {
  RootStackParamList,
  DiningPlan,
  DiningPlanMember,
  DiningPlanRestaurant,
  DiningPlanDateOption,
  DiningPlanStatus,
} from '../../types';

type DetailRoute = RouteProp<RootStackParamList, 'DiningPlanDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Member status indicator colors */
const STATUS_COLORS: Record<string, string> = {
  accepted: '#10B981',
  pending: '#F59E0B',
  declined: '#EF4444',
};

/** Status transitions available to the host */
const HOST_ACTIONS: Partial<Record<DiningPlanStatus, { label: string; nextStatus: DiningPlanStatus; icon: string }>> = {
  inviting: { label: 'Start Voting', nextStatus: 'voting', icon: 'checkmark-circle-outline' },
  voting: { label: 'Move to Scheduling', nextStatus: 'scheduling', icon: 'calendar-outline' },
  scheduling: { label: 'Confirm Plan', nextStatus: 'confirmed', icon: 'checkmark-done-outline' },
};

export function DiningPlanDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  const [plan, setPlan] = useState<DiningPlan | null>(null);
  const [members, setMembers] = useState<DiningPlanMember[]>([]);
  const [restaurants, setRestaurants] = useState<DiningPlanRestaurant[]>([]);
  const [dateOptions, setDateOptions] = useState<DiningPlanDateOption[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const [myDateVotes, setMyDateVotes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isHost = plan?.host_id === user?.id;
  const myMembership = members.find((m) => m.user_id === user?.id);
  const isPending = myMembership?.status === 'pending';

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);

    try {
      const detail = await fetchPlanDetail(params.planId);
      setPlan(detail.plan);
      setMembers(detail.members);
      setDateOptions(detail.dateOptions);

      // Fetch vote results and user's votes if in voting/scheduling status
      if (['voting', 'scheduling', 'confirmed', 'completed'].includes(detail.plan.status)) {
        const [voteResults, userVotes] = await Promise.all([
          fetchVoteResults(params.planId),
          fetchMyRestaurantVotes(params.planId, user.id),
        ]);
        setRestaurants(voteResults);
        const voteMap: Record<string, boolean> = {};
        for (const v of userVotes) {
          voteMap[v.plan_restaurant_id] = v.vote;
        }
        setMyVotes(voteMap);
      } else {
        setRestaurants(detail.restaurants);
      }

      if (['scheduling', 'confirmed', 'completed'].includes(detail.plan.status)) {
        const [dateResults, userDateVotes] = await Promise.all([
          fetchDateResults(params.planId),
          fetchMyDateVotes(params.planId, user.id),
        ]);
        setDateOptions(dateResults);
        const dateVoteMap: Record<string, boolean> = {};
        for (const v of userDateVotes) {
          dateVoteMap[v.date_option_id] = v.vote;
        }
        setMyDateVotes(dateVoteMap);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plan';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, params.planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToPlan(params.planId, () => {
      loadData(true);
    });
    return unsubscribe;
  }, [params.planId, loadData]);

  const handleRespond = useCallback(async (accept: boolean) => {
    if (!user) return;
    try {
      await respondToInvite(params.planId, user.id, accept);
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to respond';
      Alert.alert('Error', message);
    }
  }, [user, params.planId, loadData]);

  const handleStatusChange = useCallback(async (nextStatus: DiningPlanStatus) => {
    // If confirming, pick the top-voted restaurant and date
    let chosenRestaurant: { name: string; city: string } | undefined;
    let chosenDate: string | undefined;

    if (nextStatus === 'confirmed') {
      if (restaurants.length > 0) {
        const top = restaurants[0]; // Already sorted by net_score DESC
        chosenRestaurant = { name: top.restaurant_name, city: top.city ?? '' };
      }
      if (dateOptions.length > 0) {
        // Pick date with most upvotes
        const sorted = [...dateOptions].sort(
          (a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0),
        );
        chosenDate = sorted[0].proposed_date;
      }
    }

    try {
      await updatePlanStatus(params.planId, nextStatus, chosenRestaurant, chosenDate);
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      Alert.alert('Error', message);
    }
  }, [params.planId, restaurants, dateOptions, loadData]);

  const handleCancelPlan = useCallback(() => {
    Alert.alert('Cancel Plan', 'Are you sure you want to cancel this dinner plan?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: () => handleStatusChange('cancelled'),
      },
    ]);
  }, [handleStatusChange]);

  const handleVote = useCallback(async (restaurantId: string, vote: boolean) => {
    if (!user) return;
    // Optimistic update
    setMyVotes((prev) => ({ ...prev, [restaurantId]: vote }));
    try {
      await castVote(restaurantId, user.id, vote);
      // Refresh vote tallies
      const results = await fetchVoteResults(params.planId);
      setRestaurants(results);
    } catch {
      // Revert on error
      setMyVotes((prev) => {
        const copy = { ...prev };
        delete copy[restaurantId];
        return copy;
      });
    }
  }, [user, params.planId]);

  const handleDateVote = useCallback(async (dateOptionId: string, vote: boolean) => {
    if (!user) return;
    setMyDateVotes((prev) => ({ ...prev, [dateOptionId]: vote }));
    try {
      await castDateVote(dateOptionId, user.id, vote);
      const results = await fetchDateResults(params.planId);
      setDateOptions(results);
    } catch {
      setMyDateVotes((prev) => {
        const copy = { ...prev };
        delete copy[dateOptionId];
        return copy;
      });
    }
  }, [user, params.planId]);

  /** Find a member's display name by user ID */
  const getMemberName = useCallback((userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member?.user?.display_name ?? 'Someone';
  }, [members]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>Plan not found</Text>
      </View>
    );
  }

  const hostAction = HOST_ACTIONS[plan.status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{ fontSize: 24, fontWeight: '800', color: '#1F2937', flex: 1, marginRight: 12 }}
              numberOfLines={2}
            >
              {plan.title}
            </Text>
            <StatusBadge status={plan.status} />
          </View>

          {plan.notes && (
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>
              {plan.notes}
            </Text>
          )}

          {/* Confirmed restaurant + date */}
          {plan.status === 'confirmed' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: 'rgba(16,185,129,0.08)',
                borderRadius: 12,
                padding: 14,
              }}
            >
              {plan.chosen_restaurant_name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="restaurant" size={18} color="#059669" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#059669' }}>
                    {plan.chosen_restaurant_name}
                  </Text>
                  {plan.chosen_restaurant_city && (
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>
                      {plan.chosen_restaurant_city}
                    </Text>
                  )}
                </View>
              )}
              {plan.chosen_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calendar" size={18} color="#059669" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                    {new Date(plan.chosen_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Pending invite actions */}
        {isPending && (
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingHorizontal: 16,
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => handleRespond(true)}
              style={{
                flex: 1,
                backgroundColor: '#10B981',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRespond(false)}
              style={{
                flex: 1,
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Members section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 }}>
            Members ({members.length})
          </Text>
          {members.map((member) => (
            <View
              key={member.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <Avatar
                uri={member.user?.avatar_url}
                displayName={member.user?.display_name}
                size={36}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
                  {member.user?.display_name ?? 'Unknown'}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {member.role === 'host' ? 'Host' : `@${member.user?.username ?? ''}`}
                </Text>
              </View>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: STATUS_COLORS[member.status] ?? '#9CA3AF',
                }}
              />
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6, textTransform: 'capitalize' }}>
                {member.status}
              </Text>
            </View>
          ))}
        </View>

        {/* Restaurant voting section (visible during voting/scheduling/confirmed) */}
        {['voting', 'scheduling', 'confirmed'].includes(plan.status) && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>
                Restaurant Picks
              </Text>
              {plan.status === 'voting' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('DiningPlanVoting', { planId: plan.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {restaurants.length === 0 ? (
              <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 }}>
                No restaurants added yet
              </Text>
            ) : (
              restaurants.map((r) => (
                <VoteableRestaurantCard
                  key={r.id}
                  restaurant={r}
                  userVote={myVotes[r.id] ?? null}
                  onUpvote={() => handleVote(r.id, true)}
                  onDownvote={() => handleVote(r.id, false)}
                />
              ))
            )}
          </View>
        )}

        {/* Date scheduling section (visible during scheduling/confirmed) */}
        {['scheduling', 'confirmed'].includes(plan.status) && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>
                Date Options
              </Text>
              {plan.status === 'scheduling' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('DiningPlanScheduling', { planId: plan.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {dateOptions.length === 0 ? (
              <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 }}>
                No dates proposed yet
              </Text>
            ) : (
              dateOptions.map((opt) => (
                <DateOptionCard
                  key={opt.id}
                  option={opt}
                  proposerName={getMemberName(opt.proposed_by)}
                  userVote={myDateVotes[opt.id] ?? null}
                  onUpvote={() => handleDateVote(opt.id, true)}
                  onDownvote={() => handleDateVote(opt.id, false)}
                />
              ))
            )}
          </View>
        )}

        {/* Bill split CTA for confirmed plans */}
        {plan.status === 'confirmed' && plan.chosen_restaurant_name && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('VenmoRequests', { restaurantName: plan.chosen_restaurant_name })}
              style={{
                backgroundColor: '#007AFF',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                Split the Bill
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Host actions */}
        {isHost && hostAction && (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => handleStatusChange(hostAction.nextStatus)}
              style={{
                backgroundColor: '#007AFF',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name={hostAction.icon as keyof typeof Ionicons.glyphMap} size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                {hostAction.label}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel button for host */}
        {isHost && !['completed', 'cancelled'].includes(plan.status) && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={handleCancelPlan}
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>
                Cancel Plan
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
