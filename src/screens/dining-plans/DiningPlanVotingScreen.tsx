import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { VoteableRestaurantCard } from '../../components/dining-plans/VoteableRestaurantCard';
import {
  fetchVoteResults,
  fetchMyRestaurantVotes,
  addRestaurant,
  castVote,
  fetchPlanDetail,
} from '../../services/dining-plan-service';
import { getRecommendations } from '../../services/recommendation-service';
import { getUserPlaylists } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import type {
  RootStackParamList,
  DiningPlanRestaurant,
  DiningPlanMember,
  RestaurantRecommendation,
  Playlist,
} from '../../types';

type VotingRoute = RouteProp<RootStackParamList, 'DiningPlanVoting'>;

export function DiningPlanVotingScreen() {
  const { params } = useRoute<VotingRoute>();
  const { user } = useAuthStore();

  const [restaurants, setRestaurants] = useState<DiningPlanRestaurant[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<DiningPlanMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add restaurant form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newCuisine, setNewCuisine] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Recommendations
  const [recommendations, setRecommendations] = useState<RestaurantRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [showRecs, setShowRecs] = useState(false);

  // Wishlist
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showWishlist, setShowWishlist] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);

    try {
      const [results, votes, detail] = await Promise.all([
        fetchVoteResults(params.planId),
        fetchMyRestaurantVotes(params.planId, user.id),
        fetchPlanDetail(params.planId),
      ]);
      setRestaurants(results);
      setMembers(detail.members);
      const voteMap: Record<string, boolean> = {};
      for (const v of votes) {
        voteMap[v.plan_restaurant_id] = v.vote;
      }
      setMyVotes(voteMap);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, params.planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddRestaurant = useCallback(async () => {
    if (!user || !newName.trim()) {
      Alert.alert('Required', 'Enter a restaurant name.');
      return;
    }
    setIsAdding(true);
    try {
      await addRestaurant(
        params.planId,
        newName.trim(),
        newCity.trim(),
        newState.trim(),
        newCuisine.trim(),
        user.id,
        'suggestion',
      );
      setNewName('');
      setNewCity('');
      setNewState('');
      setNewCuisine('');
      setShowAddForm(false);
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add restaurant';
      Alert.alert('Error', message);
    } finally {
      setIsAdding(false);
    }
  }, [user, params.planId, newName, newCity, newState, newCuisine, loadData]);

  const handleLoadRecommendations = useCallback(async () => {
    if (!user) return;
    setIsLoadingRecs(true);
    setShowRecs(true);
    try {
      // Use all accepted member IDs as partnerIds for group centroid
      const acceptedIds = members
        .filter((m) => m.status === 'accepted' || m.role === 'host')
        .map((m) => m.user_id)
        .filter((id) => id !== user.id);

      const recs = await getRecommendations({
        userId: user.id,
        partnerIds: acceptedIds,
        mode: acceptedIds.length > 0 ? 'group' : 'solo',
        limit: 8,
      });
      setRecommendations(recs);
    } catch {
      Alert.alert('Error', 'Could not load recommendations.');
    } finally {
      setIsLoadingRecs(false);
    }
  }, [user, members]);

  const handleAddRecommendation = useCallback(async (rec: RestaurantRecommendation) => {
    if (!user) return;
    try {
      await addRestaurant(
        params.planId,
        rec.restaurant_name,
        rec.city,
        rec.state,
        rec.cuisine_type ?? '',
        user.id,
        'recommendation',
      );
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add';
      Alert.alert('Error', message);
    }
  }, [user, params.planId, loadData]);

  const handleLoadWishlist = useCallback(async () => {
    if (!user) return;
    setShowWishlist(true);
    try {
      const lists = await getUserPlaylists(user.id);
      setPlaylists(lists);
    } catch {
      // Silently fail
    }
  }, [user]);

  const handleAddFromWishlist = useCallback(async (restaurantName: string, city?: string, state?: string, cuisineType?: string) => {
    if (!user) return;
    try {
      await addRestaurant(
        params.planId,
        restaurantName,
        city ?? '',
        state ?? '',
        cuisineType ?? '',
        user.id,
        'wishlist',
      );
      loadData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add';
      Alert.alert('Error', message);
    }
  }, [user, params.planId, loadData]);

  const handleVote = useCallback(async (restaurantId: string, vote: boolean) => {
    if (!user) return;
    setMyVotes((prev) => ({ ...prev, [restaurantId]: vote }));
    try {
      await castVote(restaurantId, user.id, vote);
      const results = await fetchVoteResults(params.planId);
      setRestaurants(results);
    } catch {
      setMyVotes((prev) => {
        const copy = { ...prev };
        delete copy[restaurantId];
        return copy;
      });
    }
  }, [user, params.planId]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 4 }}>
          Vote on Restaurants
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
          Upvote or downvote candidates. Top-voted restaurant wins.
        </Text>

        {/* Current candidates */}
        {restaurants.map((r) => (
          <VoteableRestaurantCard
            key={r.id}
            restaurant={r}
            userVote={myVotes[r.id] ?? null}
            onUpvote={() => handleVote(r.id, true)}
            onDownvote={() => handleVote(r.id, false)}
          />
        ))}

        {restaurants.length === 0 && (
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 }}>
            No restaurants added yet. Add one below.
          </Text>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setShowAddForm(!showAddForm)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#F9FAFB',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="add-outline" size={18} color="#007AFF" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>Suggest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLoadRecommendations}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: 'rgba(88,86,214,0.08)',
              borderRadius: 12,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="sparkles-outline" size={18} color="#5856D6" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#5856D6' }}>AI Picks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLoadWishlist}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: 'rgba(0,122,255,0.08)',
              borderRadius: 12,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="bookmark-outline" size={18} color="#007AFF" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#007AFF' }}>Wishlist</Text>
          </TouchableOpacity>
        </View>

        {/* Manual add form */}
        {showAddForm && (
          <View
            style={{
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              gap: 10,
            }}
          >
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Restaurant name *"
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: '#1F2937',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={newCity}
                onChangeText={setNewCity}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: '#1F2937',
                }}
              />
              <TextInput
                value={newState}
                onChangeText={setNewState}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                style={{
                  width: 80,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: '#1F2937',
                }}
              />
            </View>
            <TextInput
              value={newCuisine}
              onChangeText={setNewCuisine}
              placeholder="Cuisine type"
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#1F2937',
              }}
            />
            <TouchableOpacity
              onPress={handleAddRestaurant}
              disabled={isAdding}
              style={{
                backgroundColor: '#007AFF',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: isAdding ? 0.6 : 1,
              }}
            >
              {isAdding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Add Restaurant</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* AI Recommendations */}
        {showRecs && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#5856D6', marginBottom: 10 }}>
              Group Recommendations
            </Text>
            {isLoadingRecs ? (
              <ActivityIndicator size="small" color="#5856D6" style={{ paddingVertical: 16 }} />
            ) : recommendations.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 }}>
                No recommendations available. Post more dish ratings to improve results.
              </Text>
            ) : (
              recommendations.map((rec) => (
                <TouchableOpacity
                  key={`${rec.restaurant_name}-${rec.city}`}
                  onPress={() => handleAddRecommendation(rec)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F9FAFB',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
                      {rec.restaurant_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {[rec.cuisine_type, rec.city].filter(Boolean).join(' - ')}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
                      {rec.explanation}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#5856D6" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Wishlist */}
        {showWishlist && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#007AFF', marginBottom: 10 }}>
              From Your Wishlists
            </Text>
            {playlists.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 }}>
                No saved restaurants found.
              </Text>
            ) : (
              playlists.flatMap((pl) =>
                (pl.restaurants ?? []).map((r) => (
                  <TouchableOpacity
                    key={`${pl.id}-${r.id}`}
                    onPress={() => handleAddFromWishlist(r.restaurant_name, r.city, r.state, r.cuisine_type)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F9FAFB',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
                        {r.restaurant_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {[r.cuisine_type, r.city].filter(Boolean).join(' - ')}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#007AFF" />
                  </TouchableOpacity>
                )),
              )
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
