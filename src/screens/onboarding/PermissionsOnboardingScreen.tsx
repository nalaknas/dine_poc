import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { registerForPushNotifications } from '../../lib/pushNotifications';

const PERMISSIONS = [
  {
    key: 'camera',
    icon: 'camera-outline' as const,
    title: 'Camera',
    description: 'Scan receipts and take food photos',
    required: true,
  },
  {
    key: 'photos',
    icon: 'images-outline' as const,
    title: 'Photo Library',
    description: 'Upload food photos from your library',
    required: true,
  },
  {
    key: 'notifications',
    icon: 'notifications-outline' as const,
    title: 'Notifications',
    description: 'Get notified when friends like or comment',
    required: false,
  },
];

export function PermissionsOnboardingScreen() {
  const navigation = useNavigation<any>();
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const requestPermission = async (key: string) => {
    try {
      let status = 'granted';
      if (key === 'camera') {
        const result = await ImagePicker.requestCameraPermissionsAsync();
        status = result.status;
      } else if (key === 'photos') {
        const result = await MediaLibrary.requestPermissionsAsync();
        status = result.status;
      } else if (key === 'notifications') {
        const token = await registerForPushNotifications();
        status = token ? 'granted' : 'denied';
      }
      setGranted((prev) => ({ ...prev, [key]: status === 'granted' }));
    } catch {
      Alert.alert('Permission Error', 'Could not request permission. Please enable in Settings.');
    }
  };

  const handleContinue = () => {
    navigation.navigate('ProfileSetup');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-3xl font-bold text-text-primary mb-2">Allow Access</Text>
        <Text className="text-base text-text-secondary mb-8">
          Dine needs a few permissions to give you the full experience.
        </Text>

        {PERMISSIONS.map((perm) => (
          <TouchableOpacity
            key={perm.key}
            onPress={() => requestPermission(perm.key)}
            className="flex-row items-center bg-background-secondary rounded-xl p-4 mb-3"
          >
            <View className="w-10 h-10 bg-accent/10 rounded-xl items-center justify-center mr-3">
              <Ionicons name={perm.icon} size={22} color="#007AFF" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-text-primary">{perm.title}</Text>
                {!perm.required && (
                  <Text className="text-xs text-text-secondary ml-2">(Optional)</Text>
                )}
              </View>
              <Text className="text-sm text-text-secondary mt-0.5">{perm.description}</Text>
            </View>
            {granted[perm.key] ? (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-6 pb-12">
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-accent rounded-xl py-4 items-center"
        >
          <Text className="text-white text-base font-semibold">Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
