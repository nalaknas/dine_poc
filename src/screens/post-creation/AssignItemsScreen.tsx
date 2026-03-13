import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { formatCurrency } from '../../utils/format';

export function AssignItemsScreen() {
  const navigation = useNavigation<any>();
  const {
    currentReceipt, selectedFriends, isFamilyStyle, setFamilyStyle,
    familyStyleItems, toggleItemFamilyStyle,
    itemAssignments, assignItem, unassignItem, calculateBreakdowns,
  } = useBillSplitterStore();

  if (!currentReceipt) return null;

  const handleContinue = () => {
    calculateBreakdowns();
    navigation.navigate('Summary');
  };

  const toggleAssign = (itemId: string, friendId: string) => {
    const assigned = itemAssignments[itemId] ?? [];
    if (assigned.includes(friendId)) {
      unassignItem(itemId, friendId);
    } else {
      assignItem(itemId, friendId);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Family style toggle */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border-light bg-background-secondary">
        <View>
          <Text className="text-base font-semibold text-text-primary">Family Style</Text>
          <Text className="text-xs text-text-secondary">Split everything equally</Text>
        </View>
        <Switch
          value={isFamilyStyle}
          onValueChange={setFamilyStyle}
          trackColor={{ false: '#E5E7EB', true: '#007AFF' }}
          thumbColor="#fff"
        />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Friends legend */}
        <View className="flex-row flex-wrap mb-4">
          {selectedFriends.map((friend, i) => (
            <View key={friend.id} className="flex-row items-center mr-4 mb-2">
              <Avatar uri={friend.avatar_url} displayName={friend.display_name} size={24} />
              <Text className="text-xs text-text-secondary ml-1">{friend.display_name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>

        {/* Items */}
        {currentReceipt.items.map((item) => {
          const assigned = itemAssignments[item.id] ?? [];
          const isItemFamily = isFamilyStyle || familyStyleItems.has(item.id);
          const splitCount = isItemFamily ? selectedFriends.length : (assigned.length || 1);
          const perPerson = item.price / splitCount;

          return (
            <View key={item.id} className="bg-background-secondary rounded-xl mb-3 p-4">
              <View className="flex-row justify-between items-start mb-3">
                <Text className="text-base font-semibold text-text-primary flex-1 mr-2">
                  {item.name || 'Unnamed item'}
                </Text>
                <Text className="text-base font-bold text-text-primary">
                  {formatCurrency(item.price)}
                </Text>
              </View>

              {!isFamilyStyle && (
                <View>
                  {/* Per-item family style toggle */}
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs text-text-secondary">
                      {isItemFamily
                        ? `Split equally → ${formatCurrency(perPerson)} each`
                        : assigned.length === 0
                          ? 'Assign to: nobody yet'
                          : `Assign to: ${formatCurrency(perPerson)} each`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleItemFamilyStyle(item.id)}
                      className={`px-3 py-1 rounded-full border ${
                        isItemFamily ? 'bg-accent border-accent' : 'bg-transparent border-border'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${isItemFamily ? 'text-white' : 'text-text-secondary'}`}>
                        Split equally
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Individual friend assignment (hidden when item is family style) */}
                  {!isItemFamily && (
                    <View className="flex-row flex-wrap">
                      {selectedFriends.map((friend) => {
                        const isAssigned = assigned.includes(friend.id);
                        return (
                          <TouchableOpacity
                            key={friend.id}
                            onPress={() => toggleAssign(item.id, friend.id)}
                            className={`mr-2 mb-2 px-3 py-1.5 rounded-full border ${
                              isAssigned ? 'bg-accent border-accent' : 'bg-transparent border-border'
                            }`}
                          >
                            <Text className={`text-xs font-semibold ${isAssigned ? 'text-white' : 'text-text-secondary'}`}>
                              {friend.display_name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {isFamilyStyle && (
                <Text className="text-xs text-text-secondary">
                  Split equally → {formatCurrency(perPerson)} each
                </Text>
              )}
            </View>
          );
        })}

        {/* Totals summary */}
        <View className="bg-background-secondary rounded-xl p-4 mt-2">
          <Text className="text-sm font-semibold text-text-secondary mb-2">BILL TOTALS</Text>
          {[
            { label: 'Subtotal', value: currentReceipt.subtotal },
            { label: 'Tax', value: currentReceipt.tax },
            { label: 'Tip', value: currentReceipt.tip },
          ].map((row) => (
            <View key={row.label} className="flex-row justify-between py-1">
              <Text className="text-sm text-text-secondary">{row.label}</Text>
              <Text className="text-sm text-text-primary">{formatCurrency(row.value)}</Text>
            </View>
          ))}
          <View className="flex-row justify-between pt-2 mt-1 border-t border-border">
            <Text className="text-base font-bold text-text-primary">Total</Text>
            <Text className="text-base font-bold text-accent">
              {formatCurrency(currentReceipt.total)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="bg-background border-t border-border-light px-4 py-4">
        <TouchableOpacity onPress={handleContinue} className="bg-accent rounded-xl py-4 items-center">
          <Text className="text-base font-semibold text-white">Continue → Summary</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
