import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Keyboard, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExploreSkeleton } from '../../components/ui/Skeleton';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Gold, Indigo, Neutral, Onyx, Semantic } from '../../constants/colors';
import { searchUsers, followUser, unfollowUser } from '../../services/user-service';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { trackSearch } from '../../lib/analytics';
import type { User, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Warm food-toned gradients for the cuisine grid. The prototype used a
// pure-gold tone for Thai; swapped to olive here so brand gold stays rare.
const CUISINES: ReadonlyArray<{ name: string; from: string; to: string }> = [
  { name: 'Italian',  from: '#D97757', to: '#A85530' },
  { name: 'Japanese', from: '#B87333', to: '#8B5A2B' },
  { name: 'Thai',     from: '#6B8E23', to: '#4A6419' },
  { name: 'Mexican',  from: '#A85530', to: '#7C3E22' },
  { name: 'French',   from: '#1A3D5C', to: '#0F2A44' },
  { name: 'Korean',   from: '#2B2926', to: '#0F0E0C' },
];

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

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const showIdleContent = !hasSearched && !isSearching;

  const header = (
    <View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Discover</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={18} color={Neutral[400]} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search cuisines, friends, dishes…"
            placeholderTextColor={Neutral[400]}
            style={styles.searchField}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <Pressable onPress={clearQuery} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Neutral[400]} />
            </Pressable>
          )}
        </View>
      </View>

      {showIdleContent && <IdleDiscover />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isSearching ? (
        <View>
          {header}
          <ExploreSkeleton />
        </View>
      ) : (
        <FlatList
          data={showIdleContent ? [] : results}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const following = followingMap[item.id] ?? false;
            return (
              <AnimatedPressable
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                style={styles.userRow}
              >
                <Avatar uri={item.avatar_url} displayName={item.display_name} size={46} />
                <View style={styles.userMeta}>
                  <Text style={styles.userName}>{item.display_name}</Text>
                  <Text style={styles.userHandle}>@{item.username}</Text>
                </View>
                <Pressable
                  onPress={() => handleFollowToggle(item)}
                  style={[styles.followButton, following ? styles.followButtonIdle : styles.followButtonActive]}
                >
                  <Text style={following ? styles.followLabelIdle : styles.followLabelActive}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </AnimatedPressable>
            );
          }}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState icon="search-outline" title="No results found" description="Try a different name or username." />
            ) : null
          }
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

// ─── Idle state: AI taste card + cuisine grid ───────────────────────────────

function IdleDiscover() {
  return (
    <View>
      {/* AI Taste Intelligence card */}
      <View style={styles.aiCard}>
        <LinearGradient
          colors={['#1A1A1A', '#2B2926']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Radial gold wash — approximated with a second circular gradient
            layer in the top-right corner. RN has no native radial gradient,
            so this is a layered linear + positioned blob, which reads the
            same in context. */}
        <View style={styles.aiWashClip}>
          <LinearGradient
            colors={['rgba(247,181,46,0.55)', 'rgba(247,181,46,0)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiWash}
          />
        </View>

        <View style={styles.aiContent}>
          <View style={styles.aiOverline}>
            <Text style={styles.aiOverlineDot}>◎</Text>
            <Text style={styles.aiOverlineText}>TASTE INTELLIGENCE</Text>
          </View>
          <Text style={styles.aiHeadline}>You love briny, high-acid flavors.</Text>
          <Text style={styles.aiBody}>
            Based on your saves, we think you'll love{' '}
            <Text style={styles.aiRestaurant}>Horses</Text> in Los Angeles.
          </Text>
          <AnimatedPressable
            onPress={() => {
              // Decorative for ENG-128 — real recs wiring is a follow-up ticket.
            }}
            style={styles.aiCta}
          >
            <Text style={styles.aiCtaLabel}>See 12 picks →</Text>
          </AnimatedPressable>
        </View>
      </View>

      {/* Browse by cuisine */}
      <View style={styles.cuisineSection}>
        <Text style={styles.cuisineHeader}>BROWSE BY CUISINE</Text>
        <View style={styles.cuisineGrid}>
          {CUISINES.map((c) => (
            <AnimatedPressable
              key={c.name}
              onPress={() => {
                // Decorative for ENG-128 — cuisine-filtered recs land later.
              }}
              style={styles.cuisineTile}
            >
              <LinearGradient
                colors={[c.from, c.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.cuisineLabel}>{c.name}</Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 30,
    letterSpacing: -0.6, // -0.02em × 30
    color: Onyx[900],
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Neutral[200],
    gap: 10,
  },
  searchField: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Onyx[900],
  },

  // AI card
  aiCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 180,
  },
  aiWashClip: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 240,
    height: 240,
    transform: [{ translateX: 80 }, { translateY: -80 }],
  },
  aiWash: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  aiContent: {
    padding: 20,
  },
  aiOverline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  aiOverlineDot: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Gold[400],
  },
  aiOverlineText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Gold[400],
    letterSpacing: 0.88, // +0.08em × 11
  },
  aiHeadline: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    lineHeight: 28, // 1.25
    letterSpacing: -0.33, // -0.015em × 22
    color: '#FFFFFF',
    marginBottom: 8,
    maxWidth: 280,
  },
  aiBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 16,
  },
  aiRestaurant: {
    fontFamily: 'Inter_600SemiBold',
    color: Gold[400],
  },
  aiCta: {
    alignSelf: 'flex-start',
    backgroundColor: Gold[400],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  aiCtaLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Onyx[900],
  },

  // Cuisine grid
  cuisineSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cuisineHeader: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Neutral[400],
    letterSpacing: 0.88, // +0.08em × 11
    marginBottom: 12,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuisineTile: {
    flexBasis: '48%',
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'flex-end',
  },
  cuisineLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 20,
    letterSpacing: -0.2, // -0.01em × 20
    color: '#FFFFFF',
  },

  // User result row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[200],
  },
  userMeta: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Onyx[900],
  },
  userHandle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Neutral[500],
    marginTop: 1,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  followButtonActive: {
    backgroundColor: Indigo.linear,
    borderColor: Indigo.linear,
  },
  followButtonIdle: {
    backgroundColor: 'transparent',
    borderColor: Neutral[200],
  },
  followLabelActive: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  followLabelIdle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Onyx[900],
  },
});
