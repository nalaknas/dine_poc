import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { Shadows } from '../../constants/shadows';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useToast } from '../../contexts/ToastContext';
import {
  buildInviteUrl,
  fetchWaitlistSignups,
  markDismissed,
  markInvited,
  type WaitlistFilter,
  type WaitlistSignup,
} from '../../services/waitlist-admin-service';
import { track } from '../../lib/analytics';

const FILTERS: { key: WaitlistFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'invited', label: 'Invited' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

export function WaitlistAdminScreen() {
  const { profile } = useUserProfileStore();
  const { showToast } = useToast();
  const [signups, setSignups] = useState<WaitlistSignup[]>([]);
  const [filter, setFilter] = useState<WaitlistFilter>('pending');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchWaitlistSignups(filter);
      setSignups(rows);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load waitlist');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    void track('waitlist_admin_viewed', { filter });
  }, [filter]);

  const visibleSignups = useMemo(() => {
    if (!search.trim()) return signups;
    const q = search.trim().toLowerCase();
    return signups.filter(
      (s) =>
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)),
    );
  }, [signups, search]);

  // Client-side gate as a backstop. The RLS policies on waitlist_signups
  // only let admins SELECT/UPDATE — non-admins get an empty list anyway —
  // but rendering an explicit unauthorized state is friendlier than a
  // confusing empty screen if a non-admin somehow lands here.
  if (!profile?.is_admin) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="lock-closed-outline" size={36} color={Neutral[400]} />
        <Text style={styles.errorTitle}>Admin only</Text>
        <Text style={styles.errorBody}>
          You don't have access to this screen. If you should, ping Sanka to flip your account.
        </Text>
      </SafeAreaView>
    );
  }

  const handleRowMenu = (signup: WaitlistSignup) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('iOS only', 'This action sheet is iOS-only for now.');
      return;
    }
    const isPending = !signup.invited_at && !signup.dismissed_at;
    const labels = isPending
      ? ['Send invite', 'Mark invited (no email)', 'Dismiss', 'Close']
      : ['Send invite again', 'Close'];
    const cancelButtonIndex = labels.length - 1;
    const destructiveButtonIndex = isPending ? 2 : -1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex,
        destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        title: signup.email ?? signup.phone ?? 'Signup',
        message: new Date(signup.created_at).toLocaleString(),
      },
      (idx) => {
        if (isPending) {
          if (idx === 0) void handleSendInvite(signup, true);
          else if (idx === 1) void handleSendInvite(signup, false);
          else if (idx === 2) void handleDismiss(signup);
        } else if (idx === 0) void handleSendInvite(signup, true);
      },
    );
  };

  const handleSendInvite = async (signup: WaitlistSignup, openClient: boolean) => {
    if (openClient) {
      const url = buildInviteUrl(signup);
      if (!url) {
        Alert.alert('No contact channel', 'This signup has neither email nor phone.');
        return;
      }
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert("Can't open mail/SMS app", 'Mark invited manually if you sent it elsewhere.');
        return;
      }
      await Linking.openURL(url);
    }
    try {
      await markInvited(signup.id);
      void track('waitlist_invite_sent', {
        signup_id: signup.id,
        channel: signup.email ? 'email' : 'sms',
        opened_client: openClient,
      });
      showToast({ message: 'Marked invited', type: 'success' });
      // Optimistically remove from pending view; refresh from server too.
      setSignups((prev) => prev.filter((s) => s.id !== signup.id));
      void refresh();
    } catch (err: any) {
      Alert.alert('Could not mark invited', err?.message ?? 'Try again.');
    }
  };

  const handleDismiss = async (signup: WaitlistSignup) => {
    try {
      await markDismissed(signup.id);
      void track('waitlist_signup_dismissed', { signup_id: signup.id });
      showToast({ message: 'Dismissed', type: 'success' });
      setSignups((prev) => prev.filter((s) => s.id !== signup.id));
      void refresh();
    } catch (err: any) {
      Alert.alert('Could not dismiss', err?.message ?? 'Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <AnimatedPressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {f.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search email or phone…"
          placeholderTextColor={Neutral[400]}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {isLoading && signups.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={Onyx[900]} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Couldn't load</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : visibleSignups.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={36} color={Neutral[400]} />
            <Text style={styles.errorTitle}>
              {search.trim() ? 'No matches' : `No ${filter === 'all' ? '' : filter + ' '}signups`}
            </Text>
            {filter === 'pending' && !search.trim() && (
              <Text style={styles.errorBody}>
                You're caught up. New signups from the landing page will show up here.
              </Text>
            )}
          </View>
        ) : (
          visibleSignups.map((s) => (
            <AnimatedPressable
              key={s.id}
              onPress={() => handleRowMenu(s)}
              style={[styles.row, Shadows.card]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowPrimary} numberOfLines={1}>
                  {s.email ?? s.phone ?? '(no contact)'}
                </Text>
                <Text style={styles.rowMeta}>
                  {s.email && s.phone ? `${s.phone} · ` : ''}
                  {new Date(s.created_at).toLocaleDateString()}
                  {s.source_split_request_id ? ' · from a split' : ''}
                </Text>
              </View>
              <StatusBadge signup={s} />
              <Ionicons name="chevron-forward" size={16} color={Neutral[400]} />
            </AnimatedPressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ signup }: { signup: WaitlistSignup }) {
  if (signup.invited_at) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.10)' }]}>
        <Text style={[styles.badgeLabel, { color: '#047857' }]}>invited</Text>
      </View>
    );
  }
  if (signup.dismissed_at) {
    return (
      <View style={[styles.badge, { backgroundColor: Neutral[200] }]}>
        <Text style={[styles.badgeLabel, { color: Neutral[500] }]}>dismissed</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: Gold[100] }]}>
      <Text style={[styles.badgeLabel, { color: Onyx[900] }]}>pending</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Semantic.bgCream },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[200],
    backgroundColor: '#FFFFFF',
  },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Neutral[100],
  },
  filterPillActive: { backgroundColor: Onyx[900] },
  filterLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Neutral[600],
  },
  filterLabelActive: { color: '#FFFFFF' },
  searchInput: {
    backgroundColor: Neutral[100],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Onyx[900],
  },
  scrollContent: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Neutral[500],
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  errorTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: Onyx[900],
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Neutral[500],
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
