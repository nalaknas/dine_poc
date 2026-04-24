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
  const { addContact, loadContacts, pickContact, contacts, isLoaded: contactsLoaded } = useContactsStore();

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

  // Hydrate contacts cache the first time this screen mounts so "Recent" can render
  useEffect(() => {
    if (user && !contactsLoaded) {
      loadContacts(user.id);
    }
  }, [user, contactsLoaded, loadContacts]);

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

  // Recency-sorted list of people the user has actually tagged/split with before.
  // Unused contacts (no last_split_at) are intentionally excluded — "Recent" should
  // mean recent, not "all my contacts alphabetized".
  const recentContacts = isSearching
    ? []
    : [...contacts]
        .filter((c) => !!c.last_split_at)
        .sort((a, b) => (b.last_split_at ?? '').localeCompare(a.last_split_at ?? ''))
        .filter((c) => {
          const friendId = c.linked_user_id ?? c.id;
          return !selectedFriends.some((f) => f.id === friendId || f.contact_id === c.id);
        })
        .slice(0, 10);

  const handlePickFromContacts = async () => {
    if (!user) return;
    try {
      const contact = await pickContact(user.id);
      if (!contact) return; // user cancelled
      trackFriendInvited(contact.linked_user_id ? 'app_user' : 'manual');
      addSelectedFriend(contactToFriend(contact));
    } catch (e) {
      Alert.alert(
        'Contacts',
        e instanceof Error ? e.message : "Something went wrong. Try adding a friend by name instead.",
      );
    }
  };

  const toggleContact = (c: typeof contacts[number]) => {
    const friend = contactToFriend(c);
    const isSelected = selectedFriends.some((f) => f.id === friend.id || f.contact_id === c.id);
    if (isSelected) {
      removeSelectedFriend(friend.id);
    } else {
      trackFriendInvited(c.linked_user_id ? 'app_user' : 'manual');
      addSelectedFriend(friend);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['bottom']}>
      {/* Selected friends chips */}
      {selectedFriends.length > 0 && (
        <View className="px-4 py-3 border-b border-neutral-200 bg-white">
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
                      <View className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: '#B84545' }}>
                        <Ionicons name="close" size={9} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-neutral-500 mt-1" numberOfLines={1} style={{ maxWidth: 44 }}>
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
        <View className="flex-row items-center bg-white border border-neutral-200 rounded-xl px-3 py-2">
          <Ionicons name="search" size={18} color="#9B9791" />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search Dine users…"
            placeholderTextColor="#9B9791"
            className="flex-1 ml-2 text-base text-onyx-900"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color="#9B9791" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick-add actions — manual entry + native iOS contact picker.
          When searching, the "Add by name" button prefills with the query so a
          no-results search turns into a one-tap invite. */}
      <View className="px-4 pb-2 flex-row gap-2">
        <TouchableOpacity
          onPress={() => {
            setManualName(isSearching ? query.trim() : '');
            setShowManualModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={isSearching ? `Add ${query.trim()} manually` : 'Add friend by name'}
          className="flex-1 flex-row items-center bg-white border border-neutral-200 rounded-xl px-3 py-3"
        >
          <Ionicons name="person-add" size={16} color="#0A0A0A" />
          <Text className="text-sm font-semibold text-onyx-900 ml-2 flex-1" numberOfLines={1}>
            {isSearching ? `Add "${query.trim()}"` : 'Add by name'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePickFromContacts}
          accessibilityRole="button"
          accessibilityLabel="Pick from iOS Contacts"
          className="flex-1 flex-row items-center bg-white border border-neutral-200 rounded-xl px-3 py-3"
        >
          <Ionicons name="people" size={16} color="#0A0A0A" />
          <Text className="text-sm font-semibold text-onyx-900 ml-2 flex-1" numberOfLines={1}>
            From Contacts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search results / empty state */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {isSearching && searchResults.length > 0 && (
          <View className="pb-2">
            <Text className="text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide px-4">
              Dine Users
            </Text>
            {searchResults.map((item) => {
              const isSelected = selectedFriends.some((f) => f.id === item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleUser(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${item.display_name}`}
                  className="flex-row items-center px-4 py-2.5 border-b border-neutral-100"
                >
                  <Avatar uri={item.avatar_url} displayName={item.display_name} size={42} />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold text-onyx-900">{item.display_name}</Text>
                    <Text className="text-sm text-neutral-500">@{item.username}</Text>
                  </View>
                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    isSelected ? 'bg-onyx-900 border-onyx-900' : 'border-neutral-300'
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
            <Text className="text-sm text-neutral-500">
              No Dine users for "{query}". Tap "Add manually" above to invite by name.
            </Text>
          </View>
        )}

        {/* Recent — contacts you've actually split with before, most-recent first.
            Mixes Dine and non-Dine; native-picker and manual contacts both appear here
            once they've been used at least once. */}
        {!isSearching && recentContacts.length > 0 && (
          <View className="pb-2">
            <Text className="text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide px-4">
              Recent
            </Text>
            {recentContacts.map((item) => {
              const friend = contactToFriend(item);
              const isSelected = selectedFriends.some((f) => f.id === friend.id || f.contact_id === item.id);
              const subtitle = friend.username
                ? `@${friend.username}`
                : item.phone_number ?? 'Not on Dine';
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleContact(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${item.display_name}`}
                  className="flex-row items-center px-4 py-2.5 border-b border-neutral-100"
                >
                  <Avatar uri={friend.avatar_url} displayName={item.display_name} size={42} />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold text-onyx-900">{item.display_name}</Text>
                    <Text className="text-sm text-neutral-500">{subtitle}</Text>
                  </View>
                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    isSelected ? 'bg-onyx-900 border-onyx-900' : 'border-neutral-300'
                  }`}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* No-split-partners editorial prompt — first-time state, before any recents exist. */}
        {!isSearching && selectedFriends.length <= 1 && recentContacts.length === 0 && (
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
          <View className="bg-cream rounded-t-2xl p-6 shadow-lg">
            <Text className="text-xl font-bold text-onyx-900 mb-4">Add Friend</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Name"
              placeholderTextColor="#9B9791"
              autoFocus
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-base text-onyx-900 mb-3"
            />
            <TextInput
              value={manualVenmo}
              onChangeText={setManualVenmo}
              placeholder="Venmo username (recommended)"
              autoCapitalize="none"
              placeholderTextColor="#9B9791"
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-base text-onyx-900 mb-3"
            />
            <TextInput
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder="Phone number (optional)"
              keyboardType="phone-pad"
              placeholderTextColor="#9B9791"
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-base text-onyx-900 mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowManualModal(false); setManualName(''); setManualPhone(''); setManualVenmo(''); }}
                className="flex-1 border border-neutral-300 rounded-xl py-3 items-center bg-white"
              >
                <Text className="text-base font-semibold text-onyx-900">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addManualFriend}
                className="flex-1 bg-onyx-900 rounded-xl py-3 items-center"
              >
                <Text className="text-base font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Continue */}
      <View className="bg-cream border-t border-neutral-200 px-4 py-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('AssignItems')}
          disabled={selectedFriends.length === 0}
          className={`rounded-xl py-4 items-center ${
            selectedFriends.length > 0 ? 'bg-onyx-900' : 'bg-neutral-200'
          }`}
        >
          <Text className={`text-base font-semibold ${selectedFriends.length > 0 ? 'text-white' : 'text-neutral-500'}`}>
            Continue with {selectedFriends.length} {selectedFriends.length === 1 ? 'person' : 'people'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
