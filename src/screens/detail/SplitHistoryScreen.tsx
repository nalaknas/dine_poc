import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Gold, Neutral, Onyx, Semantic, Success } from '../../constants/colors';
import { Shadows } from '../../constants/shadows';
import { useAuthStore } from '../../stores/authStore';
import { useSplitRequestsStore } from '../../stores/splitRequestsStore';
import { useToast } from '../../contexts/ToastContext';
import {
  cancelSenderSplit,
  resendSmsForSplit,
  senderMarkLinePaid,
  summarizeSplit,
  type SenderSplit,
  type SenderSplitLine,
} from '../../services/sender-split-service';
import { track } from '../../lib/analytics';
import { formatCurrency } from '../../utils/format';

export function SplitHistoryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { splits, isLoading, error, refresh, patchLine, cancelSplitLocal } =
    useSplitRequestsStore();
  const { showToast } = useToast();

  const doRefresh = useCallback(() => {
    if (user) void refresh(user.id);
  }, [user, refresh]);

  // Refetch on screen focus — replaces realtime for this PR (PR #4 will
  // wire a postgres_changes subscription once we enable the realtime
  // publication on split_request_lines).
  useFocusEffect(
    useCallback(() => {
      doRefresh();
    }, [doRefresh]),
  );

  useEffect(() => {
    void track('split_history_viewed', { split_count: splits.length });
  }, []);

  const handleSplitMenu = (split: SenderSplit) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not supported', 'This feature is iOS-only for now.');
      return;
    }
    const summary = summarizeSplit(split);
    const allPaid = summary.paid === summary.count;
    const allCancelled = summary.cancelled === summary.count;

    const options: { label: string; action: () => void; destructive?: boolean }[] = [];

    if (!allCancelled) {
      options.push({
        label: 'Resend SMS',
        action: () => void handleResend(split),
      });
      options.push({
        label: 'Cancel request',
        destructive: true,
        action: () => promptCancel(split),
      });
    }
    options.push({ label: 'Close', action: () => {} });

    const labels = options.map((o) => o.label);
    const cancelButtonIndex = labels.length - 1;
    const destructiveButtonIndex = options.findIndex((o) => o.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex,
        destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        title: split.restaurant_name,
        message: allPaid
          ? 'Everyone paid. Resend or cancel anyway?'
          : `${summary.paid}/${summary.count} paid · ${summary.viewed} viewed`,
      },
      (idx) => {
        const choice = options[idx];
        if (choice) choice.action();
      },
    );
  };

  const handleLineMenu = (split: SenderSplit, line: SenderSplitLine) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not supported', 'This feature is iOS-only for now.');
      return;
    }
    if (line.status === 'paid' || line.status === 'cancelled') return;

    const labels = ['Mark as paid', 'Close'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex: 1,
        title: line.recipient_name,
        message: `${formatCurrency(line.amount)} · ${line.status}`,
      },
      (idx) => {
        if (idx === 0) void handleMarkPaid(split, line);
      },
    );
  };

  const handleMarkPaid = async (split: SenderSplit, line: SenderSplitLine) => {
    // Optimistic: flip in-place; revert on failure.
    patchLine(split.id, line.id, { status: 'paid', paid_at: new Date().toISOString() });
    try {
      await senderMarkLinePaid(line.id);
      void track('sender_marked_line_paid', {
        line_id: line.id,
        split_request_id: split.id,
        amount: line.amount,
      });
      showToast({ message: `${line.recipient_name} marked paid`, type: 'success' });
    } catch (err: any) {
      patchLine(split.id, line.id, { status: line.status, paid_at: line.paid_at });
      Alert.alert('Could not mark paid', err?.message ?? 'Try again.');
    }
  };

  const promptCancel = (split: SenderSplit) => {
    Alert.alert(
      'Cancel this request?',
      `Recipients will see "this request was cancelled" if they open the link. You can\'t undo this.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => void handleCancel(split),
        },
      ],
    );
  };

  const handleCancel = async (split: SenderSplit) => {
    cancelSplitLocal(split.id);
    try {
      await cancelSenderSplit(split.id);
      void track('split_request_cancelled', {
        split_request_id: split.id,
        line_count: split.lines.length,
      });
      showToast({ message: 'Request cancelled', type: 'success' });
    } catch (err: any) {
      // Best-effort revert by refetching the truth from the server.
      doRefresh();
      Alert.alert('Could not cancel', err?.message ?? 'Try again.');
    }
  };

  const handleResend = async (split: SenderSplit) => {
    const opened = await resendSmsForSplit(split);
    if (!opened) {
      Alert.alert(
        'No SMS recipients',
        'This split has no phone-tagged recipients to resend to.',
      );
      return;
    }
    void track('split_request_resent', { split_request_id: split.id });
  };

  if (isLoading && splits.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={Onyx[900]} />
      </SafeAreaView>
    );
  }

  if (error && splits.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="alert-circle-outline" size={36} color={Neutral[400]} />
        <Text style={styles.errorTitle}>Couldn't load your requests</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <AnimatedPressable onPress={doRefresh} style={styles.retryBtn}>
          <Text style={styles.retryLabel}>Retry</Text>
        </AnimatedPressable>
      </SafeAreaView>
    );
  }

  if (!isLoading && splits.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="paper-plane-outline" size={40} color={Neutral[400]} />
        <Text style={styles.errorTitle}>No payment requests yet</Text>
        <Text style={styles.errorBody}>
          When you tap "Request from all" after splitting a bill, your sent requests show up here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={doRefresh} />}
      >
        {splits.map((split) => {
          const summary = summarizeSplit(split);
          return (
            <View key={split.id} style={[styles.card, Shadows.card]}>
              <AnimatedPressable
                onPress={() => handleSplitMenu(split)}
                style={styles.cardHeader}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.restaurant} numberOfLines={1}>
                    {split.restaurant_name}
                  </Text>
                  <Text style={styles.subline}>
                    {formatCurrency(summary.total)} · {summary.paid}/{summary.count} paid
                    {summary.cancelled === summary.count ? ' · cancelled' : ''}
                  </Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={20} color={Neutral[500]} />
              </AnimatedPressable>

              <View style={styles.linesGroup}>
                {split.lines.map((line, i) => {
                  const isLast = i === split.lines.length - 1;
                  return (
                    <AnimatedPressable
                      key={line.id}
                      onPress={() => handleLineMenu(split, line)}
                      style={[styles.lineRow, !isLast && styles.lineRowDivider]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recipientName} numberOfLines={1}>
                          {line.recipient_name}
                        </Text>
                        <View style={styles.statusRow}>
                          <StatusBadge status={line.status} />
                        </View>
                      </View>
                      <Text style={styles.amount}>{formatCurrency(line.amount)}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={styles.footnote}>
          Pull to refresh. You'll get a push when recipients view or pay.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: SenderSplitLine['status'] }) {
  const cfg = STATUS_CFG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeLabel, { color: cfg.fg }]}>
        {cfg.icon} {cfg.label}
      </Text>
    </View>
  );
}

const STATUS_CFG: Record<
  SenderSplitLine['status'],
  { icon: string; label: string; bg: string; fg: string }
> = {
  pending: { icon: '🕐', label: 'pending', bg: Neutral[100], fg: Neutral[600] },
  viewed: { icon: '👀', label: 'viewed', bg: Gold[100], fg: Onyx[900] },
  paid: { icon: '✅', label: 'paid', bg: 'rgba(16,185,129,0.10)', fg: Success[700] },
  cancelled: { icon: '⛔️', label: 'cancelled', bg: Neutral[200], fg: Neutral[500] },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Semantic.bgCream },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[200],
  },
  restaurant: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: Onyx[900],
  },
  subline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Neutral[500],
    marginTop: 2,
  },
  linesGroup: { paddingTop: 4 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  lineRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Neutral[100],
  },
  recipientName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  statusRow: { marginTop: 6, flexDirection: 'row' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  amount: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 15,
    color: Onyx[900],
    minWidth: 64,
    textAlign: 'right',
  },
  errorTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 18,
    color: Onyx[900],
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Neutral[500],
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Onyx[900],
  },
  retryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Neutral[400],
    textAlign: 'center',
    marginTop: 12,
  },
});
