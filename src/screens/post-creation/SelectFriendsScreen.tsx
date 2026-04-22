import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useContactsStore, contactToFriend } from '../../stores/contactsStore';
import { searchUsers } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import type { User, Friend } from '../../types';
import { trackFriendInvited } from '../../lib/analytics';
import { generateId } from '../../utils/format';

function userToFriend(u: User): Friend {
  return {
    id: u.id,
    display_name: u.display_name,
    username: u.username,
    avatar_url: u.avatar_url,
    venmo_username: u.venmo_username,
    phone_number: u.phone_number,
    user_id: u.id,
    is_app_user: true,
  };
}

export function SelectFriendsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile } = useUserProfileStore();
  const { selectedFriends, addSelectedFriend, removeSelectedFriend } = useBillSplitterStore();
  const { addContact } = useContactsStore();

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

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualVenmo, setManualVenmo] = useState('');

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
      trackFriendInvited('app_user');
      addSelectedFriend(userToFriend(u));
    }
  };

  const addManualFriend = async () => {
    if (!manualName.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    if (!user) return;

    try {
      // Persist to server-side contacts so the same person can be reused next split
      const contact = await addContact({
        owner_id: user.id,
        display_name: manualName.trim(),
        phone_number: manualPhone.trim() || undefined,
        venmo_username: manualVenmo.trim() || undefined,
      });
      trackFriendInvited('manual');
      addSelectedFriend(contactToFriend(contact));
    } catch {
      // Fallback: ephemeral friend for this split only
      trackFriendInvited('manual');
      addSelectedFriend({
        id: generateId(),
        display_name: manualName.trim(),
        phone_number: manualPhone.trim() || undefined,
        venmo_username: manualVenmo.trim() || undefined,
        is_app_user: false,
      });
    }

    setManualName('');
    setManualPhone('');
    setManualVenmo('');
    setShowManualModal(false);
    setQuery('');
    setSearchResults([]);
  };

  const isSearching = query.trim().length >= 2;

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
            placeholder="Search Dine users..."
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

      {/* Add by name — always visible */}
      <View className="px-4 pb-2">
        <TouchableOpacity
          onPress={() => {
            setManualName(isSearching ? query.trim() : '');
            setShowManualModal(true);
          }}
          className="flex-row items-center bg-accent/10 border border-accent/30 rounded-xl px-3 py-3"
        >
          <View className="w-8 h-8 bg-accent/20 rounded-full items-center justify-center mr-2">
            <Ionicons name="person-add" size={16} color="#007AFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-accent">
              {isSearching ? `Add "${query.trim()}" manually` : 'Add by name'}
            </Text>
            <Text className="text-xs text-text-secondary">For friends who aren't on Dine</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search results / empty state */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {isSearching && searchResults.length > 0 && (
          <View className="pb-2">
            <Text className="text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wide px-4">
              Dine Users
            </Text>
            {searchResults.map((item) => {
              const isSelected = selectedFriends.some((f) => f.id === item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleUser(item)}
                  className="flex-row items-center px-4 py-2.5 border-b border-border-light"
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
            })}
          </View>
        )}

        {isSearching && searchResults.length === 0 && (
          <View className="px-4 py-3">
            <Text className="text-sm text-text-secondary">
              No Dine users for "{query}". Tap "Add manually" above to invite by name.
            </Text>
          </View>
        )}

        {/* No-split-partners editorial prompt — shown only at the initial state
            before the user searches or picks anyone beyond themselves. */}
        {!isSearching && selectedFriends.length <= 1 && (
          <EmptyState
            glyph="◐"
            title="No one to split with."
            description="Invite a friend who's been there too. Splits auto-pull their share."
            actionLabel="Invite a friend"
            onAction={() => setShowManualModal(true)}
          />
        )}
      </ScrollView>

      {/* Manual add modal — Name + Phone + Venmo */}
      <Modal visible={showManualModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
          <View className="bg-background rounded-t-2xl p-6 shadow-lg">
            <Text className="text-xl font-bold text-text-primary mb-4">Add Friend</Text>
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
              placeholder="Venmo username (recommended)"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-3"
            />
            <TextInput
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder="Phone number (optional)"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowManualModal(false); setManualName(''); setManualPhone(''); setManualVenmo(''); }}
                className="flex-1 border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-base font-semibold text-text-primary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addManualFriend}
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
