import React, { useState, useCallback, useRef } from 'react';
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
import { trackPostCreated } from '../../lib/analytics';
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
      showToast({
        message: 'Something went wrong. Try again.',
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
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
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
            <View className="bg-gold/15 rounded-full px-3 py-1 flex-row items-center">
              <Ionicons name="flash" size={14} color="#F59E0B" />
              <Text className="text-gold font-semibold text-xs ml-1">Quick Post</Text>
            </View>
            <Text className="text-sm text-text-secondary ml-2">Skip the receipt, just share!</Text>
          </View>

          {/* Restaurant Name */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-text-secondary mb-2">RESTAURANT *</Text>
            <TextInput
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="Where did you eat?"
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
            />
          </View>

          {/* Photos */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-text-secondary mb-3">
              PHOTOS ({photos.length}/5)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((uri, i) => (
                <View key={i} className="mr-3 relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 100, height: 100, borderRadius: 10 }}
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
                    style={{ width: 100, height: 100, borderRadius: 10 }}
                    className="bg-background-secondary border-2 border-dashed border-border items-center justify-center"
                  >
                    <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
                    <Text className="text-xs text-text-secondary mt-1">Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => pickPhotos('library')}
                    style={{ width: 100, height: 100, borderRadius: 10 }}
                    className="bg-background-secondary border-2 border-dashed border-border items-center justify-center"
                  >
                    <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                    <Text className="text-xs text-text-secondary mt-1">Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Caption */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-text-secondary mb-2">CAPTION</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="What did you think? (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>

          {/* Visibility toggle */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-text-secondary mb-2">VISIBILITY</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsPublic(true)}
                className={`flex-1 flex-row items-center p-3 rounded-xl border ${
                  isPublic ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
                }`}
              >
                <Ionicons name="globe-outline" size={18} color={isPublic ? '#007AFF' : '#6B7280'} />
                <Text className={`ml-2 font-semibold text-sm ${isPublic ? 'text-accent' : 'text-text-secondary'}`}>
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsPublic(false)}
                className={`flex-1 flex-row items-center p-3 rounded-xl border ${
                  !isPublic ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
                }`}
              >
                <Ionicons name="lock-closed-outline" size={18} color={!isPublic ? '#007AFF' : '#6B7280'} />
                <Text className={`ml-2 font-semibold text-sm ${!isPublic ? 'text-accent' : 'text-text-secondary'}`}>
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Post button */}
        <View className="bg-background border-t border-border-light px-4 py-4">
          <TouchableOpacity
            onPress={handlePublish}
            disabled={isPosting || !canPost}
            className={`rounded-xl py-4 items-center ${canPost ? 'bg-accent' : 'bg-border'}`}
          >
            {isPosting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">Posting...</Text>
              </View>
            ) : (
              <Text className={`text-base font-semibold ${canPost ? 'text-white' : 'text-text-secondary'}`}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
