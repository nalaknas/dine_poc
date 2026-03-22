import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RatingSlider } from '../../components/ui/RatingSlider';
import { useAuthStore } from '../../stores/authStore';
import { getPost, submitTaggedUserRatings } from '../../services/post-service';
import { supabase } from '../../lib/supabase';
import { generateDishEmbedding } from '../../services/recommendation-service';
import type { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaggedRate'>;

export function TaggedRateScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [dishRatings, setDishRatings] = useState<{ dishName: string; rating: number; notes?: string }[]>([]);

  useEffect(() => {
    loadPostDishes();
  }, [postId]);

  const loadPostDishes = async () => {
    const post = await getPost(postId, user?.id);
    if (!post) {
      Alert.alert('Error', 'Post not found.');
      navigation.goBack();
      return;
    }
    setRestaurantName(post.restaurant_name);

    // Get ALL receipt items (the full bill)
    const { data: receiptItems } = await supabase
      .from('receipt_items')
      .select('name')
      .eq('post_id', postId);

    const seen = new Set<string>();
    let dishes: { dishName: string; rating: number }[] = [];

    if (receiptItems && receiptItems.length > 0) {
      dishes = receiptItems
        .filter((item) => {
          const key = (item.name as string).toLowerCase().trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item) => ({ dishName: item.name as string, rating: 0 }));
    } else {
      // Fallback: use dish names from author's ratings
      const authorRatings = (post.dish_ratings ?? []).filter(
        (r) => r.user_id !== user?.id,
      );
      dishes = authorRatings
        .filter((r) => {
          const key = r.dish_name.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((r) => ({ dishName: r.dish_name, rating: 0 }));
    }

    // Check for existing ratings (edit mode)
    if (user) {
      const { data: existingRatings } = await supabase
        .from('dish_ratings')
        .select('dish_name, rating, notes')
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (existingRatings && existingRatings.length > 0) {
        setIsEditMode(true);
        const existingMap = new Map(
          existingRatings.map((r) => [r.dish_name.toLowerCase().trim(), r]),
        );
        dishes = dishes.map((d) => {
          const existing = existingMap.get(d.dishName.toLowerCase().trim());
          return existing
            ? { dishName: d.dishName, rating: existing.rating, notes: existing.notes ?? undefined }
            : d;
        });
      }
    }

    setDishRatings(dishes);
    setIsLoading(false);
  };

  const updateDishRating = (index: number, rating: number) => {
    setDishRatings((prev) => prev.map((d, i) => (i === index ? { ...d, rating } : d)));
  };

  const updateDishNotes = (index: number, notes: string) => {
    setDishRatings((prev) => prev.map((d, i) => (i === index ? { ...d, notes } : d)));
  };

  const handleSubmit = async () => {
    if (!user) return;

    const hasAnyRating = dishRatings.some((r) => r.rating > 0);
    if (!hasAnyRating) {
      Alert.alert('Rate at least one dish', 'Tap a number to rate the dishes you tried.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ratingIds = await submitTaggedUserRatings(
        postId,
        user.id,
        dishRatings,
      );

      // Trigger taste embeddings (background, non-blocking)
      if (ratingIds.length > 0) {
        const rated = dishRatings.filter((r) => r.rating > 0);
        Promise.allSettled(
          rated.map((r) =>
            generateDishEmbedding({
              dishRatingId: postId,
              dishName: r.dishName,
              rating: r.rating,
              notes: r.notes,
              userId: user.id,
            }),
          ),
        );
      }

      Alert.alert('Done!', isEditMode ? 'Ratings updated.' : 'Ratings saved. Your taste profile has been updated.', [
        { text: 'OK', onPress: () => navigation.replace('MealDetail', { postId }) },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save ratings. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const starDishCount = dishRatings.filter((d) => d.rating >= 7).length;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View className="flex-row items-center mb-1">
            <Ionicons name="pricetag" size={18} color="#10B981" />
            <Text className="text-sm font-semibold text-green-600 ml-1">You were tagged in this meal</Text>
          </View>
          <Text className="text-xl font-bold text-text-primary mb-1">{restaurantName}</Text>
          <Text className="text-sm text-text-secondary mb-6">
            {isEditMode ? 'Update your ratings below' : 'Rate the dishes to build your taste profile'}
          </Text>

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
                    label={dish.dishName}
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
            </View>
          )}

          {/* Star dish summary */}
          {starDishCount > 0 && (
            <View className="bg-gold/10 border border-gold/30 rounded-xl p-3 flex-row items-center">
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text className="text-sm font-semibold text-text-primary ml-2">
                {starDishCount} Star Dish{starDishCount > 1 ? 'es' : ''} — added to your taste profile!
              </Text>
            </View>
          )}
        </ScrollView>

        <View className="bg-background border-t border-border-light px-4 py-4">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="bg-accent rounded-xl py-4 items-center"
          >
            {isSubmitting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">Saving...</Text>
              </View>
            ) : (
              <Text className="text-base font-semibold text-white">{isEditMode ? 'Update Ratings' : 'Save Ratings'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
