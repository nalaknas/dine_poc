import React, { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { RedemptionStatus } from '../../types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface QRCodeDisplayProps {
  redemptionCode: string;
  status: RedemptionStatus;
  expiresAt: string;
}

// ─── Countdown formatting ───────────────────────────────────────────────────

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return '00:00';
  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = Math.floor(secondsLeft % 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Displays a QR code for perk redemption with a countdown timer.
 *
 * Three visual states:
 * - pending: active QR with countdown + pulsing hint text
 * - redeemed: green overlay with checkmark
 * - expired: gray overlay with clock icon
 *
 * Note: Uses a text-based QR placeholder. To use actual QR generation,
 * install `react-native-qrcode-svg` and replace the placeholder.
 */
export function QRCodeDisplay({ redemptionCode, status, expiresAt }: QRCodeDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing animation for hint text
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (status === 'pending') {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Countdown timer
  useEffect(() => {
    if (status !== 'pending') return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status]);

  const isUrgent = secondsLeft < 60 && secondsLeft > 0;
  const timerColor = isUrgent ? '#EF4444' : '#6B7280';

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      {/* QR Container */}
      <View style={{
        width: 280,
        height: 280,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: status === 'pending' ? '#007AFF' : status === 'redeemed' ? '#10B981' : '#D1D5DB',
      }}>
        {/* QR Code placeholder — displays code as large text grid */}
        {status === 'pending' && (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 250,
              height: 250,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
            }}>
              {/* Grid pattern as visual QR placeholder */}
              <Ionicons name="qr-code-outline" size={120} color="#1F2937" />
              <Text style={{
                fontSize: 18,
                fontWeight: '800',
                color: '#1F2937',
                letterSpacing: 2,
                marginTop: 12,
              }}>
                {redemptionCode}
              </Text>
            </View>
          </View>
        )}

        {/* Redeemed overlay */}
        {status === 'redeemed' && (
          <View style={{
            width: 250,
            height: 250,
            borderRadius: 12,
            backgroundColor: 'rgba(16,185,129,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#10B981',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="checkmark" size={48} color="#FFFFFF" />
            </View>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#10B981',
              marginTop: 16,
            }}>
              Redeemed!
            </Text>
            <Text style={{
              fontSize: 13,
              color: '#6B7280',
              marginTop: 4,
            }}>
              {redemptionCode}
            </Text>
          </View>
        )}

        {/* Expired overlay */}
        {status === 'expired' && (
          <View style={{
            width: 250,
            height: 250,
            borderRadius: 12,
            backgroundColor: 'rgba(156,163,175,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#D1D5DB',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="time-outline" size={48} color="#6B7280" />
            </View>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#6B7280',
              marginTop: 16,
            }}>
              Expired
            </Text>
            <Text style={{
              fontSize: 13,
              color: '#9CA3AF',
              marginTop: 4,
            }}>
              {redemptionCode}
            </Text>
          </View>
        )}
      </View>

      {/* Countdown timer */}
      {status === 'pending' && (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: timerColor,
            fontVariant: ['tabular-nums'],
          }}>
            {formatCountdown(secondsLeft)}
          </Text>

          {/* Pulsing hint */}
          <Animated.View style={pulseStyle}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#007AFF',
              textAlign: 'center',
            }}>
              Show this to your server
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
