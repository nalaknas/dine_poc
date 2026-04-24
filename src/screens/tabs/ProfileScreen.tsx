import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, RefreshControl,
  Image, Dimensions, Share, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { ProfileSkeleton } from '../../components/ui/Skeleton';
import { Gold, Gradients, Indigo, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSocialStore } from '../../stores/socialStore';
import { getUserPosts, getTaggedPosts } from '../../services/post-service';
import type { Post, UserTier } from '../../types';
import { getFollowerCount, getFollowingCount } from '../../services/user-service';
import type { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 4) / 3; // 2px gap × 2 between 3 cols

const TIER_RANK: Record<UserTier, number> = {
  rock: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  black: 5,
};
const isGoldPlus = (tier?: UserTier): boolean =>
  tier ? TIER_RANK[tier] >= TIER_RANK.gold : false;

const TIER_LABEL: Record<UserTier, string> = {
  rock: 'ROCK',
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
  black: 'BLACK',
};

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { profile, followersCount, followingCount, setFollowCounts } = useUserProfileStore();
  const { myPosts, setMyPosts } = useSocialStore();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'map' | 'tagged'>('grid');
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [posts, followers, following, tagged] = await Promise.allSettled([
        getUserPosts(user.id, user.id),
        getFollowerCount(user.id),
        getFollowingCount(user.id),
        getTaggedPosts(user.id),
      ]);
      if (posts.status === 'fulfilled') setMyPosts(posts.value);
      if (tagged.status === 'fulfilled') setTaggedPosts(tagged.value);
      setFollowCounts(
        followers.status === 'fulfilled' ? followers.value : 0,
        following.status === 'fulfilled' ? following.value : 0,
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleShare = useCallback(async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out @${profile.username} on Dine — a dining journal you'll actually want to follow.${user?.id ? `\nhttps://dine.app/profile/${user.id}` : ''}`,
      });
    } catch {
      // user cancelled
    }
  }, [profile, user]);

  const joinedYear = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : null;

  // Photo posts → hero grid. Photoless posts → journal feed below.
  // Grid stays visually clean; photoless posts still get a dedicated home.
  const photoPosts = useMemo(
    () => myPosts.filter((p) => p.food_photos && p.food_photos.length > 0),
    [myPosts],
  );
  const journalPosts = useMemo(
    () => myPosts.filter((p) => !p.food_photos || p.food_photos.length === 0),
    [myPosts],
  );

  // Group journal posts by month, newest month first, newest post first within a month.
  // Lets the user scan "what did I eat out last month" without hunting.
  const journalByMonth = useMemo(() => {
    const sorted = [...journalPosts].sort((a, b) => {
      const aDate = a.meal_date || a.created_at;
      const bDate = b.meal_date || b.created_at;
      return bDate.localeCompare(aDate);
    });
    const groups: { key: string; label: string; posts: Post[] }[] = [];
    for (const post of sorted) {
      const d = new Date(post.meal_date || post.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        .toUpperCase();
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.posts.push(post);
      } else {
        groups.push({ key, label, posts: [post] });
      }
    }
    return groups;
  }, [journalPosts]);

  const gridData =
    activeTab === 'tagged' ? taggedPosts : activeTab === 'grid' ? photoPosts : myPosts;

  const header = (
    <View>
      {/* Top bar — share + settings.
          Edit Profile lives under Settings › Account; Share was moved out of
          the identity block so the post grid can breathe. */}
      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={handleShare}
          style={styles.headerPill}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share profile"
        >
          <Ionicons name="share-outline" size={18} color={Onyx[900]} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => navigation.navigate('Settings')}
          style={[styles.headerPill, { marginLeft: 8 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={18} color={Onyx[900]} />
        </AnimatedPressable>
      </View>

      {/* Centered profile block */}
      <View style={styles.identityBlock}>
        <View style={styles.avatarRing}>
          <Avatar uri={profile?.avatar_url} displayName={profile?.display_name ?? 'Me'} size={88} />
        </View>

        <Text style={styles.handle}>@{profile?.username ?? '…'}</Text>

        <Text style={styles.metaLine}>
          {profile?.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}` : ''}
          {profile?.city && joinedYear ? ' · ' : ''}
          {joinedYear ? `joined ${joinedYear}` : ''}
        </Text>

        {isGoldPlus(profile?.current_tier) && profile?.current_tier && (
          <View style={{ marginTop: 10, alignSelf: 'center' }}>
            <LinearGradient
              colors={[Gradients.gold[0], Gradients.gold[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierBadge}
            >
              <Text style={styles.tierBadgeText}>
                ◇ {TIER_LABEL[profile.current_tier]} DISCOVERER
              </Text>
            </LinearGradient>
          </View>
        )}

        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      {/* Stat row with hairlines */}
      <View style={styles.statRow}>
        {[
          { label: 'posts', value: myPosts.length },
          { label: 'followers', value: followersCount },
          { label: 'following', value: followingCount },
        ].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{formatCount(stat.value)}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Grid tab indicators */}
      <View style={styles.tabRow}>
        {([
          { key: 'grid' as const, icon: 'grid-outline' as const },
          { key: 'list' as const, icon: 'list-outline' as const },
          { key: 'map' as const, icon: 'map-outline' as const },
          { key: 'tagged' as const, icon: 'pricetag-outline' as const },
        ]).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
            >
              <Ionicons
                name={tab.icon}
                size={20}
                color={active ? Onyx[900] : Neutral[400]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (isLoading && myPosts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={gridData}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const tagEntry = activeTab === 'tagged'
            ? item.tagged_friends?.find((f) => f.user_id === user?.id)
            : undefined;
          const isUnrated = tagEntry && !tagEntry.has_rated;
          const showGoldPill = (item.overall_rating ?? 0) >= 8.5;

          return (
            <AnimatedPressable
              onPress={() => navigation.navigate('MealDetail', { postId: item.id })}
              style={styles.gridItem}
            >
              <Image
                source={{ uri: item.food_photos[0] }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />

              {/* Gold rating pill — reserved for posts ≥ 8.5 */}
              {showGoldPill && (
                <LinearGradient
                  colors={[Gradients.gold[0], Gradients.gold[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ratingPill}
                >
                  <Text style={styles.ratingPillText}>
                    ★ {item.overall_rating.toFixed(1)}
                  </Text>
                </LinearGradient>
              )}

              {/* Unrated tag overlay */}
              {isUnrated && (
                <View style={styles.unratedBadge}>
                  <Text style={styles.unratedBadgeText}>RATE</Text>
                </View>
              )}
            </AnimatedPressable>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Indigo.linear} />
        }
        ListEmptyComponent={
          activeTab === 'tagged' ? (
            <EmptyState
              icon="pricetag-outline"
              title="No tagged meals"
              description="When friends tag you in their meals, they'll appear here."
            />
          ) : activeTab === 'grid' && journalPosts.length > 0 ? null : (
            <EmptyState
              icon="restaurant-outline"
              title="No meals yet"
              description="Create your first post to build your dining journal."
              actionLabel="Add Meal"
              onAction={() => navigation.navigate('PostCreation' as never)}
            />
          )
        }
        ListFooterComponent={
          activeTab === 'grid' && journalByMonth.length > 0 ? (
            <View style={styles.journalSection}>
              <View style={styles.journalDivider}>
                <Text style={styles.journalLabel}>Journal</Text>
              </View>
              {journalByMonth.map((group, groupIndex) => (
                <View key={group.key}>
                  <Text
                    style={[
                      styles.journalMonthHeader,
                      groupIndex === 0 && styles.journalMonthHeaderFirst,
                    ]}
                  >
                    {group.label}
                  </Text>
                  {group.posts.map((post) => (
                    <AnimatedPressable
                      key={post.id}
                      onPress={() => navigation.navigate('MealDetail', { postId: post.id })}
                      style={styles.journalRow}
                    >
                      <View style={styles.journalDateCol}>
                        <Text style={styles.journalDate}>
                          {formatJournalDate(post.meal_date || post.created_at)}
                        </Text>
                        {post.overall_rating > 0 && (
                          <Text style={styles.journalRating}>
                            ★ {post.overall_rating.toFixed(1)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.journalBody}>
                        <Text style={styles.journalRestaurant} numberOfLines={1}>
                          {post.restaurant_name || 'Untitled'}
                        </Text>
                        {post.caption ? (
                          <Text style={styles.journalCaption} numberOfLines={2}>
                            {post.caption}
                          </Text>
                        ) : null}
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  }
  return String(n);
}

function formatJournalDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${dow} ${date.getDate()}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerPill: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Gold[400],
  },
  handle: {
    marginTop: 12,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 24,
    letterSpacing: -0.24, // -0.01em × 24
    color: Onyx[900],
  },
  metaLine: {
    marginTop: 2,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8B84',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tierBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.44, // +0.04em × 11
    color: Onyx[900],
  },
  bio: {
    marginTop: 14,
    maxWidth: 280,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21, // 1.5
    color: '#2B2926',
  },
  statRow: {
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: Neutral[200],
    borderBottomColor: Neutral[200],
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 20,
    color: Onyx[900],
  },
  statLabel: {
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#8E8B84',
    textTransform: 'uppercase',
    letterSpacing: 0.66, // +0.06em × 11
  },
  tabRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Neutral[200],
  },
  tab: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  tabActive: {
    borderBottomColor: Onyx[900],
  },
  tabInactive: {
    borderBottomColor: 'transparent',
  },
  gridRow: {
    gap: 2,
    marginBottom: 2,
  },
  gridItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    overflow: 'hidden',
    backgroundColor: Neutral[100],
  },
  journalSection: {
    marginTop: 28,
    paddingHorizontal: 16,
  },
  journalDivider: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[200],
    marginBottom: 4,
  },
  journalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#8E8B84',
    textTransform: 'uppercase',
    letterSpacing: 0.66,
  },
  journalMonthHeader: {
    marginTop: 28,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[200],
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.3, // editorial feel
    color: Onyx[900],
  },
  journalMonthHeaderFirst: {
    marginTop: 16, // smaller gap since the JOURNAL label sits just above
  },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[100],
  },
  journalDateCol: {
    width: 64,
    paddingTop: 2,
  },
  journalDate: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#8E8B84',
    letterSpacing: 0.5,
  },
  journalRating: {
    marginTop: 4,
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: Onyx[900],
  },
  journalBody: {
    flex: 1,
  },
  journalRestaurant: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    letterSpacing: -0.16,
    color: Onyx[900],
  },
  journalCaption: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#2B2926',
  },
  ratingPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingPillText: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  unratedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unratedBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
