import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { MentionInput } from '../../components/ui/MentionInput';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { MEAL_TYPES, CUISINES, OCCASIONS } from '../../constants/tags';

const FLAVOR_TAGS = [
  'Briny', 'Handmade pasta', 'Fermented', 'Charred',
  'Spicy', 'Natural wine', 'Marrow/offal',
] as const;

const CAPTION_LIMIT = 280;
const MAX_PHOTOS = 10;

export function ReviewComposerScreen() {
  const navigation = useNavigation<any>();
  const { draftPost, updateDraftPost } = useSocialStore();
  const { currentReceipt } = useBillSplitterStore();

  const [caption, setCaption] = useState(draftPost.caption ?? '');
  const [photos, setPhotos] = useState<string[]>(draftPost.foodPhotos ?? []);
  const [photoLabels, setPhotoLabels] = useState<Record<number, string>>(
    draftPost.photoLabels ?? {},
  );
  const [mealType, setMealType] = useState(draftPost.mealType ?? '');
  const [cuisineType, setCuisineType] = useState(draftPost.cuisineType ?? '');
  const [occasions, setOccasions] = useState<string[]>(
    draftPost.tags ?? [],
  );
  const [flavorTags, setFlavorTags] = useState<string[]>(
    draftPost.flavorTags ?? [],
  );

  // Unique dish names from the receipt for per-photo labeling
  const dishNames = useMemo(() => {
    if (!currentReceipt?.items?.length) return [];
    const seen = new Set<string>();
    return currentReceipt.items
      .filter((item) => {
        const key = item.name.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => item.name);
  }, [currentReceipt]);

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Max photos', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoLabels((prev) => {
      const updated: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki < index) updated[ki] = v;
        else if (ki > index) updated[ki - 1] = v;
      }
      return updated;
    });
  };

  const toggleLabel = (photoIndex: number, dishName: string) => {
    setPhotoLabels((prev) => {
      if (prev[photoIndex] === dishName) {
        const { [photoIndex]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [photoIndex]: dishName };
    });
  };

  const toggle = <T extends string>(value: T, set: React.Dispatch<React.SetStateAction<string[]>>) => {
    set((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const handleContinue = () => {
    updateDraftPost({
      caption,
      foodPhotos: photos,
      photoLabels,
      tags: occasions,
      cuisineType: cuisineType || undefined,
      mealType: mealType || undefined,
      flavorTags,
    });
    navigation.navigate('PostPrivacy');
  };

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
          {/* Meta block */}
          <Text style={styles.overline}>SHARE IT</Text>
          <Text style={styles.headline}>
            {currentReceipt?.restaurantName
              ? `Your post about ${currentReceipt.restaurantName}.`
              : 'Your post.'}
          </Text>

          {/* Photo carousel */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              PHOTOS ({photos.length}/{MAX_PHOTOS})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.photoColumn}>
                  <View style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />

                    {/* Remove button */}
                    <Pressable
                      onPress={() => removePhoto(i)}
                      style={styles.photoRemove}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </Pressable>

                    {/* N of M badge */}
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountLabel}>
                        {i + 1} of {photos.length}
                      </Text>
                    </View>

                    {/* Current label */}
                    {photoLabels[i] && (
                      <View style={styles.photoLabelOverlay}>
                        <Text style={styles.photoLabelText} numberOfLines={1}>
                          {photoLabels[i]}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Per-photo dish tags (from receipt) */}
                  {dishNames.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.dishTagRow}
                    >
                      {dishNames.map((name) => {
                        const on = photoLabels[i] === name;
                        return (
                          <Pressable
                            key={name}
                            onPress={() => toggleLabel(i, name)}
                            style={[
                              styles.dishTag,
                              on ? styles.dishTagActive : styles.dishTagInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dishTagLabel,
                                on
                                  ? styles.dishTagLabelActive
                                  : styles.dishTagLabelInactive,
                              ]}
                              numberOfLines={1}
                            >
                              {name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              ))}

              {photos.length < MAX_PHOTOS && (
                <Pressable onPress={pickPhotos} style={styles.photoAdd}>
                  <Ionicons name="add" size={28} color={Neutral[400]} />
                  <Text style={styles.photoAddLabel}>Add photos</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>

          {/* Restaurant preview card (if from receipt flow) */}
          {currentReceipt?.restaurantName && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RESTAURANT</Text>
              <View style={styles.restaurantCard}>
                <View style={styles.restaurantThumb}>
                  {photos[0] ? (
                    <Image source={{ uri: photos[0] }} style={styles.photo} />
                  ) : (
                    <Ionicons name="restaurant" size={20} color={Neutral[400]} />
                  )}
                </View>
                <View style={styles.restaurantMeta}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {currentReceipt.restaurantName}
                  </Text>
                  {(currentReceipt.city || currentReceipt.state) && (
                    <Text style={styles.restaurantSub} numberOfLines={1}>
                      {[currentReceipt.city, currentReceipt.state].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Caption */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>CAPTION</Text>
              <Text style={styles.counter}>
                {caption.length} / {CAPTION_LIMIT}
              </Text>
            </View>
            <MentionInput
              value={caption}
              onChangeText={(t: string) =>
                setCaption(t.length <= CAPTION_LIMIT ? t : t.slice(0, CAPTION_LIMIT))
              }
              placeholder={`Say something about ${currentReceipt?.restaurantName ?? 'this meal'}… Use @ to mention friends.`}
              placeholderTextColor={Neutral[400]}
              multiline
              numberOfLines={4}
              style={styles.captionInput}
            />
          </View>

          {/* Flavor tags — the editorial moment */}
          <View style={styles.section}>
            <Text style={styles.flavorHeading}>What did it taste like?</Text>
            <Text style={styles.flavorKicker}>
              Helps friends with similar taste find it.
            </Text>
            <View style={styles.chipWrap}>
              {FLAVOR_TAGS.map((tag) => {
                const on = flavorTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggle(tag, setFlavorTags)}
                    style={[
                      styles.flavorChip,
                      on ? styles.flavorChipActive : styles.flavorChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.flavorChipLabel,
                        on
                          ? styles.flavorChipLabelActive
                          : styles.flavorChipLabelInactive,
                      ]}
                    >
                      {on ? '✓ ' : ''}
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Meal type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEAL TYPE</Text>
            <View style={styles.chipWrap}>
              {MEAL_TYPES.map((type) => {
                const on = mealType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setMealType(on ? '' : type)}
                    style={[
                      styles.smallChip,
                      on ? styles.smallChipActive : styles.smallChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallChipLabel,
                        on ? styles.smallChipLabelActive : styles.smallChipLabelInactive,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Cuisine */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CUISINE</Text>
            <View style={styles.chipWrap}>
              {CUISINES.map((c) => {
                const on = cuisineType === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCuisineType(on ? '' : c)}
                    style={[
                      styles.smallChip,
                      on ? styles.smallChipActive : styles.smallChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallChipLabel,
                        on ? styles.smallChipLabelActive : styles.smallChipLabelInactive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Occasions */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OCCASION</Text>
            <View style={styles.chipWrap}>
              {OCCASIONS.map((occ) => {
                const on = occasions.includes(occ);
                return (
                  <Pressable
                    key={occ}
                    onPress={() => toggle(occ, setOccasions)}
                    style={[
                      styles.smallChip,
                      on ? styles.smallChipActive : styles.smallChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallChipLabel,
                        on ? styles.smallChipLabelActive : styles.smallChipLabelInactive,
                      ]}
                    >
                      {occ}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Primary CTA */}
        <View style={styles.footer}>
          <AnimatedPressable onPress={handleContinue} style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryLabel}>Continue · Choose audience</Text>
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
  headline: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    color: Onyx[900],
    marginBottom: 20,
  },

  section: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.66,
    color: Neutral[500],
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  counter: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    color: Neutral[400],
  },

  // Photos
  photoRow: {
    gap: 12,
    paddingRight: 4,
  },
  photoColumn: {
    width: 120,
  },
  photoWrap: {
    width: 120,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Neutral[100],
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoCountLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: '#FFFFFF',
  },
  photoLabelOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoLabelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },

  dishTagRow: {
    marginTop: 6,
  },
  dishTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 4,
    borderWidth: 1,
  },
  dishTagActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  dishTagInactive: {
    backgroundColor: 'transparent',
    borderColor: Neutral[200],
  },
  dishTagLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    maxWidth: 90,
  },
  dishTagLabelActive: {
    color: '#FFFFFF',
  },
  dishTagLabelInactive: {
    color: Neutral[500],
  },

  photoAdd: {
    width: 120,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddLabel: {
    marginTop: 6,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Neutral[400],
  },

  // Restaurant card
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F1EEE7',
  },
  restaurantThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  restaurantMeta: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  restaurantSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Neutral[500],
    marginTop: 1,
  },

  // Caption
  captionInput: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Onyx[900],
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F1EEE7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 96,
    textAlignVertical: 'top',
    lineHeight: 22,
  },

  // Flavor tags (editorial moment)
  flavorHeading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
    marginBottom: 2,
  },
  flavorKicker: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Neutral[500],
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  flavorChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  flavorChipActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  flavorChipInactive: {
    backgroundColor: 'transparent',
    borderColor: Neutral[300],
  },
  flavorChipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  flavorChipLabelActive: {
    color: '#FFFFFF',
  },
  flavorChipLabelInactive: {
    color: '#5E5C58',
  },

  // Small chips (meal type / cuisine / occasion)
  smallChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallChipActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  smallChipInactive: {
    backgroundColor: 'transparent',
    borderColor: Neutral[200],
  },
  smallChipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  smallChipLabelActive: {
    color: '#FFFFFF',
  },
  smallChipLabelInactive: {
    color: Neutral[500],
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

// Unused imports suppressed when referenced in other flow variants.
void Gold;
