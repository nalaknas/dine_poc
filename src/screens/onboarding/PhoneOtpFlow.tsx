import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Neutral, Onyx, Semantic, Danger } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import {
  formatUSPhoneAsYouType,
  normalizeUSPhone,
  PhoneTakenError,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../../services/phone-auth-service';
import type { User } from '../../types';

type Step = 'enter_phone' | 'enter_code';

const RESEND_COOLDOWN_S = 30;
const OTP_LENGTH = 6;

interface PhoneOtpFlowProps {
  /** Headline for the enter-phone step (e.g. "What's your number?"). */
  headline: string;
  /** Subhead for the enter-phone step. */
  subhead: string;
  /**
   * Called with the freshly-stored user row after verifyOtp succeeds + the
   * public.users mirror lands. Caller decides where to navigate next.
   */
  onSuccess: (updated: User) => void;
}

/**
 * Two-step phone-OTP flow used by both ENG-147 (signup) and ENG-148
 * (existing-user backfill). All state, error mapping, and resend logic lives
 * here; wrappers supply copy and the post-success navigation.
 */
export function PhoneOtpFlow({ headline, subhead, onSuccess }: PhoneOtpFlowProps) {
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>('enter_phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<TextInput>(null);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-focus the code input on step transition.
  useEffect(() => {
    if (step === 'enter_code') {
      const t = setTimeout(() => codeInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [step]);

  const onPhoneChange = (next: string) => {
    setError(null);
    setPhoneInput(formatUSPhoneAsYouType(next));
  };

  const onSendOtp = async () => {
    setError(null);
    if (!user) return;
    const normalized = normalizeUSPhone(phoneInput);
    if (!normalized.ok) {
      setError(
        normalized.reason === 'unsupported_country'
          ? 'US numbers only for now.'
          : 'Enter a valid US phone number.',
      );
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(normalized.e164, user.id);
      setE164(normalized.e164);
      setCode('');
      setStep('enter_code');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!e164 || !user || cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendPhoneOtp(e164, user.id);
      setCooldown(RESEND_COOLDOWN_S);
      setCode('');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!e164 || !user) return;
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code we sent you.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await verifyPhoneOtp(e164, code, user.id);
      onSuccess(updated);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const onChangeNumber = () => {
    setStep('enter_phone');
    setCode('');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.body}>
          {step === 'enter_phone' ? (
            <>
              <Text style={styles.headline}>{headline}</Text>
              <Text style={styles.subhead}>{subhead}</Text>

              <View style={styles.inputRow}>
                <View style={styles.prefix}>
                  <Text style={styles.prefixText}>+1</Text>
                </View>
                <TextInput
                  value={phoneInput}
                  onChangeText={onPhoneChange}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Neutral[400]}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                  style={styles.input}
                  maxLength={16}
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.headline}>Enter the code.</Text>
              <Text style={styles.subhead}>
                Sent to {e164}.
                {' '}
                <Text onPress={onChangeNumber} style={styles.linkText}>
                  Change number
                </Text>
              </Text>

              <View style={styles.codeWrap}>
                <TextInput
                  ref={codeInputRef}
                  value={code}
                  onChangeText={(v) => {
                    setError(null);
                    setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH));
                  }}
                  placeholder="000000"
                  placeholderTextColor={Neutral[300]}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  style={styles.codeInput}
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={onResend}
                disabled={cooldown > 0 || busy}
                style={styles.resend}
              >
                <Text
                  style={[
                    styles.resendText,
                    (cooldown > 0 || busy) && styles.resendDisabled,
                  ]}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <AnimatedPressable
            onPress={step === 'enter_phone' ? onSendOtp : onVerify}
            disabled={busy}
            style={[styles.cta, styles.ctaPrimary, busy && styles.ctaDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaLabelPrimary}>
                {step === 'enter_phone' ? 'Send code' : 'Verify'}
              </Text>
            )}
          </AnimatedPressable>

          <View style={styles.footnoteRow}>
            <Ionicons name="lock-closed-outline" size={11} color={Neutral[400]} />
            <Text style={styles.footnote}>
              Your number is private. Only friends who already have it can find you.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Translate raw Supabase / Postgres error objects into language a user can act on.
function friendly(err: unknown): string {
  // Our own typed sentinels are handled first — don't depend on string matching.
  if (err instanceof PhoneTakenError) return err.message;
  const message: string | undefined =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : undefined;
  if (!message) return 'Something went wrong. Try again.';
  const m = message.toLowerCase();
  // Postgres unique_violation surfacing through PostgREST: covers the TOCTOU
  // race where our preflight passed but another account claimed the number
  // between sendPhoneOtp and verifyPhoneOtp.
  if (
    m.includes('duplicate key') ||
    m.includes('unique constraint') ||
    m.includes('users_phone_number')
  ) {
    return 'That number is already linked to another account.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (m.includes('invalid') && m.includes('otp')) {
    return 'That code doesn\'t match. Try again.';
  }
  if (m.includes('expired')) {
    return 'That code expired. Request a new one.';
  }
  if (m.includes('phone') && (m.includes('exists') || m.includes('taken') || m.includes('already'))) {
    return 'That number is already linked to another account.';
  }
  if (m.includes('invalid phone') || m.includes('invalid format')) {
    return 'That doesn\'t look like a valid number.';
  }
  return message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  flex: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  headline: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
    color: '#1A1612',
  },
  subhead: {
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#5E5C58',
  },
  linkText: {
    fontFamily: 'Inter_500Medium',
    color: Onyx[900],
    textDecorationLine: 'underline',
  },
  inputRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    backgroundColor: '#FFFFFF',
  },
  prefixText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Onyx[900],
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Onyx[900],
  },
  codeWrap: {
    marginTop: 28,
  },
  codeInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    color: Onyx[900],
  },
  resend: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  resendText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Onyx[900],
  },
  resendDisabled: {
    color: Neutral[400],
  },
  error: {
    marginTop: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Danger[500],
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: Onyx[900],
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaLabelPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Neutral[400],
    textAlign: 'center',
  },
});
