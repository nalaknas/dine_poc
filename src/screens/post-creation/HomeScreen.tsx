import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSocialStore } from '../../stores/socialStore';
import { useBillSplitterStore } from '../../stores/billSplitterStore';
import { analyzeReceipt } from '../../services/receipt-service';
import { useToast } from '../../contexts/ToastContext';
import { POST_CREATION_SCREENS } from '../../navigation/PostCreationNavigator';
import { Image } from 'react-native';

const OPTION = [
  { icon: 'camera-outline' as const, label: 'Take Photo', action: 'camera' },
  { icon: 'image-outline' as const, label: 'Upload from Library', action: 'library' },
  { icon: 'pencil-outline' as const, label: 'Enter Manually', action: 'manual' },
] as const;

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { updateDraftPost, clearDraftPost } = useSocialStore();
  const { setReceipt, reset: resetBill } = useBillSplitterStore();
  const { showToast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const billResult = await useBillSplitterStore.getState().loadDraft();
      if (!billResult) return;

      await useSocialStore.getState().loadDraft();

      Alert.alert(
        'Resume Draft?',
        'You have an unfinished post. Would you like to continue where you left off?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetBill();
              clearDraftPost();
            },
          },
          {
            text: 'Resume',
            onPress: () => {
              // Drafts can outlive a screen rename on older app builds. If the
              // stored step no longer exists, clear the draft silently and
              // keep the user on Home rather than dead-ending navigation.
              if (POST_CREATION_SCREENS.has(billResult.step)) {
                navigation.navigate(billResult.step);
              } else {
                resetBill();
                clearDraftPost();
                showToast({
                  message: 'Draft was from an older version. Cleared.',
                  type: 'info',
                });
              }
            },
          },
        ]
      );
    })();
  }, []);

  const handlePickImage = async (source: 'camera' | 'library') => {
    const launch = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launch({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsMultipleSelection: source === 'library',
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  const handleAction = (action: string) => {
    if (action === 'camera') handlePickImage('camera');
    else if (action === 'library') handlePickImage('library');
    else handleManual();
  };

  const handleManual = () => {
    clearDraftPost();
    resetBill();
    setReceipt({
      restaurantName: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      address: '',
      city: '',
      state: '',
      items: [],
      subtotal: 0,
      tax: 0,
      tip: 0,
      discount: 0,
      total: 0,
    });
    navigation.navigate('ValidateReceipt');
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please add at least one receipt image.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisFailed(false);
    try {
      const receipt = await analyzeReceipt(images);
      setReceipt(receipt);
      updateDraftPost({ receiptImages: images });
      navigation.navigate('ValidateReceipt');
    } catch (err: any) {
      console.error('Receipt analysis error:', err);
      setAnalysisFailed(true);
      showToast({
        message: 'Could not read the receipt. Try again or enter manually.',
        type: 'error',
        action: { label: 'Retry', onPress: handleAnalyze },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Quick Post option — editorial yellow (rare, earned accent) */}
        <TouchableOpacity
          onPress={() => navigation.navigate('QuickPost')}
          className="flex-row items-center bg-white rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'rgba(247,181,46,0.12)', borderWidth: 1, borderColor: 'rgba(247,181,46,0.35)' }}
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: 'rgba(247,181,46,0.25)' }}>
            <Ionicons name="flash" size={20} color="#B07C15" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-onyx-900">Quick Post</Text>
            <Text className="text-xs text-neutral-500">Skip the receipt — just share a meal</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#B07C15" />
        </TouchableOpacity>

        <Text className="text-base text-neutral-500 mb-6 text-center">
          Or scan your receipt to split the bill.
        </Text>

        {/* Action buttons */}
        <View className="gap-3 mb-8">
          {OPTION.map((opt) => (
            <TouchableOpacity
              key={opt.action}
              onPress={() => handleAction(opt.action)}
              className="flex-row items-center bg-white border border-neutral-200 rounded-xl p-4"
            >
              <View className="w-10 h-10 bg-neutral-50 rounded-xl items-center justify-center mr-3">
                <Ionicons name={opt.icon} size={20} color="#0A0A0A" />
              </View>
              <Text className="text-base font-semibold text-onyx-900">{opt.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9B9791" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected images preview */}
        {images.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-onyx-900 mb-2">
              {images.length} receipt image{images.length > 1 ? 's' : ''} selected
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {images.map((uri, i) => (
                <View key={i} className="mr-2 relative">
                  <Image
                    source={{ uri }}
                    style={{ width: 80, height: 120, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => handlePickImage('library')}
                className="w-20 h-28 border border-dashed border-neutral-300 rounded-lg items-center justify-center bg-white"
              >
                <Ionicons name="add" size={24} color="#9B9791" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Analyze CTA — dark onyx */}
        {images.length > 0 && (
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={isAnalyzing}
            className="bg-onyx-900 rounded-xl py-4 items-center"
          >
            {isAnalyzing ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" />
                <Text className="text-white font-semibold ml-2">Analyzing receipt…</Text>
              </View>
            ) : (
              <Text className="text-white text-base font-semibold">Scan Receipt</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Inline retry after OCR failure */}
        {analysisFailed && !isAnalyzing && (
          <View className="mt-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(184,69,69,0.08)' }}>
            <Text className="text-sm text-center mb-3" style={{ color: '#B84545' }}>
              Receipt scan failed. You can try again or enter items manually.
            </Text>
            <View className="flex-row justify-center" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={handleAnalyze}
                className="bg-onyx-900 rounded-lg px-4 py-2"
              >
                <Text className="text-white font-semibold text-sm">Retry Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleManual}
                className="bg-white border border-neutral-200 rounded-lg px-4 py-2"
              >
                <Text className="text-onyx-900 font-semibold text-sm">Enter Manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
