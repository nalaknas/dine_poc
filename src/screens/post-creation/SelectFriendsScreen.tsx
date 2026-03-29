import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform,
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
    isLoaded: contactsLoaded, loadContacts,
    addContact, updateContact, importFromPhone,
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
  const [isImporting, setIsImporting] = useState(false);
  // Venmo editing
  const [editingVenmoId, setEditingVenmoId] = useState<string | null>(null);
  const [editingVenmoValue, setEditingVenmoValue] = useState('');

  // Load frequently tagged friends on mount
  useEffect(() => {
    if (user) {
      getFrequentFriends(user.id).then(setFrequentFriends).catch(() => {});
    }
  }, [user]);

  // Top contacts (from server-side contacts, excludes self)
  const topContacts = useContactsStore.getState().getTopContacts(10)
    .filter((c) => c.linked_user_id !== user?.id);

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

  const handleImportContacts = async () => {
    if (!user) return;
    setIsImporting(true);
    try {
      const count = await importFromPhone(user.id);
      if (count > 0) {
        Alert.alert('Imported', `${count} contact${count === 1 ? '' : 's'} added.`);
      } else {
        Alert.alert('Up to date', 'No new contacts to import.');
      }
    } catch (err) {
      console.error('Import contacts error:', err);
      Alert.alert('Error', `Could not import contacts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setIsImporting(false);
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

      {/* Import from Contacts button */}
      {query.length === 0 && (
        <View className="px-4 pb-2">
          <TouchableOpacity
            onPress={handleImportContacts}
            disabled={isImporting}
            className="flex-row items-center bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mb-3"
          >
            <View className="w-9 h-9 bg-accent/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="people" size={18} color="#007AFF" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-accent">
                {isImporting ? 'Importing...' : 'Import from Contacts'}
              </Text>
              <Text className="text-xs text-text-secondary">Add friends from your phone</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Your Contacts — people you've added or split with before */}
      {topContacts.length > 0 && query.length === 0 && (
        <View className="px-4 pb-2">
          <Text className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Your Contacts
          </Text>
          {topContacts.map((contact) => {
            const selected = isContactSelected(contact);
            const isEditingThis = editingVenmoId === contact.id;
            const displayName = contact.linked_user?.display_name ?? contact.display_name;
            const username = contact.linked_user?.username;
            const avatarUrl = contact.linked_user?.avatar_url;
            return (
              <View key={contact.id} className="flex-row items-center py-2.5 border-b border-border-light">
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
                  <Text className="text-xs text-text-secondary">Not on Dine? Add them with their phone number</Text>
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
              Add their number so they can join Dine later
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
