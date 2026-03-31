import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Image, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { TagChip } from '../../components/ui/TagChip';
import { MentionInput } from '../../components/ui/MentionInput';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { MEAL_TYPES, CUISINES, OCCASIONS } from '../../constants/tags';

export function AddCaptionScreen() {
  const navigation = useNavigation<any>();
  const { draftPost, updateDraftPost } = useSocialStore();
  const { currentReceipt } = useBillSplitterStore();

  const [caption, setCaption] = useState(draftPost.caption ?? '');
  const [photos, setPhotos] = useState<string[]>(draftPost.foodPhotos ?? []);
  const [photoLabels, setPhotoLabels] = useState<Record<number, string>>(draftPost.photoLabels ?? {});
  const [tags, setTags] = useState<string[]>(draftPost.tags ?? []);
  const [cuisineType, setCuisineType] = useState(draftPost.cuisineType ?? '');
  const [mealType, setMealType] = useState(draftPost.mealType ?? '');

  // Unique dish names from the receipt for tagging photos
  const dishNames = React.useMemo(() => {
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
    if (photos.length >= 10) {
      Alert.alert('Max Photos', 'You can add up to 10 photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 10));
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

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleContinue = () => {
    updateDraftPost({
      caption,
      foodPhotos: photos,
      photoLabels,
      tags,
      cuisineType: cuisineType || undefined,
      mealType: mealType || undefined,
    });
    navigation.navigate('PostPrivacy');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

          {/* Photo picker */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-text-secondary mb-3">
              PHOTOS ({photos.length}/10)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((uri, i) => (
                <View key={i} className="mr-3" style={{ width: 110 }}>
                  <View className="relative">
                    <Image
                      source={{ uri }}
                      style={{ width: 110, height: 110, borderRadius: 10 }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                    {photoLabels[i] && (
                      <View className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-[10px] px-2 py-1">
                        <Text className="text-white text-[10px] font-semibold" numberOfLines={1}>
                          {photoLabels[i]}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Dish tag selector */}
                  {dishNames.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1.5">
                      {dishNames.map((name) => (
                        <TouchableOpacity
                          key={name}
                          onPress={() => setPhotoLabels((prev) =>
                            prev[i] === name
                              ? (() => { const { [i]: _, ...rest } = prev; return rest; })()
                              : { ...prev, [i]: name }
                          )}
                          className={`mr-1 px-2 py-0.5 rounded-full border ${
                            photoLabels[i] === name
                              ? 'bg-accent border-accent'
                              : 'bg-background-secondary border-border'
                          }`}
                        >
                          <Text
                            className={`text-[10px] ${
                              photoLabels[i] === name ? 'text-white font-semibold' : 'text-text-secondary'
                            }`}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
              {photos.length < 10 && (
                <TouchableOpacity
                  onPress={pickPhotos}
                  style={{ width: 100, height: 100, borderRadius: 10 }}
                  className="bg-background-secondary border-2 border-dashed border-border items-center justify-center"
                >
                  <Ionicons name="add" size={32} color="#9CA3AF" />
                  <Text className="text-xs text-text-secondary mt-1">Add Photos</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Caption */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-text-secondary mb-2">CAPTION</Text>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              placeholder={`Share your thoughts about ${currentReceipt?.restaurantName ?? 'this meal'}... Use @ to mention friends`}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
          </View>

          {/* Meal type */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-2">MEAL TYPE</Text>
            <View className="flex-row flex-wrap">
              {MEAL_TYPES.map((type) => (
                <TagChip
                  key={type}
                  label={type}
                  selected={mealType === type}
                  onPress={() => setMealType(mealType === type ? '' : type)}
                  size="sm"
                />
              ))}
            </View>
          </View>

          {/* Cuisine */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-2">CUISINE</Text>
            <View className="flex-row flex-wrap">
              {CUISINES.map((c) => (
                <TagChip
                  key={c}
                  label={c}
                  selected={cuisineType === c}
                  onPress={() => setCuisineType(cuisineType === c ? '' : c)}
                  size="sm"
                />
              ))}
            </View>
          </View>

          {/* Occasion tags */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-2">OCCASION</Text>
            <View className="flex-row flex-wrap">
              {OCCASIONS.map((occ) => (
                <TagChip
                  key={occ}
                  label={occ}
                  selected={tags.includes(occ)}
                  onPress={() => toggleTag(occ)}
                  size="sm"
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="bg-background border-t border-border-light px-4 py-4">
          <TouchableOpacity onPress={handleContinue} className="bg-accent rounded-xl py-4 items-center">
            <Text className="text-base font-semibold text-white">Continue → Privacy</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
