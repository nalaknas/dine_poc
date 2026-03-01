import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { RatingSlider } from '../../components/ui/RatingSlider';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';

export function RateMealScreen() {
  const navigation = useNavigation<any>();
  const { draftPost, updateDraftPost } = useSocialStore();
  const { currentReceipt } = useBillSplitterStore();

  const [overallRating, setOverallRating] = useState(draftPost.overallRating ?? 0);
  const [dishRatings, setDishRatings] = useState<{ dishName: string; rating: number; notes?: string }[]>(
    currentReceipt?.items.map((item) => ({
      dishName: item.name,
      rating: 0,
    })) ?? []
  );
  const [customDishName, setCustomDishName] = useState('');

  const updateDishRating = (index: number, rating: number) => {
    setDishRatings((prev) => prev.map((d, i) => (i === index ? { ...d, rating } : d)));
  };

  const updateDishNotes = (index: number, notes: string) => {
    setDishRatings((prev) => prev.map((d, i) => (i === index ? { ...d, notes } : d)));
  };

  const addCustomDish = () => {
    if (!customDishName.trim()) return;
    setDishRatings((prev) => [...prev, { dishName: customDishName.trim(), rating: 0 }]);
    setCustomDishName('');
  };

  const handleContinue = () => {
    updateDraftPost({
      overallRating,
      dishRatings: dishRatings.filter((d) => d.rating > 0),
    });
    navigation.navigate('AddCaption');
  };

  const starDishCount = dishRatings.filter((d) => d.rating >= 7).length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

          {/* Restaurant name */}
          <Text className="text-xl font-bold text-text-primary mb-1">
            {currentReceipt?.restaurantName ?? 'Restaurant'}
          </Text>
          <Text className="text-sm text-text-secondary mb-6">Rate your experience</Text>

          {/* Overall rating */}
          <View className="bg-background-secondary rounded-xl p-4 mb-4">
            <RatingSlider
              value={overallRating}
              onChange={setOverallRating}
              label="Overall Experience"
            />
          </View>

          {/* Individual dish ratings */}
          {dishRatings.length > 0 && (
            <View className="bg-background-secondary rounded-xl p-4 mb-4">
              <Text className="text-sm font-semibold text-text-secondary mb-4">DISHES</Text>
              {dishRatings.map((dish, i) => (
                <View key={i} className="mb-4">
                  <RatingSlider
                    value={dish.rating}
                    onChange={(v) => updateDishRating(i, v)}
                    label={dish.dishName || `Dish ${i + 1}`}
                  />
                  {dish.rating > 0 && (
                    <TextInput
                      value={dish.notes ?? ''}
                      onChangeText={(t) => updateDishNotes(i, t)}
                      placeholder="Notes (optional)"
                      placeholderTextColor="#9CA3AF"
                      className="mt-1 text-sm text-text-primary border border-border rounded-lg px-3 py-2"
                    />
                  )}
                  {dish.rating >= 7 && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-xs text-gold ml-1 font-semibold">Star Dish!</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Add custom dish */}
              <View className="flex-row items-center mt-2">
                <TextInput
                  value={customDishName}
                  onChangeText={setCustomDishName}
                  placeholder="Add another dish..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 text-sm text-text-primary border border-border rounded-lg px-3 py-2 mr-2"
                  onSubmitEditing={addCustomDish}
                />
                <TouchableOpacity onPress={addCustomDish}>
                  <Ionicons name="add-circle-outline" size={28} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Star dish summary */}
          {starDishCount > 0 && (
            <View className="bg-gold/10 border border-gold/30 rounded-xl p-3 flex-row items-center">
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text className="text-sm font-semibold text-text-primary ml-2">
                {starDishCount} Star Dish{starDishCount > 1 ? 'es' : ''} — these will be highlighted on your post!
              </Text>
            </View>
          )}
        </ScrollView>

        <View className="bg-background border-t border-border-light px-4 py-4">
          <TouchableOpacity onPress={handleContinue} className="bg-accent rounded-xl py-4 items-center">
            <Text className="text-base font-semibold text-white">Continue → Add Photos</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
