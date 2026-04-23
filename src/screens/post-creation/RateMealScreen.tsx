import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, KeyboardAvoidingView,
  Platform, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { RatingSlider } from '../../components/ui/RatingSlider';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';

const STAR_DISH_THRESHOLD = 7;

export function RateMealScreen() {
  const navigation = useNavigation<any>();
  const { draftPost, updateDraftPost } = useSocialStore();
  const { currentReceipt } = useBillSplitterStore();

  const [overallRating, setOverallRating] = useState(draftPost.overallRating ?? 0);
  const [dishRatings, setDishRatings] = useState<
    { dishName: string; rating: number; notes?: string }[]
  >(() => {
    if (!currentReceipt?.items.length) return [];
    const seen = new Set<string>();
    return currentReceipt.items
      .filter((item) => {
        const key = item.name.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({ dishName: item.name, rating: 0 }));
  });
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
    navigation.navigate('ReviewComposer');
  };

  const starDishCount = dishRatings.filter((d) => d.rating >= STAR_DISH_THRESHOLD).length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Editorial meta */}
          <Text style={styles.overline}>RATE THE MEAL</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {currentReceipt?.restaurantName ?? 'Restaurant'}
          </Text>
          <Text style={styles.subhead}>
            Your ratings train the taste engine — private, and used only to bring you
            better picks.
          </Text>

          {/* Overall rating card */}
          <View style={styles.card}>
            <RatingSlider
              value={overallRating}
              onChange={setOverallRating}
              label="Overall experience"
            />
          </View>

          {/* Per-dish ratings */}
          {dishRatings.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DISHES</Text>
              {dishRatings.map((dish, i) => (
                <View
                  key={`${dish.dishName}-${i}`}
                  style={[
                    styles.dishRow,
                    i < dishRatings.length - 1 && styles.dishRowDivider,
                  ]}
                >
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
                      placeholderTextColor={Neutral[400]}
                      style={styles.notesInput}
                    />
                  )}
                  {dish.rating >= STAR_DISH_THRESHOLD && (
                    <View style={styles.starDishRow}>
                      <Ionicons name="star" size={12} color={Gold[400]} />
                      <Text style={styles.starDishLabel}>Star Dish</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Add custom dish */}
              <View style={styles.customDishRow}>
                <TextInput
                  value={customDishName}
                  onChangeText={setCustomDishName}
                  placeholder="Add another dish…"
                  placeholderTextColor={Neutral[400]}
                  style={styles.customDishInput}
                  onSubmitEditing={addCustomDish}
                />
                <Pressable onPress={addCustomDish} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={26} color={Onyx[900]} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Star dish summary */}
          {starDishCount > 0 && (
            <View style={styles.starSummary}>
              <Ionicons name="star" size={18} color={Gold[600]} />
              <Text style={styles.starSummaryLabel}>
                {starDishCount} Star Dish{starDishCount > 1 ? 'es' : ''} · highlighted on
                your post
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AnimatedPressable onPress={handleContinue} style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryLabel}>Continue · Add photos + caption</Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  flex: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  overline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.88,
    color: '#8E8B84',
    marginBottom: 6,
  },
  restaurantName: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.28,
    color: Onyx[900],
  },
  subhead: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#5E5C58',
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 320,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F1EEE7',
  },

  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.66,
    color: Neutral[500],
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  dishRow: {
    paddingBottom: 14,
  },
  dishRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1EEE7',
    marginBottom: 14,
  },

  notesInput: {
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Onyx[900],
    backgroundColor: Neutral[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  starDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  starDishLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Gold[600],
  },

  customDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  customDishInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Onyx[900],
    backgroundColor: Neutral[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  starSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(247,181,46,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(247,181,46,0.30)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  starSummaryLabel: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Onyx[900],
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Neutral[200],
    backgroundColor: Semantic.bgCream,
  },
  ctaPrimary: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Onyx[900],
  },
  ctaPrimaryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
