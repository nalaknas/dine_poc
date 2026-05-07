import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Gold, Neutral, Onyx, Semantic, Success } from '../../constants/colors';
import { Shadows } from '../../constants/shadows';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { openVenmoRequest, buildMealNote } from '../../services/venmo-service';
import { track } from '../../lib/analytics';
import { formatCurrency } from '../../utils/format';
import type { RootStackParamList } from '../../types';

type Route = RouteProp<RootStackParamList, 'PaymentRequest'>;

interface Sender {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  venmo_handle: string | null;
}

interface Line {
  id: string;
  amount: number;
  status: 'pending' | 'viewed' | 'paid' | 'cancelled';
  recipient_name: string;
  is_current_user: boolean;
}

interface Payload {
  id: string;
  restaurant_name: string;
  note: string | null;
  sender: Sender;
  lines: Line[];
  expires_at: string;
}

export function PaymentRequestScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<Route>();
  const { user } = useAuthStore();
  const { token } = params;

  const [payload, setPayload] = useState<Payload | null>(null);
  const [errorState, setErrorState] = useState<'not_found' | 'load_error' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);

  // The line for the currently-authenticated recipient. Falls back to
  // is_current_user from the RPC; if that's missing (e.g. RPC didn't include
  // it), match by auth user id is best-effort.
  const myLine = payload?.lines.find((l) => l.is_current_user) ?? null;

  const fetchPayload = useCallback(async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const { data, error } = await supabase.rpc('get_split_request_by_token', {
        p_token: token,
      });
      if (error) {
        const code = (error as any)?.code ?? '';
        if (code === 'P0001' || /not_found_or_expired/i.test(error.message)) {
          setErrorState('not_found');
        } else {
          setErrorState('load_error');
        }
        return;
      }
      if (!data) {
        setErrorState('not_found');
        return;
      }
      setPayload(data as Payload);
    } catch (e) {
      setErrorState('load_error');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPayload();
  }, [fetchPayload]);

  // Reconcile state when the screen comes back to the foreground (e.g., the
  // user paid via Venmo and navigated back). Mirrors the web landing's
  // visibilitychange listener — the prior in-flight fetch can come back
  // stalled if iOS suspended the JS context during the Venmo handoff.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void fetchPayload();
    });
    return unsubscribe;
  }, [navigation, fetchPayload]);

  // Track view (best-effort)
  useEffect(() => {
    if (payload && myLine) {
      void track('payment_request_viewed', {
        line_id: myLine.id,
        amount: myLine.amount,
        status: myLine.status,
      });
    }
  }, [payload, myLine]);

  const senderName =
    payload?.sender.display_name ?? payload?.sender.username ?? 'Someone';
  const venmoHandle = payload?.sender.venmo_handle ?? null;

  const handlePayVenmo = async () => {
    if (!myLine || !venmoHandle || !payload) return;
    void track('pay_button_tapped', {
      line_id: myLine.id,
      amount: myLine.amount,
      surface: 'in_app',
    });
    // Best-effort mark_viewed; ignore failures.
    void (async () => {
      try {
        await supabase.rpc('mark_line_viewed', { p_line_id: myLine.id, p_token: token });
      } catch {
        // intentional no-op — viewed marking is best-effort
      }
    })();
    try {
      await openVenmoRequest({
        venmoUsername: venmoHandle,
        amount: myLine.amount,
        note: buildMealNote(payload.restaurant_name),
      });
    } catch {
      Alert.alert('Could not open Venmo', 'Please try again or pay manually.');
    }
  };

  const handleMarkPaid = async () => {
    if (!myLine || isMarking) return;
    setIsMarking(true);
    try {
      const { error } = await supabase.rpc('mark_line_paid', {
        p_line_id: myLine.id,
        p_token: token,
      });
      if (error) {
        Alert.alert('Could not mark paid', 'Please try again.');
        return;
      }
      void track('mark_paid_tapped', {
        line_id: myLine.id,
        amount: myLine.amount,
        surface: 'in_app',
      });
      // Optimistically update state in place.
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              lines: prev.lines.map((l) =>
                l.id === myLine.id ? { ...l, status: 'paid' } : l,
              ),
            }
          : prev,
      );
    } finally {
      setIsMarking(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={Onyx[900]} />
      </SafeAreaView>
    );
  }

  if (errorState === 'not_found' || (!payload && !isLoading)) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="time-outline" size={36} color={Neutral[400]} />
        <Text style={styles.errorTitle}>Link expired or not found</Text>
        <Text style={styles.errorBody}>
          Payment requests expire after 30 days. Ask the sender to resend.
        </Text>
      </SafeAreaView>
    );
  }

  if (errorState === 'load_error' || !payload) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="alert-circle-outline" size={36} color={Neutral[400]} />
        <Text style={styles.errorTitle}>Couldn't load this request</Text>
        <Text style={styles.errorBody}>Pull down or come back in a moment.</Text>
      </SafeAreaView>
    );
  }

  if (!myLine) {
    // The token resolves to a real split request but doesn't include a line
    // for the current user. Either the user hit a token they don't belong
    // to, or the line was deleted. Fall back to the generic landing-style
    // not-found message.
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Ionicons name="information-circle-outline" size={36} color={Neutral[400]} />
        <Text style={styles.errorTitle}>No payment for you here</Text>
        <Text style={styles.errorBody}>
          This split request doesn't have a line for your account.
        </Text>
      </SafeAreaView>
    );
  }

  const initials = senderName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·';

  const isPaid = myLine.status === 'paid';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PAYMENT REQUEST</Text>
            <Text style={styles.senderName}>{senderName}</Text>
          </View>
        </View>

        <Text style={styles.restaurant}>{payload.restaurant_name}</Text>
        {payload.note && <Text style={styles.note}>{payload.note}</Text>}

        <View style={[styles.amountCard, Shadows.card]}>
          <Text style={styles.amountEyebrow}>YOUR SHARE</Text>
          <Text style={styles.amount}>{formatCurrency(myLine.amount)}</Text>
        </View>

        {isPaid ? (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Success[500]} />
            <Text style={styles.paidLabel}>Paid</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            {venmoHandle ? (
              <AnimatedPressable
                onPress={handlePayVenmo}
                style={styles.payBtn}
              >
                <Text style={styles.payBtnLabel}>
                  Pay {formatCurrency(myLine.amount)} via Venmo
                </Text>
              </AnimatedPressable>
            ) : (
              <View style={styles.payBtnDisabled}>
                <Text style={styles.payBtnDisabledLabel}>
                  {senderName} hasn't set a Venmo handle
                </Text>
              </View>
            )}
            <AnimatedPressable
              onPress={handleMarkPaid}
              disabled={isMarking}
              style={[styles.markPaidBtn, isMarking && styles.btnDisabled]}
            >
              <Text style={styles.markPaidLabel}>
                {isMarking ? 'Saving…' : 'I paid'}
              </Text>
            </AnimatedPressable>
          </View>
        )}

        <Text style={styles.privacy}>
          These amounts are visible to everyone tagged in this split. Marking "I paid"
          is honor-system — {senderName} can override.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: Gold[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: Onyx[900],
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.88,
    color: Neutral[500],
  },
  senderName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: Onyx[900],
    marginTop: 2,
  },
  restaurant: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 36,
    lineHeight: 40,
    color: Onyx[900],
    marginTop: 24,
    letterSpacing: -0.36,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Neutral[500],
    marginTop: 6,
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },
  amountEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.88,
    color: Neutral[500],
  },
  amount: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 40,
    color: Onyx[900],
    marginTop: 8,
    letterSpacing: -0.4,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  payBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Onyx[900],
  },
  payBtnLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  payBtnDisabled: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Neutral[100],
  },
  payBtnDisabledLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Neutral[500],
  },
  markPaidBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Neutral[300],
    backgroundColor: '#FFFFFF',
  },
  markPaidLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  paidLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Success[500],
  },
  btnDisabled: {
    opacity: 0.55,
  },
  privacy: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: Neutral[500],
    marginTop: 24,
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
});
