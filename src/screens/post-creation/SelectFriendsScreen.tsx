import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useSplitHistoryStore } from '../../stores/splitHistoryStore';
import { searchUsers, getFrequentFriends } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import type { User, Friend } from '../../types';
import type { SplitHistoryEntry } from '../../stores/splitHistoryStore';
import { generateId } from '../../utils/format';

function userToFriend(u: User): Friend {
  return {
    id: u.id,
    display_name: u.display_name,
    username: u.username,
    avatar_url: u.avatar_url,
    venmo_username: u.venmo_username,
    user_id: u.id,
    is_app_user: true,
  };
}

function historyToFriend(entry: SplitHistoryEntry): Friend {
  return {
    id: entry.id,
    display_name: entry.display_name,
    username: entry.username,
    avatar_url: entry.avatar_url,
    venmo_username: entry.venmo_username,
    user_id: entry.user_id,
    is_app_user: entry.is_app_user,
  };
}

export function SelectFriendsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile } = useUserProfileStore();
  const { selectedFriends, addSelectedFriend, removeSelectedFriend } = useBillSplitterStore();
  const { loaded: historyLoaded, loadHistory, updateVenmo } = useSplitHistoryStore();

  // Auto-include current user ("You") in the bill split on mount
  useEffect(() => {
    if (user && profile && !selectedFriends.some((f) => f.id === user.id)) {
      addSelectedFriend({
        id: user.id,
        display_name: profile.display_name || 'You',
        username: profile.username,
        avatar_url: profile.avatar_url,
        venmo_username: profile.venmo_username,
        user_id: user.id,
        is_app_user: true,
      });
    }
  }, []);

  // Load split history on mount
  useEffect(() => {
    if (!historyLoaded) {
      loadHistory();
    }
  }, [historyLoaded]);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [frequentFriends, setFrequentFriends] = useState<User[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualVenmo, setManualVenmo] = useState('');
  // Venmo editing
  const [editingVenmoId, setEditingVenmoId] = useState<string | null>(null);
  const [editingVenmoValue, setEditingVenmoValue] = useState('');

  // Load frequently tagged friends on mount
  useEffect(() => {
    if (user) {
      getFrequentFriends(user.id).then(setFrequentFriends).catch(() => {});
    }
  }, [user]);

  // Top split friends (from local history, excludes self)
  const topSplitFriends = useSplitHistoryStore.getState().getTopFriends(10)
    .filter((e) => e.user_id !== user?.id);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const users = await searchUsers(text);
    setSearchResults(users.filter((u2) => u2.id !== user?.id));
  }, [user]);

  const toggleUser = (u: User) => {
    const existing = selectedFriends.find((f) => f.id === u.id);
    if (existing) {
      removeSelectedFriend(u.id);
    } else {
      addSelectedFriend(userToFriend(u));
    }
  };

  const toggleHistoryFriend = (entry: SplitHistoryEntry) => {
    const existing = selectedFriends.find((f) =>
      entry.user_id ? f.user_id === entry.user_id || f.id === entry.user_id : f.id === entry.id
    );
    if (existing) {
      removeSelectedFriend(existing.id);
    } else {
      addSelectedFriend(historyToFriend(entry));
    }
  };

  const isHistoryFriendSelected = (entry: SplitHistoryEntry) => {
    return selectedFriends.some((f) =>
      entry.user_id ? f.user_id === entry.user_id || f.id === entry.user_id : f.id === entry.id
    );
  };

  const addManualFriend = (name?: string, venmo?: string) => {
    const friendName = name ?? manualName;
    const friendVenmo = venmo ?? manualVenmo;
    if (!friendName.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    addSelectedFriend({
      id: generateId(),
      display_name: friendName.trim(),
      venmo_username: friendVenmo.trim() || undefined,
      is_app_user: false,
    });
    setManualName('');
    setManualVenmo('');
    setShowManualModal(false);
    setQuery('');
    setSearchResults([]);
  };

  const startEditVenmo = (entry: SplitHistoryEntry) => {
    setEditingVenmoId(entry.id);
    setEditingVenmoValue(entry.venmo_username ?? '');
  };

  const saveEditVenmo = () => {
    if (editingVenmoId) {
      updateVenmo(editingVenmoId, editingVenmoValue.trim());
      // Also update in selectedFriends if this friend is currently selected
      const selected = selectedFriends.find((f) => f.id === editingVenmoId || f.user_id === editingVenmoId);
      if (selected) {
        removeSelectedFriend(selected.id);
        addSelectedFriend({ ...selected, venmo_username: editingVenmoValue.trim() || undefined });
      }
    }
    setEditingVenmoId(null);
    setEditingVenmoValue('');
  };

  // Check if search query has no matching results (for "add manually" inline prompt)
  const showInlineAddManual = query.trim().length >= 2 && searchResults.length === 0;
  const showAddAsManualInResults = query.trim().length >= 2 && searchResults.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Selected friends chips */}
      {selectedFriends.length > 0 && (
        <View className="px-4 py-3 border-b border-border-light">
          <FlatList
            horizontal
            data={selectedFriends}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMe = item.id === user?.id;
              return (
                <TouchableOpacity
                  onPress={() => !isMe && removeSelectedFriend(item.id)}
                  activeOpacity={isMe ? 1 : 0.7}
                  className="items-center mr-3"
                >
                  <View className="relative">
                    <Avatar uri={item.avatar_url} displayName={item.display_name} size={42} />
                    {!isMe && (
                      <View className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error rounded-full items-center justify-center">
                        <Ionicons name="close" size={9} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-text-secondary mt-1" numberOfLines={1} style={{ maxWidth: 44 }}>
                    {isMe ? 'You' : item.display_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Search bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-background-secondary rounded-xl px-3 py-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search or add friend by name..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-base text-text-primary"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Top split friends — people you've split with before */}
      {topSplitFriends.length > 0 && query.length === 0 && (
        <View className="px-4 pb-2">
          <Text className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Top Split Friends
          </Text>
          {topSplitFriends.map((entry) => {
            const selected = isHistoryFriendSelected(entry);
            const isEditingThis = editingVenmoId === entry.id;
            return (
              <View key={entry.id} className="flex-row items-center py-2.5 border-b border-border-light">
                <TouchableOpacity
                  onPress={() => toggleHistoryFriend(entry)}
                  className="flex-row items-center flex-1"
                  activeOpacity={0.7}
                >
                  <Avatar uri={entry.avatar_url} displayName={entry.display_name} size={42} />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold text-text-primary">{entry.display_name}</Text>
                    <View className="flex-row items-center">
                      {entry.username && (
                        <Text className="text-sm text-text-secondary">@{entry.username}</Text>
                      )}
                      <Text className="text-xs text-text-tertiary ml-1">
                        · {entry.split_count} {entry.split_count === 1 ? 'split' : 'splits'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Venmo badge / edit */}
                {isEditingThis ? (
                  <View className="flex-row items-center">
                    <TextInput
                      value={editingVenmoValue}
                      onChangeText={setEditingVenmoValue}
                      placeholder="venmo"
                      autoCapitalize="none"
                      autoFocus
                      placeholderTextColor="#9CA3AF"
                      className="bg-background-secondary border border-border rounded-lg px-2 py-1 text-sm text-text-primary"
                      style={{ width: 100 }}
                      onSubmitEditing={saveEditVenmo}
                    />
                    <TouchableOpacity onPress={saveEditVenmo} className="ml-1.5">
                      <Ionicons name="checkmark-circle" size={22} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => startEditVenmo(entry)}
                    className="flex-row items-center mr-2"
                    activeOpacity={0.7}
                  >
                    {entry.venmo_username ? (
                      <View className="flex-row items-center bg-blue-50 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-accent font-medium">@{entry.venmo_username}</Text>
                        <Ionicons name="pencil" size={10} color="#007AFF" style={{ marginLeft: 3 }} />
                      </View>
                    ) : (
                      <View className="flex-row items-center bg-background-secondary rounded-full px-2 py-0.5">
                        <Text className="text-xs text-text-tertiary">+ venmo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Selection indicator */}
                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selected ? 'bg-accent border-accent' : 'border-border'
                }`}>
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Frequent friends — quick add (from Supabase tagged history) */}
      {frequentFriends.length > 0 && query.length === 0 && (
        <View className="px-4 pb-2">
          <Text className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">Frequent</Text>
          <View className="flex-row flex-wrap">
            {frequentFriends
              .filter((f) => !selectedFriends.some((s) => s.id === f.id))
              .map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  onPress={() => addSelectedFriend(userToFriend(friend))}
                  className="flex-row items-center bg-background-secondary border border-border rounded-full px-3 py-1.5 mr-2 mb-2"
                >
                  <Avatar uri={friend.avatar_url} displayName={friend.display_name} size={22} />
                  <Text className="text-sm font-semibold text-text-primary ml-1.5">{friend.display_name.split(' ')[0]}</Text>
                  <Ionicons name="add" size={16} color="#007AFF" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}

      {/* Search results + inline add */}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedFriends.some((f) => f.id === item.id);
          return (
            <TouchableOpacity
              onPress={() => toggleUser(item)}
              className="flex-row items-center px-4 py-3 border-b border-border-light"
            >
              <Avatar uri={item.avatar_url} displayName={item.display_name} size={42} />
              <View className="flex-1 ml-3">
                <Text className="text-base font-semibold text-text-primary">{item.display_name}</Text>
                <Text className="text-sm text-text-secondary">@{item.username}</Text>
              </View>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                isSelected ? 'bg-accent border-accent' : 'border-border'
              }`}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          showInlineAddManual ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-text-secondary mb-2">No users found for "{query}"</Text>
              <TouchableOpacity
                onPress={() => {
                  setManualName(query.trim());
                  setShowManualModal(true);
                }}
                className="flex-row items-center bg-accent/10 border border-accent/30 rounded-xl px-4 py-3"
              >
                <View className="w-10 h-10 bg-accent/20 rounded-full items-center justify-center mr-3">
                  <Ionicons name="person-add" size={20} color="#007AFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-accent">Add "{query.trim()}" manually</Text>
                  <Text className="text-xs text-text-secondary">Not on Dine? Add them with their Venmo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View>
            {/* Inline "Add manually" in search results */}
            {showAddAsManualInResults && (
              <TouchableOpacity
                onPress={() => {
                  setManualName(query.trim());
                  setShowManualModal(true);
                }}
                className="flex-row items-center px-4 py-3 border-b border-border-light"
              >
                <View className="w-10 h-10 bg-background-secondary rounded-full items-center justify-center mr-3">
                  <Ionicons name="person-add-outline" size={20} color="#007AFF" />
                </View>
                <Text className="text-base font-semibold text-accent">
                  Add "{query.trim()}" manually
                </Text>
              </TouchableOpacity>
            )}
            {/* Always show manual add option */}
            <TouchableOpacity
              onPress={() => setShowManualModal(true)}
              className="flex-row items-center px-4 py-4"
            >
              <View className="w-10 h-10 bg-background-secondary rounded-full items-center justify-center mr-3">
                <Ionicons name="person-add-outline" size={20} color="#007AFF" />
              </View>
              <Text className="text-base font-semibold text-accent">Add friend manually</Text>
            </TouchableOpacity>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Manual add modal */}
      <Modal visible={showManualModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
          <View className="bg-background rounded-t-2xl p-6 shadow-lg">
            <Text className="text-xl font-bold text-text-primary mb-4">Add Friend Manually</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-3"
            />
            <TextInput
              value={manualVenmo}
              onChangeText={setManualVenmo}
              placeholder="Venmo username (optional)"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowManualModal(false); setManualName(''); setManualVenmo(''); }}
                className="flex-1 border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-base font-semibold text-text-primary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => addManualFriend()}
                className="flex-1 bg-accent rounded-xl py-3 items-center"
              >
                <Text className="text-base font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Continue */}
      <View className="bg-background border-t border-border-light px-4 py-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('AssignItems')}
          disabled={selectedFriends.length === 0}
          className={`rounded-xl py-4 items-center ${
            selectedFriends.length > 0 ? 'bg-accent' : 'bg-border'
          }`}
        >
          <Text className="text-base font-semibold text-white">
            Continue with {selectedFriends.length} {selectedFriends.length === 1 ? 'person' : 'people'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
