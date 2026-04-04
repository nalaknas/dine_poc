import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { TierGateBadge } from '../../components/perks/TierGateBadge';
import { Shadows } from '../../constants/shadows';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import {
  fetchPerkDetail,
  checkEligibility,
  createRedemption,
} from '../../services/perks-service';
import type { EligibilityResult } from '../../services/perks-service';
import type { RootStackParamList, Perk, UserTier, PerkType } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PerkDetail'>;

// ─── Perk type display ──────────────────────────────────────────────────────

const PERK_TYPE_ICONS: Record<PerkType, keyof typeof Ionicons.glyphMap> = {
  discount: 'pricetag-outline',
  free_item: 'gift-outline',
  upgrade: 'arrow-up-circle-outline',
  experience: 'sparkles-outline',
};

const PERK_TYPE_COLORS: Record<PerkType, string> = {
  discount: '#10B981',
  free_item: '#8B5CF6',
  upgrade: '#F59E0B',
  experience: '#EC4899',
};

const PERK_TYPE_LABELS: Record<PerkType, string> = {
  discount: 'Discount',
  free_item: 'Free Item',
  upgrade: 'Upgrade',
  experience: 'Experience',
};

// ─── Screen ─────────────────────────────────────────────────────────────────

export function PerkDetailScreen({ route, navigation }: Props) {
  const { perkId } = route.params;
  const { user } = useAuthStore();
  const { profile } = useUserProfileStore();

  const [perk, setPerk] = useState<(Perk & { restaurant_name: string; city: string; logo_url?: string }) | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const userTier = (profile?.current_tier ?? 'rock') as UserTier;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [perkData, eligData] = await Promise.all([
        fetchPerkDetail(perkId),
        checkEligibility(user.id, perkId),
      ]);
      setPerk(perkData);
      setEligibility(eligData);
    } finally {
      setIsLoading(false);
    }
  }, [user, perkId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRedeem = async () => {
    if (!user || !perk) return;

    Alert.alert(
      'Redeem Perk',
      `Redeem "${perk.title}" at ${perk.restaurant_name}? You'll receive a QR code valid for 24 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setIsRedeeming(true);
            try {
              const redemption = await createRedemption(perkId, user.id);
              navigation.replace('PerkRedemption', { redemptionId: redemption.id });
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Failed to redeem perk';
              Alert.alert('Error', message);
            } finally {
              setIsRedeeming(false);
            }
          },
        },
      ],
    );
  };

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

  if (!perk) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>
            Perk not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canRedeem = eligibility?.is_eligible && (eligibility?.uses_remaining ?? 0) > 0;
  const iconColor = PERK_TYPE_COLORS[perk.perk_type] ?? '#007AFF';
  const iconName = PERK_TYPE_ICONS[perk.perk_type] ?? 'gift-outline';
  const typeLabel = PERK_TYPE_LABELS[perk.perk_type] ?? perk.perk_type;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header card */}
        <View style={[{
          margin: 16,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 20,
        }, Shadows.card]}>
          {/* Type badge */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: `${iconColor}14`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name={iconName} size={24} color={iconColor} />
            </View>
            <View style={{
              backgroundColor: `${iconColor}14`,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: iconColor }}>
                {typeLabel}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1F2937' }}>
            {perk.title}
          </Text>

          {/* Restaurant info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Ionicons name="restaurant-outline" size={16} color="#6B7280" />
            <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 4 }}>
              {perk.restaurant_name}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="location-outline" size={16} color="#9CA3AF" />
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>
              {perk.city}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, color: '#374151', lineHeight: 22 }}>
            {perk.description}
          </Text>
        </View>

        {/* Tier requirement */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <TierGateBadge
            requiredTier={perk.tier_required}
            userTier={userTier}
            variant="full"
          />
        </View>

        {/* Uses remaining */}
        <View style={[{
          marginHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }, Shadows.sm]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="repeat-outline" size={20} color="#6B7280" />
            <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 8 }}>
              Uses this month
            </Text>
          </View>
          <Text style={{
            fontSize: 16,
            fontWeight: '700',
            color: (eligibility?.uses_remaining ?? 0) > 0 ? '#10B981' : '#EF4444',
          }}>
            {eligibility?.uses_remaining ?? 0} of {perk.uses_per_month} left
          </Text>
        </View>

        {/* Validity dates */}
        {(perk.valid_from || perk.valid_until) && (
          <View style={[{
            marginHorizontal: 16,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }, Shadows.sm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {perk.valid_from && `From ${new Date(perk.valid_from).toLocaleDateString()}`}
                {perk.valid_from && perk.valid_until && ' · '}
                {perk.valid_until && `Until ${new Date(perk.valid_until).toLocaleDateString()}`}
              </Text>
            </View>
          </View>
        )}

        {/* Ineligibility reason */}
        {!eligibility?.is_eligible && eligibility?.reason && (
          <View style={{
            marginHorizontal: 16,
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Ionicons name="information-circle" size={18} color="#EF4444" />
            <Text style={{ fontSize: 13, color: '#DC2626', marginLeft: 8, flex: 1 }}>
              {eligibility.reason}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom: Redeem button */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
      }}>
        <AnimatedPressable
          onPress={handleRedeem}
          disabled={!canRedeem || isRedeeming}
          style={{
            backgroundColor: canRedeem ? '#007AFF' : '#D1D5DB',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {isRedeeming ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={canRedeem ? 'qr-code-outline' : 'lock-closed'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {canRedeem ? 'Redeem Now' : 'Not Available'}
              </Text>
            </>
          )}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
