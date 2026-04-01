import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExploreSkeleton } from '../../components/ui/Skeleton';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { LeaderboardBanner } from '../../components/leaderboard/LeaderboardBanner';
import { Shadows } from '../../constants/shadows';
import { searchUsers, followUser, unfollowUser } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { trackSearch } from '../../lib/analytics';
import type { User, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TRENDING_TAGS = ['Italian', 'Sushi', 'Brunch', 'Date Night', 'Vegan', 'Pizza'];

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
      const filtered = users.filter((u) => u.id !== user?.id);
      trackSearch({ searchQuery: text.trim(), resultsCount: filtered.length });
      setResults(filtered);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#1F2937', marginBottom: 12 }}>Explore</Text>
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: '#F3F4F6',
            },
            Shadows.card,
          ]}
        >
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search users..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, marginLeft: 8, fontSize: 15, color: '#1F2937' }}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {!hasSearched && !isSearching && <LeaderboardBanner />}

      {!hasSearched && !isSearching && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>Trending</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TRENDING_TAGS.map((tag) => (
              <AnimatedPressable
                key={tag}
                onPress={() => handleSearch(tag)}
                style={{
                  backgroundColor: '#F3F4F6',
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500' }}>{tag}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      )}

      {isSearching ? (
        <ExploreSkeleton />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const following = followingMap[item.id] ?? false;
            return (
              <AnimatedPressable
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginHorizontal: 16,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                <Avatar uri={item.avatar_url} displayName={item.display_name} size={46} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>{item.display_name}</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>@{item.username}</Text>
                </View>
                <Pressable
                  onPress={() => handleFollowToggle(item)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: following ? '#E5E7EB' : '#007AFF',
                    backgroundColor: following ? 'transparent' : '#007AFF',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: following ? '#1F2937' : '#FFFFFF' }}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </AnimatedPressable>
            );
          }}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState icon="search-outline" title="No results found" description="Try a different name or username." />
            ) : (
              <EmptyState icon="people-outline" title="Find friends on Dine" description="Search by name or username to discover and follow friends." />
            )
          }
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
