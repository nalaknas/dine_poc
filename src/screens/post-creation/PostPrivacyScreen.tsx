import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { createPost } from '../../services/post-service';
import { uploadFoodPhoto } from '../../services/receipt-service';
import { generateDishEmbedding } from '../../services/recommendation-service';
import type { CreatePostDraft } from '../../types';

export function PostPrivacyScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile, incrementMealCount } = useUserProfileStore();
  const { draftPost, updateDraftPost, clearDraftPost, prependFeedPost } = useSocialStore();
  const { personBreakdowns, currentReceipt, reset: resetBill } = useBillSplitterStore();

  const [isPublic, setIsPublic] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  const handlePublish = async () => {
    if (!user || !profile) return;

    setIsPosting(true);
    try {
      const draft = { ...draftPost, isPublic } as CreatePostDraft;

      // 1. Upload food photos
      const uploadedPhotos: string[] = [];
      for (let i = 0; i < (draft.foodPhotos ?? []).length; i++) {
        const uri = draft.foodPhotos![i];
        if (uri.startsWith('http')) {
          uploadedPhotos.push(uri);
        } else {
          const url = await uploadFoodPhoto(uri, user.id, `photo_${Date.now()}_${i}.jpg`);
          uploadedPhotos.push(url);
        }
      }
      draft.foodPhotos = uploadedPhotos;

      // 2. Create the post
      const post = await createPost(draft, user.id, personBreakdowns);

      // 3. Trigger taste embeddings (background, non-blocking)
      for (const rating of draft.dishRatings ?? []) {
        if (rating.rating > 0) {
          generateDishEmbedding({
            dishRatingId: post.id,
            dishName: rating.dishName,
            rating: rating.rating,
            notes: rating.notes,
            userId: user.id,
          });
        }
      }

      // 4. Update local state
      incrementMealCount();
      prependFeedPost({ ...post, author: profile });

      // 5. Clear draft
      clearDraftPost();
      resetBill();

      // 6. Navigate to Venmo if friends owe money
      const venmoableBreakdowns = personBreakdowns.filter(
        (b) => b.friend.venmo_username && b.total > 0
      );
      if (venmoableBreakdowns.length > 0) {
        navigation.replace('VenmoRequests', {
          breakdowns: venmoableBreakdowns,
          restaurantName: currentReceipt?.restaurantName ?? 'Dinner',
        });
      } else {
        navigation.navigate('Main');
      }
    } catch (err: any) {
      Alert.alert('Post Failed', err?.message ?? 'Could not publish your post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 px-6 pt-8">
        <Text className="text-2xl font-bold text-text-primary mb-2">Almost Done!</Text>
        <Text className="text-base text-text-secondary mb-8">
          Choose who can see your post.
        </Text>

        {/* Public */}
        <TouchableOpacity
          onPress={() => setIsPublic(true)}
          className={`flex-row items-center p-4 rounded-xl border mb-3 ${
            isPublic ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
          }`}
        >
          <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            isPublic ? 'bg-accent' : 'bg-border'
          }`}>
            <Ionicons name="globe-outline" size={20} color={isPublic ? '#fff' : '#6B7280'} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-primary">Public</Text>
            <Text className="text-sm text-text-secondary">Appears in your followers' feeds</Text>
          </View>
          {isPublic && <Ionicons name="checkmark-circle" size={22} color="#007AFF" />}
        </TouchableOpacity>

        {/* Private */}
        <TouchableOpacity
          onPress={() => setIsPublic(false)}
          className={`flex-row items-center p-4 rounded-xl border ${
            !isPublic ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
          }`}
        >
          <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            !isPublic ? 'bg-accent' : 'bg-border'
          }`}>
            <Ionicons name="lock-closed-outline" size={20} color={!isPublic ? '#fff' : '#6B7280'} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-primary">Private</Text>
            <Text className="text-sm text-text-secondary">Only you can see this (dining journal)</Text>
          </View>
          {!isPublic && <Ionicons name="checkmark-circle" size={22} color="#007AFF" />}
        </TouchableOpacity>

        <View className="mt-auto pb-6">
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPosting}
            className="bg-accent rounded-xl py-4 items-center"
          >
            {isPosting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">Posting...</Text>
              </View>
            ) : (
              <Text className="text-base font-semibold text-white">
                Share {isPublic ? 'to Feed' : 'to Journal'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
