import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PostCard } from '../../components/post/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { FeedSkeleton } from '../../components/ui/Skeleton';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useSocialStore } from '../../stores/socialStore';
import { useAuthStore } from '../../stores/authStore';
import { getFeedPosts, likePost, unlikePost } from '../../services/post-service';
import { trackPostLiked } from '../../lib/analytics';
import type { Post, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = ['For You', 'Following', 'Nearby', 'Trending'] as const;
type Filter = (typeof FILTERS)[number];

export function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { feedPosts, setFeedPosts, toggleLike, isLoadingFeed, setLoadingFeed } = useSocialStore();
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [filter, setFilter] = useState<Filter>('For You');

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingFeed(true);
      setFeedError(false);
      const posts = await getFeedPosts(user.id);
      setFeedPosts(posts);
    } catch (err) {
      console.warn('Feed load error:', err);
      setFeedError(true);
    } finally {
      setLoadingFeed(false);
    }
  }, [user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = useCallback(async (post: Post) => {
    if (!user) return;
    toggleLike(post.id, user.id);
    try {
      if (post.is_liked) {
        await unlikePost(post.id, user.id);
      } else {
        trackPostLiked(post.id, post.author_id);
        await likePost(post.id, user.id, post.author_id);
      }
    } catch {
      toggleLike(post.id, user.id);
    }
  }, [user, toggleLike]);

  const handleComment = useCallback((postId: string) => {
    navigation.navigate('Comments', { postId });
  }, [navigation]);

  const header = (
    <FeedHeader
      filter={filter}
      onFilterChange={setFilter}
      onActivityPress={() => navigation.navigate('Activity' as never)}
    />
  );

  if (isLoadingFeed && feedPosts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <FeedSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}

      <FlatList
        data={feedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => handleLike(item)}
            onComment={() => handleComment(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          feedError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="No connection"
              description="Pull down to retry."
            />
          ) : (
            <EmptyState
              icon="restaurant-outline"
              title="No posts yet"
              description="Share your first meal or find friends to see their dining experiences."
              actionLabel="Post your first meal"
              onAction={() => navigation.navigate('PostCreation' as never)}
              secondaryActionLabel="Find friends"
              onSecondaryAction={() => navigation.navigate('Explore' as never)}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

// ─── Feed header ────────────────────────────────────────────────────────────

type FeedHeaderProps = {
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onActivityPress: () => void;
};

function FeedHeader({ filter, onFilterChange, onActivityPress }: FeedHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>dine</Text>

        <AnimatedPressable
          onPress={() => {
            // ENG-125: AI pill is visual only — real entry point lands in a later ticket.
          }}
          style={[styles.pill, styles.aiPill, Shadows.glowGold]}
          hitSlop={8}
        >
          <Text style={styles.aiGlyph}>✦</Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={onActivityPress}
          style={[styles.pill, styles.activityPill]}
          hitSlop={8}
        >
          <Ionicons name="heart-outline" size={20} color={Onyx[900]} />
        </AnimatedPressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <AnimatedPressable
              key={f}
              onPress={() => onFilterChange(f)}
              style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  active ? styles.filterLabelActive : styles.filterLabelInactive,
                ]}
              >
                {f}
              </Text>
            </AnimatedPressable>
          );
        })}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Semantic.bgCream,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  wordmark: {
    flex: 1,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -1.36, // -0.04em × 34
    color: Onyx[900],
  },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPill: {
    backgroundColor: Gold[400],
  },
  aiGlyph: {
    fontSize: 16,
    fontWeight: '700',
    color: Onyx[900],
  },
  activityPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Neutral[200],
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  filterChipInactive: {
    backgroundColor: 'transparent',
    borderColor: Neutral[300],
  },
  filterLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  filterLabelInactive: {
    color: Neutral[500],
  },
});
