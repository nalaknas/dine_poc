import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { formatCurrency, generateId } from '../../utils/format';

export function ValidateReceiptScreen() {
  const navigation = useNavigation<any>();
  const { currentReceipt, updateReceiptItem, updateReceiptField, setReceipt } = useBillSplitterStore();
  const [showErrors, setShowErrors] = useState(false);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  if (!currentReceipt) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-text-secondary">No receipt data. Go back and try again.</Text>
      </View>
    );
  }

  const addItem = () => {
    setReceipt({
      ...currentReceipt,
      items: [
        ...currentReceipt.items,
        { id: generateId(), name: '', price: 0 },
      ],
    });
  };

  const removeItem = (itemId: string) => {
    setReceipt({
      ...currentReceipt,
      items: currentReceipt.items.filter((i) => i.id !== itemId),
    });
  };

  const nameInvalid = showErrors && !currentReceipt.restaurantName.trim();
  const itemsInvalid = showErrors && currentReceipt.items.length === 0;

  const handleContinue = () => {
    const isValid =
      currentReceipt.restaurantName.trim().length > 0 &&
      currentReceipt.items.length > 0;

    if (!isValid) {
      setShowErrors(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      return;
    }
    setShowErrors(false);
    navigation.navigate('SelectFriends');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

          {/* Restaurant info */}
          <View className="bg-background-secondary rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-3">RESTAURANT</Text>
            <TextInput
              value={currentReceipt.restaurantName}
              onChangeText={(v) => updateReceiptField('restaurantName', v)}
              placeholder="Restaurant name"
              placeholderTextColor="#9CA3AF"
              className={`text-base font-semibold text-text-primary border-b pb-2 mb-1 ${nameInvalid ? 'border-red-500' : 'border-border'}`}
            />
            {nameInvalid && (
              <Text className="text-red-500 text-xs mb-2">Restaurant name is required</Text>
            )}
            <View className="flex-row gap-2">
              <TextInput
                value={currentReceipt.city}
                onChangeText={(v) => updateReceiptField('city', v)}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-base text-text-primary border border-border rounded-lg px-3 py-2"
              />
              <TextInput
                value={currentReceipt.state}
                onChangeText={(v) => updateReceiptField('state', v)}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                className="w-20 text-base text-text-primary border border-border rounded-lg px-3 py-2"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Meal details */}
          <View className="bg-background-secondary rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-3">MEAL DETAILS</Text>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-xs text-text-secondary mb-1">Date</Text>
                <TextInput
                  value={currentReceipt.date}
                  onChangeText={(v) => updateReceiptField('date', v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  className="text-base text-text-primary border border-border rounded-lg px-3 py-2"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-text-secondary mb-1">Time</Text>
                <TextInput
                  value={currentReceipt.time}
                  onChangeText={(v) => updateReceiptField('time', v)}
                  placeholder="7:30 PM"
                  placeholderTextColor="#9CA3AF"
                  className="text-base text-text-primary border border-border rounded-lg px-3 py-2"
                />
              </View>
            </View>
            <View>
              <Text className="text-xs text-text-secondary mb-1">Address</Text>
              <TextInput
                value={currentReceipt.address}
                onChangeText={(v) => updateReceiptField('address', v)}
                placeholder="Street address"
                placeholderTextColor="#9CA3AF"
                className="text-base text-text-primary border border-border rounded-lg px-3 py-2"
              />
            </View>
          </View>

          {/* Items */}
          <View className={`bg-background-secondary rounded-xl p-4 mb-4 ${itemsInvalid ? 'border border-red-500' : ''}`}>
            <Text className="text-sm font-semibold text-text-secondary mb-3">ITEMS</Text>
            {itemsInvalid && (
              <Text className="text-red-500 text-xs mb-2">Add at least one item to split</Text>
            )}
            {currentReceipt.items.map((item, idx) => (
              <View key={item.id} className="flex-row items-center mb-2">
                <TextInput
                  value={item.name}
                  onChangeText={(v) => updateReceiptItem(item.id, { name: v })}
                  placeholder={`Item ${idx + 1}`}
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 text-base text-text-primary border border-border rounded-lg px-3 py-2 mr-2"
                />
                <TextInput
                  value={item.price > 0 ? item.price.toString() : ''}
                  onChangeText={(v) => updateReceiptItem(item.id, { price: parseFloat(v) || 0 })}
                  placeholder="$0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  className="w-20 text-base text-text-primary border border-border rounded-lg px-3 py-2 mr-2"
                />
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={addItem}
              className="flex-row items-center mt-2"
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text className="text-sm font-semibold text-accent ml-1">Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Totals */}
          <View className="bg-background-secondary rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-3">TOTALS</Text>
            {[
              { label: 'Subtotal', field: 'subtotal' as const },
              { label: 'Tax', field: 'tax' as const },
              { label: 'Discount', field: 'discount' as const },
            ].map((row) => (
              <View key={row.field} className="flex-row justify-between items-center mb-2">
                <Text className="text-base text-text-secondary">{row.label}</Text>
                <TextInput
                  value={currentReceipt[row.field] > 0 ? currentReceipt[row.field].toString() : ''}
                  onChangeText={(v) => updateReceiptField(row.field, parseFloat(v) || 0)}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  className="w-24 text-right text-base text-text-primary border border-border rounded-lg px-3 py-1.5"
                />
              </View>
            ))}
          </View>

          {/* Tip */}
          <View className="bg-background-secondary rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-3">TIP</Text>
            <View className="flex-row gap-2 mb-3">
              {[15, 18, 20, 25].map((pct) => {
                const tipAmount = Math.round(currentReceipt.subtotal * pct) / 100;
                const isSelected = currentReceipt.tip > 0 && Math.abs(currentReceipt.tip - tipAmount) < 0.01;
                return (
                  <TouchableOpacity
                    key={pct}
                    onPress={() => updateReceiptField('tip', tipAmount)}
                    className={`flex-1 py-2 rounded-lg items-center border ${
                      isSelected ? 'bg-accent border-accent' : 'bg-transparent border-border'
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-text-primary'}`}>
                      {pct}%
                    </Text>
                    <Text className={`text-xs ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}>
                      {formatCurrency(tipAmount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-base text-text-secondary">Custom</Text>
              <TextInput
                value={currentReceipt.tip > 0 ? currentReceipt.tip.toString() : ''}
                onChangeText={(v) => updateReceiptField('tip', parseFloat(v) || 0)}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className="w-24 text-right text-base text-text-primary border border-border rounded-lg px-3 py-1.5"
              />
            </View>
          </View>

          {/* Total */}
          <View className="bg-background-secondary rounded-xl p-4 mb-6">
            <View className="flex-row justify-between items-center">
              <Text className="text-lg font-bold text-text-primary">Total</Text>
              <Text className="text-lg font-bold text-accent">
                {formatCurrency(currentReceipt.total || (currentReceipt.subtotal + currentReceipt.tax + currentReceipt.tip - currentReceipt.discount))}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Continue button */}
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border-light px-4 py-4">
          <Animated.View style={shakeStyle}>
            <TouchableOpacity
              onPress={handleContinue}
              className="bg-accent rounded-xl py-4 items-center"
            >
              <Text className="text-white text-base font-semibold">Continue → Select Friends</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
