import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QRCodeDisplay } from '../../components/perks/QRCodeDisplay';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
import { fetchActiveRedemption } from '../../services/perks-service';
import type { RootStackParamList, PerkRedemption } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PerkRedemption'>;

/**
 * Modal-style screen showing a QR code for an active perk redemption.
 * Subscribes to Realtime changes on the redemption row for live status updates.
 */
export function PerkRedemptionScreen({ route, navigation }: Props) {
  const { redemptionId } = route.params;
  const [redemption, setRedemption] = useState<PerkRedemption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { initial, unsubscribe } = await fetchActiveRedemption(
          redemptionId,
          (updated) => {
            if (mounted) setRedemption(updated);
          },
        );
        if (mounted) {
          setRedemption(initial);
          unsubscribeRef.current = unsubscribe;
        } else {
          unsubscribe();
        }
      } catch (e) {
        if (mounted) setError('Failed to load redemption details.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      unsubscribeRef.current?.();
    };
  }, [redemptionId]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !redemption) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>
            {error ?? 'Redemption not found'}
          </Text>
          <AnimatedPressable
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 20,
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: '#007AFF',
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Go Back</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Perk info header */}
        <View style={[{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
          alignItems: 'center',
        }, Shadows.card]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center' }}>
            {redemption.perk?.title ?? 'Perk'}
          </Text>
          {redemption.restaurant_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
              <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }}>
                {redemption.restaurant_name}
              </Text>
            </View>
          )}
        </View>

        {/* QR Code */}
        <QRCodeDisplay
          redemptionCode={redemption.redemption_code}
          status={redemption.status}
          expiresAt={redemption.expires_at}
        />

        {/* Status message */}
        {redemption.status === 'redeemed' && (
          <View style={{
            marginTop: 20,
            backgroundColor: 'rgba(16,185,129,0.08)',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '500', marginLeft: 8 }}>
              Successfully redeemed! Enjoy your perk.
            </Text>
          </View>
        )}
      </View>

      {/* Dismiss button */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <AnimatedPressable
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
            {redemption.status === 'redeemed' ? 'Done' : 'Dismiss'}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
