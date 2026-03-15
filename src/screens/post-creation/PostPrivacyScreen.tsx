import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { createPost } from '../../services/post-service';
import { useSplitHistoryStore } from '../../stores/splitHistoryStore';
import { uploadFoodPhoto } from '../../services/receipt-service';
import { generateDishEmbedding } from '../../services/recommendation-service';
import { useToast } from '../../contexts/ToastContext';
import type { CreatePostDraft } from '../../types';

export function PostPrivacyScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile, incrementMealCount } = useUserProfileStore();
  const { showToast } = useToast();
  const { draftPost, clearDraftPost, prependFeedPost, prependMyPost } = useSocialStore();
  const { personBreakdowns, currentReceipt, selectedFriends, itemAssignments, isFamilyStyle, reset: resetBill } = useBillSplitterStore();

  const [isPublic, setIsPublic] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [photoStatuses, setPhotoStatuses] = useState<('pending' | 'uploading' | 'done' | 'failed')[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const handlePublish = async () => {
    if (!user || !profile) return;

    setIsPosting(true);
    try {
      // Merge data from BOTH stores into a complete draft
      const draft = {
        ...draftPost,
        isPublic,
        // From billSplitterStore
        receiptData: currentReceipt ?? undefined,
        selectedFriends,
        itemAssignments,
        isFamilyStyle,
        personBreakdowns,
        mealDate: currentReceipt?.date,
      } as CreatePostDraft;

      // 1. Upload food photos with progress tracking
      const photos = draft.foodPhotos ?? [];
      const totalPhotos = photos.length;
      const localPhotoCount = photos.filter((u) => !u.startsWith('http')).length;

      if (totalPhotos > 0) {
        setPhotoStatuses(new Array(totalPhotos).fill('pending'));
        setUploadProgress({ current: 0, total: localPhotoCount });
      }

      const uploadedPhotos: string[] = [];
      let uploaded = 0;
      for (let i = 0; i < totalPhotos; i++) {
        const uri = photos[i];
        if (uri.startsWith('http')) {
          uploadedPhotos.push(uri);
          setPhotoStatuses((prev) => { const next = [...prev]; next[i] = 'done'; return next; });
        } else {
          setPhotoStatuses((prev) => { const next = [...prev]; next[i] = 'uploading'; return next; });
          try {
            const url = await uploadFoodPhoto(uri, user.id, `photo_${Date.now()}_${i}.jpg`);
            uploadedPhotos.push(url);
            uploaded++;
            setUploadProgress({ current: uploaded, total: localPhotoCount });
            setPhotoStatuses((prev) => { const next = [...prev]; next[i] = 'done'; return next; });
            Animated.timing(progressAnim, {
              toValue: uploaded / localPhotoCount,
              duration: 300,
              useNativeDriver: false,
            }).start();
          } catch (uploadErr: any) {
            console.warn('[publish] Photo upload failed:', uploadErr?.message);
            setPhotoStatuses((prev) => { const next = [...prev]; next[i] = 'failed'; return next; });
          }
        }
      }
      draft.foodPhotos = uploadedPhotos;

      setIsFinalizing(true);

      // 2. Create the post
      const post = await createPost(draft, user.id, personBreakdowns);

      // 3. Record split history (persist friends + venmo for future splits)
      const friendsToRecord = selectedFriends.filter((f) => f.id !== user.id);
      if (friendsToRecord.length > 0) {
        useSplitHistoryStore.getState().recordSplit(friendsToRecord);
      }

      // 4. Trigger taste embeddings (background, non-blocking)
      const embeddingRatings = (draft.dishRatings ?? []).filter((r) => r.rating > 0);
      if (embeddingRatings.length > 0) {
        Promise.allSettled(
          embeddingRatings.map((rating) =>
            generateDishEmbedding({
              dishRatingId: post.id,
              dishName: rating.dishName,
              rating: rating.rating,
              notes: rating.notes,
              userId: user.id,
            })
          )
        ).then((results) => {
          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length > 0) {
            showToast({
              message: 'Taste profile update skipped. Your post was published successfully.',
              type: 'info',
              duration: 4000,
            });
          }
        });
      }

      // 5. Update local state
      incrementMealCount();
      const fullPost = { ...post, author: profile };
      if (isPublic) prependFeedPost(fullPost);
      prependMyPost(fullPost);

      // 6. Clear draft
      clearDraftPost();
      resetBill();

      // 7. Exit post creation flow
      const venmoableBreakdowns = personBreakdowns.filter(
        (b) => b.friend.venmo_username && b.total > 0
      );

      // Get tab navigator to switch tabs, then reset PostCreation stack
      const tabNav = navigation.getParent();

      if (venmoableBreakdowns.length > 0) {
        // Go to Venmo requests (root stack screen)
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
        // Navigate to VenmoRequests on root stack
        tabNav?.getParent()?.navigate('VenmoRequests', {
          breakdowns: venmoableBreakdowns,
          restaurantName: currentReceipt?.restaurantName ?? 'Dinner',
        });
      } else if (isPublic) {
        // Public → go to Feed so user sees their post
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
        tabNav?.navigate('Feed');
      } else {
        // Private → go to the meal detail card
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
        tabNav?.navigate('Profile');
        tabNav?.getParent()?.navigate('MealDetail', { postId: post.id });
      }
    } catch (err: any) {
      showToast({
        message: 'Something went wrong. Try again.',
        type: 'error',
        action: { label: 'Retry', onPress: handlePublish },
        duration: 5000,
      });
    } finally {
      setIsPosting(false);
      setIsFinalizing(false);
      setUploadProgress({ current: 0, total: 0 });
      setPhotoStatuses([]);
      progressAnim.setValue(0);
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
          {/* Upload progress indicator */}
          {isPosting && uploadProgress.total > 0 && !isFinalizing && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-text-primary text-center mb-2">
                Uploading {uploadProgress.current}/{uploadProgress.total} photos...
              </Text>
              {/* Progress bar */}
              <View className="h-2 bg-border rounded-full overflow-hidden mb-3">
                <Animated.View
                  className="h-full bg-accent rounded-full"
                  style={{
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }}
                />
              </View>
              {/* Per-photo status dots */}
              <View className="flex-row justify-center" style={{ gap: 6 }}>
                {photoStatuses.map((status, i) => (
                  <View
                    key={i}
                    className={`w-5 h-5 rounded-full items-center justify-center ${
                      status === 'done' ? 'bg-green-500' :
                      status === 'uploading' ? 'bg-accent' :
                      status === 'failed' ? 'bg-red-400' :
                      'bg-border'
                    }`}
                  >
                    {status === 'done' && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                    {status === 'uploading' && (
                      <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.5 }] }} />
                    )}
                    {status === 'failed' && (
                      <Ionicons name="close" size={12} color="#fff" />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPosting}
            className="bg-accent rounded-xl py-4 items-center"
          >
            {isPosting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">
                  {isFinalizing ? 'Finishing up...' : uploadProgress.total === 0 ? 'Posting...' : 'Uploading...'}
                </Text>
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
