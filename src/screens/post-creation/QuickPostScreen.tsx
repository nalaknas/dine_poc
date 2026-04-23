import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSocialStore } from '../../stores/socialStore';
import { createQuickPost, calculatePostCredits } from '../../services/post-service';
import { uploadFoodPhoto } from '../../services/receipt-service';
import { useToast } from '../../contexts/ToastContext';
import {
  trackPostCreated,
  trackError,
  trackPostCreationStep,
  trackPostPublishAttempted,
  trackPostAbandonedIfNotCreated,
} from '../../lib/analytics';
import { TierUpCelebration } from '../../components/ui/TierUpCelebration';
import type { UserTier } from '../../types';

export function QuickPostScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile, incrementMealCount } = useUserProfileStore();
  const { prependFeedPost, prependMyPost } = useSocialStore();
  const { showToast } = useToast();

  const [restaurantName, setRestaurantName] = useState('');
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  // Tier-up celebration state
  const [showTierUp, setShowTierUp] = useState(false);
  const [newTier, setNewTier] = useState<UserTier>('rock');
  const pendingNavRef = useRef<(() => void) | null>(null);

  // Funnel: opens the quick flow, fires abandonment on unmount if user
  // backs out without publishing.
  useEffect(() => {
    trackPostCreationStep('quick_post_opened', 0, 'quick');
    return () => trackPostAbandonedIfNotCreated('QuickPost', 0, 'quick');
  }, []);

  const pickPhotos = async (source: 'camera' | 'library') => {
    if (photos.length >= 5) {
      Alert.alert('Max Photos', 'Quick posts support up to 5 photos.');
      return;
    }

    const launch = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launch({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: source === 'library',
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canPost = restaurantName.trim().length > 0;

  const handlePublish = async () => {
    if (!user || !profile || !canPost) return;

    trackPostPublishAttempted({
      flow: 'quick',
      restaurantName: restaurantName.trim(),
      photoCount: photos.length,
    });

    setIsPosting(true);
    try {
      // 1. Upload photos
      const uploadedPhotos: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        if (uri.startsWith('http')) {
          uploadedPhotos.push(uri);
        } else {
          const url = await uploadFoodPhoto(uri, user.id, `quick_${Date.now()}_${i}.jpg`);
          uploadedPhotos.push(url);
        }
      }

      // 2. Create the post
      const post = await createQuickPost(
        user.id,
        restaurantName.trim(),
        caption.trim(),
        uploadedPhotos,
        isPublic,
      );

      // 3. Track analytics
      trackPostCreated({
        postId: post.id,
        isPublic,
        friendCount: 0,
        photoCount: uploadedPhotos.length,
        dishRatingCount: 0,
        restaurantName: restaurantName.trim(),
        flow: 'quick',
      });

      // 4. Calculate credits
      const oldTier = profile.current_tier ?? 'rock';
      let tierChanged = false;

      try {
        const creditResult = await calculatePostCredits(post.id);
        const { credits, streak } = creditResult;

        if (credits > 0) {
          let message = `You earned ${credits} credits!`;
          if (streak && streak.multiplier > 1) {
            message = `You earned ${credits} credits! \uD83D\uDD25 ${streak.weeks}-week streak (${streak.multiplier}x)`;
          }
          if (streak && streak.bonusCredits > 0) {
            message += ` +${streak.bonusCredits} streak bonus!`;
          }
          showToast({ message, type: 'success', duration: 4000 });
        }

        if (creditResult.newTier && creditResult.newTier !== oldTier) {
          tierChanged = true;
          setNewTier(creditResult.newTier);
          useUserProfileStore.getState().updateProfile({
            current_tier: creditResult.newTier,
          });
        }
      } catch (err: any) {
        console.warn('[quickPost] Credit calculation failed:', err?.message);
      }

      // 5. Update local state
      incrementMealCount();
      const fullPost = { ...post, author: profile };
      if (isPublic) prependFeedPost(fullPost);
      prependMyPost(fullPost);

      // 6. Navigate away
      const tabNav = navigation.getParent();
      const navigateAway = () => {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }),
        );
        if (isPublic) {
          tabNav?.navigate('Feed');
        } else {
          tabNav?.navigate('Profile');
        }
      };

      if (tierChanged) {
        pendingNavRef.current = navigateAway;
        setShowTierUp(true);
      } else {
        navigateAway();
      }
    } catch (err: any) {
      const errorMessage = err?.message ?? String(err);
      const errorCode = err?.code ?? err?.status;
      console.error('[QuickPost] publish failed', {
        message: errorMessage,
        code: errorCode,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack,
      });
      trackError({
        errorType: 'quick_post_failure',
        errorMessage,
        errorCode: errorCode ? String(errorCode) : undefined,
        screenName: 'QuickPost',
      });
      showToast({
        message: __DEV__ && errorCode
          ? `Something went wrong (${errorCode}). Try again.`
          : 'Something went wrong. Try again.',
        type: 'error',
        action: { label: 'Retry', onPress: handlePublish },
        duration: 5000,
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleTierUpDismiss = useCallback(() => {
    setShowTierUp(false);
    if (pendingNavRef.current) {
      pendingNavRef.current();
      pendingNavRef.current = null;
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['bottom']}>
      <TierUpCelebration
        visible={showTierUp}
        newTier={newTier}
        onDismiss={handleTierUpDismiss}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Post badge */}
          <View className="flex-row items-center mb-4">
            <View
              className="rounded-full px-3 py-1 flex-row items-center"
              style={{ backgroundColor: 'rgba(247,181,46,0.15)' }}
            >
              <Ionicons name="flash" size={14} color="#B07C15" />
              <Text className="font-semibold text-xs ml-1" style={{ color: '#B07C15' }}>Quick Post</Text>
            </View>
            <Text className="text-sm text-neutral-500 ml-2">Skip the receipt, just share!</Text>
          </View>

          {/* Restaurant Name */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-neutral-500 mb-2">RESTAURANT *</Text>
            <TextInput
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="Where did you eat?"
              placeholderTextColor="#9B9791"
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-base text-onyx-900"
            />
          </View>

          {/* Photos */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-neutral-500 mb-3">
              PHOTOS ({photos.length}/5)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((uri, i) => (
                <View key={i} className="mr-3 relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <View className="flex-row" style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => pickPhotos('camera')}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    className="bg-white border-2 border-dashed border-neutral-300 items-center justify-center"
                  >
                    <Ionicons name="camera-outline" size={26} color="#9B9791" />
                    <Text className="text-xs text-neutral-500 mt-1">Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => pickPhotos('library')}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    className="bg-white border-2 border-dashed border-neutral-300 items-center justify-center"
                  >
                    <Ionicons name="image-outline" size={26} color="#9B9791" />
                    <Text className="text-xs text-neutral-500 mt-1">Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Caption */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-neutral-500 mb-2">CAPTION</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="What did you think? (optional)"
              placeholderTextColor="#9B9791"
              multiline
              numberOfLines={3}
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-base text-onyx-900"
              style={{ minHeight: 88, textAlignVertical: 'top', lineHeight: 22 }}
            />
          </View>

          {/* Visibility toggle */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-neutral-500 mb-2">VISIBILITY</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsPublic(true)}
                className={`flex-1 flex-row items-center p-3 rounded-xl border bg-white ${
                  isPublic ? 'border-onyx-900' : 'border-neutral-200'
                }`}
                style={isPublic ? { borderWidth: 2 } : undefined}
              >
                <Ionicons name="globe-outline" size={18} color={isPublic ? '#0A0A0A' : '#6E6A63'} />
                <Text className={`ml-2 font-semibold text-sm ${isPublic ? 'text-onyx-900' : 'text-neutral-500'}`}>
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsPublic(false)}
                className={`flex-1 flex-row items-center p-3 rounded-xl border bg-white ${
                  !isPublic ? 'border-onyx-900' : 'border-neutral-200'
                }`}
                style={!isPublic ? { borderWidth: 2 } : undefined}
              >
                <Ionicons name="lock-closed-outline" size={18} color={!isPublic ? '#0A0A0A' : '#6E6A63'} />
                <Text className={`ml-2 font-semibold text-sm ${!isPublic ? 'text-onyx-900' : 'text-neutral-500'}`}>
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Post button */}
        <View className="bg-cream border-t border-neutral-200 px-4 py-4">
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPosting || !canPost}
            className={`rounded-xl py-4 items-center ${canPost ? 'bg-onyx-900' : 'bg-neutral-200'}`}
          >
            {isPosting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">Posting…</Text>
              </View>
            ) : (
              <Text className={`text-base font-semibold ${canPost ? 'text-white' : 'text-neutral-500'}`}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
