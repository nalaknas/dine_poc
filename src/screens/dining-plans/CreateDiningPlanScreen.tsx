import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { createDiningPlan } from '../../services/dining-plan-service';
import { searchUsers, getFrequentFriends } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import type { User, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CreateDiningPlanScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [frequentFriends, setFrequentFriends] = useState<User[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load frequent friends on mount
  useEffect(() => {
    if (user) {
      getFrequentFriends(user.id, 10)
        .then(setFrequentFriends)
        .catch(() => {});
    }
  }, [user]);

  const handleSearch = useCallback(async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchUsers(text.trim());
      // Filter out current user and already-selected friends
      const selectedIds = new Set(selectedFriends.map((f) => f.id));
      setSearchResults(
        results.filter((u) => u.id !== user?.id && !selectedIds.has(u.id)),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user, selectedFriends]);

  const addFriend = useCallback((friend: User) => {
    setSelectedFriends((prev) => {
      if (prev.some((f) => f.id === friend.id)) return prev;
      return [...prev, friend];
    });
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const removeFriend = useCallback((friendId: string) => {
    setSelectedFriends((prev) => prev.filter((f) => f.id !== friendId));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a plan title.');
      return;
    }
    if (selectedFriends.length === 0) {
      Alert.alert('Required', 'Invite at least one friend.');
      return;
    }

    setIsCreating(true);
    try {
      const plan = await createDiningPlan(
        user.id,
        title.trim(),
        selectedFriends.map((f) => f.id),
        notes.trim() || undefined,
      );
      navigation.replace('DiningPlanDetail', { planId: plan.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create plan';
      Alert.alert('Error', message);
    } finally {
      setIsCreating(false);
    }
  }, [user, title, notes, selectedFriends, navigation]);

  /** Friends to show when no search active — frequent friends minus already selected */
  const suggestedFriends = frequentFriends.filter(
    (f) => !selectedFriends.some((s) => s.id === f.id),
  );
  const displayList = searchQuery.trim().length >= 2 ? searchResults : suggestedFriends;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Title */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              Plan Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Friday Night Sushi, Birthday Dinner..."
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#F9FAFB',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: '#1F2937',
              }}
            />
          </View>

          {/* Selected friends chips */}
          {selectedFriends.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {selectedFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  onPress={() => removeFriend(friend.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,122,255,0.08)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 20,
                    gap: 6,
                  }}
                >
                  <Avatar uri={friend.avatar_url} displayName={friend.display_name} size={22} />
                  <Text style={{ fontSize: 13, color: '#007AFF', fontWeight: '500' }}>
                    {friend.display_name}
                  </Text>
                  <Ionicons name="close-circle" size={16} color="#007AFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Friend search */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              Invite Friends
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Search by name or username..."
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  fontSize: 15,
                  color: '#1F2937',
                }}
              />
              {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
            </View>
          </View>

          {/* Suggested / search results label */}
          {searchQuery.trim().length < 2 && suggestedFriends.length > 0 && (
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, marginLeft: 4 }}>
              Frequent dining friends
            </Text>
          )}

          {/* Friend list */}
          <FlatList
            data={displayList}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addFriend(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                <Avatar uri={item.avatar_url} displayName={item.display_name} size={36} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
                    {item.display_name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                    @{item.username}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchQuery.trim().length >= 2 && !isSearching ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ fontSize: 14, color: '#9CA3AF' }}>No users found</Text>
                </View>
              ) : null
            }
            style={{ flex: 1 }}
          />

          {/* Notes */}
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
              Notes (optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any preferences, budget, etc."
              placeholderTextColor="#9CA3AF"
              multiline
              style={{
                backgroundColor: '#F9FAFB',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 15,
                color: '#1F2937',
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Create button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={isCreating}
            style={{
              backgroundColor: '#007AFF',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 16,
              opacity: isCreating ? 0.6 : 1,
            }}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Create Plan
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
