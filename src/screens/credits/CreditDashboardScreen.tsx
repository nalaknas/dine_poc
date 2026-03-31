import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TierBadge } from '../../components/ui/TierBadge';
import { Shadows } from '../../constants/shadows';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { fetchCreditEvents, fetchCreditSummary } from '../../services/credit-service';
import type { CreditSummary } from '../../services/credit-service';
import type { CreditEvent, CreditEventType, UserTier } from '../../types';
import { TierThresholds } from '../../types';

// ─── Tier helpers ────────────────────────────────────────────────────────────

const TIER_ORDER: UserTier[] = ['rock', 'bronze', 'silver', 'gold', 'platinum', 'black'];

const TIER_COLORS: Record<UserTier, string> = {
  rock: '#9CA3AF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  black: '#1A1A1A',
};

function getNextTier(current: UserTier): UserTier | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

function getTierProgress(credits: number, currentTier: UserTier) {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return { progress: 1, remaining: 0, nextTierName: null };

  const currentThreshold = TierThresholds[currentTier];
  const nextThreshold = TierThresholds[nextTier];
  const range = nextThreshold - currentThreshold;
  const earned = credits - currentThreshold;
  const progress = Math.min(earned / range, 1);
  const remaining = nextThreshold - credits;

  return {
    progress,
    remaining: Math.max(remaining, 0),
    nextTierName: nextTier.charAt(0).toUpperCase() + nextTier.slice(1),
  };
}

// ─── Credit event display helpers ────────────────────────────────────────────

const EVENT_ICONS: Record<CreditEventType, string> = {
  post_quality: 'restaurant-outline',
  streak: 'flame-outline',
  discovery: 'compass-outline',
  attribution: 'people-outline',
  referral: 'person-add-outline',
};

const EVENT_COLORS: Record<CreditEventType, string> = {
  post_quality: '#007AFF',
  streak: '#F59E0B',
  discovery: '#10B981',
  attribution: '#8B5CF6',
  referral: '#EC4899',
};

function formatEventDescription(event: CreditEvent): string {
  const meta = event.metadata as Record<string, string | undefined>;
  switch (event.type) {
    case 'post_quality':
      return meta?.restaurant_name
        ? `Posted at ${meta.restaurant_name}`
        : 'Quality meal post';
    case 'streak':
      return meta?.weeks
        ? `${meta.weeks}-week streak`
        : 'Posting streak bonus';
    case 'discovery':
      return meta?.restaurant_name
        ? `Discovered ${meta.restaurant_name}`
        : 'New restaurant discovery';
    case 'attribution':
      return meta?.from_user
        ? `${meta.from_user} visited your rec`
        : 'Attribution bonus';
    case 'referral':
      return meta?.referred_user
        ? `Referred ${meta.referred_user}`
        : 'Referral bonus';
    default:
      return 'Credit earned';
  }
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function getStreakMultiplier(streakWeeks: number): string {
  if (streakWeeks >= 8) return '1.5x';
  if (streakWeeks >= 4) return '1.2x';
  if (streakWeeks >= 2) return '1.1x';
  return '1x';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function CreditDashboardScreen() {
  const { user } = useAuthStore();
  const { profile } = useUserProfileStore();
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [evts, sum] = await Promise.all([
        fetchCreditEvents(user.id, 30),
        fetchCreditSummary(user.id),
      ]);
      setEvents(evts);
      setSummary(sum);
    } catch (e) {
      setError('Failed to load credit data. Pull to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const currentTier = profile?.current_tier ?? 'rock';
  const creditBalance = profile?.credit_balance ?? 0;
  const streakWeeks = profile?.streak_weeks ?? 0;
  const tierColor = TIER_COLORS[currentTier];
  const { progress, remaining, nextTierName } = getTierProgress(creditBalance, currentTier);
  const multiplier = getStreakMultiplier(streakWeeks);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
      >
        {/* ── Header: tier badge + balance ──────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, alignItems: 'center' }}>
          <TierBadge tier={currentTier} variant="profile" />
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#1F2937', marginTop: 8 }}>
            {creditBalance.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>total credits</Text>
        </View>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={{ fontSize: 13, color: '#DC2626', marginLeft: 8, flex: 1 }}>
              {error}
            </Text>
          </View>
        )}

        {/* ── Tier progress bar ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View
            style={[{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
            }, Shadows.card]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}>
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Text>
              {nextTierName && (
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>
                  {nextTierName}
                </Text>
              )}
            </View>
            <View style={{ height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.max(progress * 100, 2)}%` as any,
                  height: '100%',
                  backgroundColor: tierColor,
                  borderRadius: 5,
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
              {nextTierName
                ? `${remaining.toLocaleString()} more credits to ${nextTierName} — keep posting!`
                : 'Max tier reached!'}
            </Text>
          </View>
        </View>

        {/* ── Streak section ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View
            style={[{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }, Shadows.card]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(245,158,11,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="flame" size={22} color="#F59E0B" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>
                  {streakWeeks} week{streakWeeks !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                  Current streak
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: 'rgba(245,158,11,0.12)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                {multiplier}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Credit summary cards ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'This Week', value: summary?.thisWeek ?? 0 },
              { label: 'This Month', value: summary?.thisMonth ?? 0 },
              { label: 'All Time', value: summary?.allTime ?? 0 },
            ].map((card) => (
              <View
                key={card.label}
                style={[{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                }, Shadows.card]}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937' }}>
                  {card.value.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  {card.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recent activity ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>
            Recent Activity
          </Text>

          {!error && events.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="sparkles-outline" size={36} color="#9CA3AF" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>
                No credit events yet
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>
                Post your first meal to start earning credits!
              </Text>
            </View>
          )}

          {events.map((event) => {
            const iconName = EVENT_ICONS[event.type] ?? 'star-outline';
            const iconColor = EVENT_COLORS[event.type] ?? '#007AFF';

            return (
              <View
                key={event.id}
                style={[{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                }, Shadows.sm]}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: `${iconColor}18`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name={iconName as any} size={18} color={iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#1F2937' }}>
                    {formatEventDescription(event)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {getRelativeTime(event.created_at)}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: event.credits >= 0 ? '#10B981' : '#EF4444' }}>
                  {event.credits >= 0 ? '+' : ''}{event.credits}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
