import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { StatusBadge } from './StatusBadge';
import { MemberAvatarStack } from './MemberAvatarStack';
import { Shadows } from '../../constants/shadows';
import type { DiningPlan, DiningPlanMember, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DiningPlanCardProps {
  plan: DiningPlan;
  /** Optional pre-fetched members for avatar display. */
  members?: DiningPlanMember[];
}

export function DiningPlanCard({ plan, members = [] }: DiningPlanCardProps) {
  const navigation = useNavigation<Nav>();

  const handlePress = useCallback(() => {
    navigation.navigate('DiningPlanDetail', { planId: plan.id });
  }, [navigation, plan.id]);

  const formattedDate = plan.chosen_date
    ? new Date(plan.chosen_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        {
          backgroundColor: '#FFFFFF',
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          padding: 16,
        },
        Shadows.card,
      ]}
    >
      {/* Top row: title + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{ fontSize: 17, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {plan.title}
        </Text>
        <StatusBadge status={plan.status} />
      </View>

      {/* Member info */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
        {members.length > 0 ? (
          <MemberAvatarStack members={members} maxVisible={4} size={28} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {plan.accepted_count ?? 0}/{plan.member_count ?? 0} going
            </Text>
          </View>
        )}
      </View>

      {/* Bottom row: restaurant + date if set */}
      {(plan.chosen_restaurant_name || formattedDate) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
          {plan.chosen_restaurant_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="restaurant-outline" size={14} color="#007AFF" />
              <Text style={{ fontSize: 13, color: '#007AFF', fontWeight: '500' }} numberOfLines={1}>
                {plan.chosen_restaurant_name}
              </Text>
            </View>
          )}
          {formattedDate && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={{ fontSize: 13, color: '#6B7280' }}>{formattedDate}</Text>
            </View>
          )}
        </View>
      )}

      {/* Pending invite indicator */}
      {plan.my_status === 'pending' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            backgroundColor: 'rgba(245,158,11,0.1)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            gap: 6,
          }}
        >
          <Ionicons name="mail-outline" size={14} color="#D97706" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#D97706' }}>
            You have a pending invite
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
