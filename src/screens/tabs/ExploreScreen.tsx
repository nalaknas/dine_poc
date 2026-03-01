import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { searchUsers } from '../../services/user-service';
import { followUser, unfollowUser, isFollowing } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import type { User, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { setIsFollowing, isFollowing: followingMap } = useUserProfileStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const users = await searchUsers(text.trim());
      setResults(users.filter((u) => u.id !== user?.id));
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  const handleFollowToggle = useCallback(async (targetUser: User) => {
    if (!user) return;
    const currently = followingMap[targetUser.id] ?? false;
    setIsFollowing(targetUser.id, !currently);
    try {
      if (currently) {
        await unfollowUser(user.id, targetUser.id);
      } else {
        await followUser(user.id, targetUser.id);
      }
    } catch {
      setIsFollowing(targetUser.id, currently);
    }
  }, [user, followingMap, setIsFollowing]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-3 pb-4 border-b border-border-light">
        <Text className="text-2xl font-bold text-text-primary mb-3">Explore</Text>
        <View className="flex-row items-center bg-background-secondary rounded-xl px-3 py-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search users..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-base text-text-primary"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const following = followingMap[item.id] ?? false;
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                className="flex-row items-center px-4 py-3 border-b border-border-light"
              >
                <Avatar uri={item.avatar_url} displayName={item.display_name} size={46} />
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-text-primary">{item.display_name}</Text>
                  <Text className="text-sm text-text-secondary">@{item.username}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleFollowToggle(item)}
                  className={`px-4 py-1.5 rounded-lg border ${
                    following ? 'border-border bg-transparent' : 'border-accent bg-accent'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${following ? 'text-text-primary' : 'text-white'}`}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState
                icon="search-outline"
                title="No results found"
                description="Try a different name or username."
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="Find friends on Dine"
                description="Search by name or username to discover and follow friends."
              />
            )
          }
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
