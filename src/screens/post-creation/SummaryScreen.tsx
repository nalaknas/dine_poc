import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { formatCurrency } from '../../utils/format';

export function SummaryScreen() {
  const navigation = useNavigation<any>();
  const { personBreakdowns, currentReceipt } = useBillSplitterStore();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Restaurant info */}
        <View className="items-center mb-6">
          <Text className="text-xl font-bold text-text-primary">{currentReceipt?.restaurantName}</Text>
          {currentReceipt?.city && (
            <Text className="text-sm text-text-secondary">{currentReceipt.city}, {currentReceipt.state}</Text>
          )}
          <Text className="text-2xl font-bold text-accent mt-2">
            {formatCurrency(currentReceipt?.total ?? 0)}
          </Text>
          <Text className="text-sm text-text-secondary">Total bill</Text>
        </View>

        {/* Per-person breakdown */}
        {personBreakdowns.map((breakdown) => (
          <View key={breakdown.friend.id} className="bg-background-secondary rounded-xl p-4 mb-3">
            <View className="flex-row items-center mb-3">
              <Avatar
                uri={breakdown.friend.avatar_url}
                displayName={breakdown.friend.display_name}
                size={36}
              />
              <View className="flex-1 ml-2">
                <Text className="text-base font-semibold text-text-primary">
                  {breakdown.friend.display_name}
                </Text>
                {breakdown.friend.username && (
                  <Text className="text-xs text-text-secondary">@{breakdown.friend.username}</Text>
                )}
              </View>
              <Text className="text-xl font-bold text-accent">
                {formatCurrency(breakdown.total)}
              </Text>
            </View>

            {/* Item breakdown */}
            {breakdown.items.map((item, i) => (
              <View key={i} className="flex-row justify-between py-0.5">
                <Text className="text-sm text-text-secondary flex-1 mr-2" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-sm text-text-secondary">{formatCurrency(item.share)}</Text>
              </View>
            ))}

            {/* Tax + tip */}
            {breakdown.taxShare > 0 && (
              <View className="flex-row justify-between pt-1 mt-1 border-t border-border">
                <Text className="text-sm text-text-secondary">Tax</Text>
                <Text className="text-sm text-text-secondary">{formatCurrency(breakdown.taxShare)}</Text>
              </View>
            )}
            {breakdown.tipShare > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">Tip</Text>
                <Text className="text-sm text-text-secondary">{formatCurrency(breakdown.tipShare)}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View className="bg-background border-t border-border-light px-4 py-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('RateMeal')}
          className="bg-accent rounded-xl py-4 items-center"
        >
          <Text className="text-base font-semibold text-white">Continue → Rate the Meal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
