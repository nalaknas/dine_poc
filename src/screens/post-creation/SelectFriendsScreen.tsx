import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useContactsStore, contactToFriend } from '../../stores/contactsStore';
import { searchUsers, getFrequentFriends } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import type { User, Friend, Contact } from '../../types';
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
  const {
    contacts, isLoaded: contactsLoaded, loadContacts,
    addContact, updateContact, pickContact,
  } = useContactsStore();

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

  // Load contacts from server on mount
  useEffect(() => {
    if (user && !contactsLoaded) {
      loadContacts(user.id);
    }
  }, [user, contactsLoaded]);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [frequentFriends, setFrequentFriends] = useState<User[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualVenmo, setManualVenmo] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  // Venmo editing
  const [editingVenmoId, setEditingVenmoId] = useState<string | null>(null);
  const [editingVenmoValue, setEditingVenmoValue] = useState('');

  // Load frequently tagged friends on mount
  useEffect(() => {
    if (user) {
      getFrequentFriends(user.id).then(setFrequentFriends).catch(() => {});
    }
  }, [user]);

  // All contacts sorted by split_count, excluding self
  const allContacts = useMemo(() => {
    return [...contacts]
      .filter((c) => c.linked_user_id !== user?.id)
      .sort((a, b) => b.split_count - a.split_count);
  }, [contacts, user?.id]);

  // Filter contacts locally when there's a search query
  const filteredContacts = useMemo(() => {
    if (query.trim().length < 2) return allContacts;
    const lower = query.toLowerCase();
    return allContacts.filter((c) =>
      c.display_name.toLowerCase().includes(lower) ||
      (c.linked_user?.username?.toLowerCase().includes(lower) ?? false) ||
      (c.phone_number?.includes(query) ?? false),
    );
  }, [allContacts, query]);

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

  const toggleContact = (contact: Contact) => {
    const friend = contactToFriend(contact);
    const existing = selectedFriends.find((f) =>
      contact.linked_user_id
        ? f.user_id === contact.linked_user_id || f.id === contact.linked_user_id
        : f.contact_id === contact.id || f.id === contact.id
    );
    if (existing) {
      removeSelectedFriend(existing.id);
    } else {
      trackFriendInvited('contact');
      addSelectedFriend(friend);
    }
  };

  const isContactSelected = (contact: Contact) => {
    return selectedFriends.some((f) =>
      contact.linked_user_id
        ? f.user_id === contact.linked_user_id || f.id === contact.linked_user_id
        : f.contact_id === contact.id || f.id === contact.id
    );
  };

  const addManualFriend = async () => {
    if (!manualName.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    if (!user) return;

    try {
      // Save to server-side contacts
      const contact = await addContact({
        owner_id: user.id,
        display_name: manualName.trim(),
        phone_number: manualPhone.trim() || undefined,
        venmo_username: manualVenmo.trim() || undefined,
      });

      // Add to selected friends for this bill split
      trackFriendInvited('manual');
      addSelectedFriend(contactToFriend(contact));
    } catch {
      // Fallback: add as ephemeral friend if contact creation fails
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

  const startEditVenmo = (contact: Contact) => {
    setEditingVenmoId(contact.id);
    setEditingVenmoValue(contact.venmo_username ?? '');
  };

  const saveEditVenmo = async () => {
    if (editingVenmoId) {
      const venmo = editingVenmoValue.trim();
      await updateContact(editingVenmoId, { venmo_username: venmo || undefined });
      // Also update in selectedFriends if this contact is currently selected
      const selected = selectedFriends.find((f) => f.contact_id === editingVenmoId);
      if (selected) {
        removeSelectedFriend(selected.id);
        addSelectedFriend({ ...selected, venmo_username: venmo || undefined });
      }
    }
    setEditingVenmoId(null);
    setEditingVenmoValue('');
  };

  const handlePickContact = async () => {
    if (!user) return;
    setIsPicking(true);
    try {
      const contact = await pickContact(user.id);
      if (contact) {
        // Auto-select the picked contact for this bill split
        const friend = contactToFriend(contact);
        if (!selectedFriends.some((f) => f.contact_id === contact.id || f.id === contact.id)) {
          trackFriendInvited('contact');
          addSelectedFriend(friend);
        }
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not pick contact');
    }
    setIsPicking(false);
  };

  const isSearching = query.trim().length >= 2;
  const showInlineAddManual = isSearching && searchResults.length === 0;

  const renderContactRow = (contact: Contact) => {
    const selected = isContactSelected(contact);
    const isEditingThis = editingVenmoId === contact.id;
    const displayName = contact.linked_user?.display_name ?? contact.display_name;
    const username = contact.linked_user?.username;
    const avatarUrl = contact.linked_user?.avatar_url;
    return (
      <View key={contact.id} className="flex-row items-center py-2.5 border-b border-border-light mx-4">
        <TouchableOpacity
          onPress={() => toggleContact(contact)}
          className="flex-row items-center flex-1"
          activeOpacity={0.7}
        >
          <Avatar uri={avatarUrl} displayName={displayName} size={42} />
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-text-primary">{displayName}</Text>
            <View className="flex-row items-center">
              {username && (
                <Text className="text-sm text-text-secondary">@{username}</Text>
              )}
              {contact.phone_number && !username && (
                <Text className="text-sm text-text-secondary">{contact.phone_number}</Text>
              )}
              {contact.split_count > 0 && (
                <Text className="text-xs text-text-tertiary ml-1">
                  · {contact.split_count} {contact.split_count === 1 ? 'split' : 'splits'}
                </Text>
              )}
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
            onPress={() => startEditVenmo(contact)}
            className="flex-row items-center mr-2"
            activeOpacity={0.7}
          >
            {contact.venmo_username ? (
              <View className="flex-row items-center bg-blue-50 rounded-full px-2 py-0.5">
                <Text className="text-xs text-accent font-medium">@{contact.venmo_username}</Text>
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
  };

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
            placeholder="Search by name or phone number..."
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

      {/* Scrollable content area */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Action buttons — always visible when not searching */}
        {!isSearching && (
          <View className="px-4 pb-2 flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowManualModal(true)}
              className="flex-1 flex-row items-center bg-accent/10 border border-accent/30 rounded-xl px-3 py-3"
            >
              <View className="w-8 h-8 bg-accent/20 rounded-full items-center justify-center mr-2">
                <Ionicons name="person-add" size={16} color="#007AFF" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-accent">Add by Phone</Text>
                <Text className="text-xs text-text-secondary">Invite via text</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickContact}
              disabled={isPicking}
              className="flex-1 flex-row items-center bg-background-secondary border border-border rounded-xl px-3 py-3"
            >
              <View className="w-8 h-8 bg-background-tertiary rounded-full items-center justify-center mr-2">
                <Ionicons name="person-circle-outline" size={16} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  {isPicking ? 'Opening...' : 'Pick Contact'}
                </Text>
                <Text className="text-xs text-text-secondary">From phone</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Frequent friends — quick add (from Supabase tagged history) */}
        {frequentFriends.length > 0 && !isSearching && (
          <View className="px-4 py-2">
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

        {/* Contacts list — all contacts, scrollable */}
        {!isSearching && filteredContacts.length > 0 && (
          <View className="pb-2">
            <Text className="text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wide px-4">
              Your Contacts ({filteredContacts.length})
            </Text>
            {filteredContacts.map(renderContactRow)}
          </View>
        )}

        {/* Empty state — no contacts yet */}
        {!isSearching && filteredContacts.length === 0 && contactsLoaded && (
          <View className="px-4 py-8 items-center">
            <View className="w-16 h-16 bg-background-secondary rounded-full items-center justify-center mb-3">
              <Ionicons name="people-outline" size={32} color="#9CA3AF" />
            </View>
            <Text className="text-base font-semibold text-text-primary mb-1">No contacts yet</Text>
            <Text className="text-sm text-text-secondary text-center">
              Add friends by phone number or import from your phone contacts to get started.
            </Text>
          </View>
        )}

        {/* Search results */}
        {isSearching && (
          <View>
            {/* Matching contacts from your list */}
            {filteredContacts.length > 0 && (
              <View className="pb-2">
                <Text className="text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wide px-4">
                  Your Contacts
                </Text>
                {filteredContacts.map(renderContactRow)}
              </View>
            )}

            {/* Dine users from search */}
            {searchResults.length > 0 && (
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

            {/* No results — add manually prompt */}
            {showInlineAddManual && filteredContacts.length === 0 && (
              <View className="px-4 py-3">
                <Text className="text-sm text-text-secondary mb-2">No results for "{query}"</Text>
              </View>
            )}

            {/* Add manually option always visible during search */}
            <TouchableOpacity
              onPress={() => {
                setManualName(query.trim());
                setShowManualModal(true);
              }}
              className="flex-row items-center px-4 py-3 border-b border-border-light"
            >
              <View className="w-10 h-10 bg-accent/10 rounded-full items-center justify-center mr-3">
                <Ionicons name="person-add" size={20} color="#007AFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-accent">Add "{query.trim()}" by phone</Text>
                <Text className="text-xs text-text-secondary">They'll get a text to join the split</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
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
              value={manualPhone}
              onChangeText={setManualPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-1"
            />
            <Text className="text-xs text-text-tertiary mb-3 ml-1">
              They'll get a text to join the split — meals backfill when they sign up
            </Text>
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
