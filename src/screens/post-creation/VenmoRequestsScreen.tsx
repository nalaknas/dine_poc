import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { openVenmoRequest, buildMealNote } from '../../services/venmo-service';
import { createSplitRecord, getSplitInvite } from '../../services/referral-service';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '../../utils/format';
import type { PersonBreakdown, RootStackParamList } from '../../types';

type VenmoRoute = RouteProp<RootStackParamList, 'VenmoRequests'>;

export function VenmoRequestsScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<VenmoRoute>();
  const { breakdowns, restaurantName, splitId } = params;
  const { user } = useAuthStore();

  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [activeSplitId, setActiveSplitId] = useState<string | undefined>(splitId);
  const [fetchedBreakdowns, setFetchedBreakdowns] = useState<PersonBreakdown[] | null>(null);
  const [fetchedRestaurantName, setFetchedRestaurantName] = useState<string | null>(null);
  const [fetchedInviterName, setFetchedInviterName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Create a persisted split record for deep link sharing
  useEffect(() => {
    if (!breakdowns || !user || activeSplitId) return;
    createSplitRecord(
      null,
      restaurantName ?? 'Dinner',
      new Date().toISOString().split('T')[0],
      user.id,
      breakdowns.map((b) => ({ displayName: b.friend.display_name, amount: b.total })),
    )
      .then(setActiveSplitId)
      .catch((err) => console.warn('[VenmoRequests] Failed to create split record:', err?.message));
  }, [breakdowns, user, activeSplitId]);

  // Fetch split data from Supabase when arriving via deep link
  useEffect(() => {
    if (breakdowns || !splitId) return;
    let cancelled = false;
    setIsLoading(true);
    getSplitInvite(splitId)
      .then((invite) => {
        if (cancelled) return;
        if (!invite) {
          setFetchError(true);
          return;
        }
        setFetchedRestaurantName(invite.restaurant_name);
        setFetchedInviterName(invite.inviter?.display_name ?? null);
        setFetchedBreakdowns(
          invite.breakdowns.map((b, i) => ({
            friend: {
              id: `split-friend-${i}`,
              display_name: b.displayName,
              is_app_user: false,
            },
            items: [],
            itemsTotal: b.amount,
            taxShare: 0,
            tipShare: 0,
            total: b.amount,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [splitId, breakdowns]);

  // Resolve display data: route params take priority, fall back to fetched
  const resolvedBreakdowns = breakdowns ?? fetchedBreakdowns;
  const resolvedRestaurantName = restaurantName ?? fetchedRestaurantName ?? 'Dinner';

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-sm text-text-secondary mt-4">Loading split details...</Text>
      </SafeAreaView>
    );
  }

  if (fetchError || (!resolvedBreakdowns && splitId)) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-lg font-semibold text-text-primary mt-4">Split Not Found</Text>
        <Text className="text-sm text-text-secondary mt-2 text-center px-8">
          This split link may have expired or is invalid. Ask the sender to share again.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Main')}
          className="mt-6 bg-accent rounded-xl px-8 py-3"
        >
          <Text className="text-base font-semibold text-white">Go to Feed</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!resolvedBreakdowns) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Ionicons name="card-outline" size={48} color="#007AFF" />
        <Text className="text-lg font-semibold text-text-primary mt-4">No Split Data</Text>
        <Text className="text-sm text-text-secondary mt-2 text-center px-8">
          No split data found.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Main')}
          className="mt-6 bg-accent rounded-xl px-8 py-3"
        >
          <Text className="text-base font-semibold text-white">Go to Feed</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleRequest = async (breakdown: PersonBreakdown) => {
    if (!breakdown.friend.venmo_username) return;
    try {
      await openVenmoRequest({
        venmoUsername: breakdown.friend.venmo_username,
        amount: breakdown.total,
        note: buildMealNote(resolvedRestaurantName, activeSplitId),
      });
      setRequested((prev) => new Set([...prev, breakdown.friend.id]));
    } catch {
      Alert.alert('Error', 'Could not open Venmo. Please request manually.');
    }
  };

  const handleRequestAll = async () => {
    for (const b of resolvedBreakdowns) {
      if (!requested.has(b.friend.id)) {
        await handleRequest(b);
        await new Promise((res) => setTimeout(res, 500));
      }
    }
  };

  const totalOwed = resolvedBreakdowns.reduce((sum, b) => sum + b.total, 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 px-4">
        <View className="items-center py-6">
          <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-3">
            <Ionicons name="card-outline" size={32} color="#007AFF" />
          </View>
          <Text className="text-xl font-bold text-text-primary">Collect Payment</Text>
          {fetchedInviterName && (
            <Text className="text-sm text-text-secondary mt-1">Shared by {fetchedInviterName}</Text>
          )}
          <Text className="text-base text-text-secondary mt-1">
            Request {formatCurrency(totalOwed)} from {resolvedBreakdowns.length} friend{resolvedBreakdowns.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <FlatList
          data={resolvedBreakdowns}
          keyExtractor={(item) => item.friend.id}
          renderItem={({ item }) => {
            const isRequested = requested.has(item.friend.id);
            return (
              <View className="flex-row items-center bg-background-secondary rounded-xl p-4 mb-3">
                <Avatar uri={item.friend.avatar_url} displayName={item.friend.display_name} size={42} />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-text-primary">{item.friend.display_name}</Text>
                  {item.friend.venmo_username && (
                    <Text className="text-xs text-text-secondary">@{item.friend.venmo_username}</Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-base font-bold text-text-primary mb-1.5">
                    {formatCurrency(item.total)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRequest(item)}
                    disabled={!item.friend.venmo_username}
                    className={`px-3 py-1.5 rounded-lg ${
                      isRequested ? 'bg-success/20' : item.friend.venmo_username ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${
                      isRequested ? 'text-success' : item.friend.venmo_username ? 'text-white' : 'text-text-secondary'
                    }`}>
                      {isRequested ? '✓ Sent' : item.friend.venmo_username ? 'Request' : 'No Venmo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />

        <View className="gap-3 py-4">
          {resolvedBreakdowns.some((b) => !requested.has(b.friend.id) && b.friend.venmo_username) && (
            <TouchableOpacity
              onPress={handleRequestAll}
              className="bg-accent rounded-xl py-4 items-center"
            >
              <Text className="text-base font-semibold text-white">Request All via Venmo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            className="border border-border rounded-xl py-4 items-center"
          >
            <Text className="text-base font-semibold text-text-primary">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
