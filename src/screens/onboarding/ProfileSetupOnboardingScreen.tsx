import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { TagChip } from '../../components/ui/TagChip';
import { CUISINES, DIETARY_RESTRICTIONS } from '../../constants/tags';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { updateUserProfile } from '../../services/auth-service';
import { uploadAvatar } from '../../services/receipt-service';
import { VenmoConnectButton } from '../../components/ui/VenmoConnectButton';

export function ProfileSetupOnboardingScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { profile, setProfile } = useUserProfileStore();
  const { setHasCompletedOnboarding } = useSettingsStore();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? '');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const toggleCuisine = (c: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleDietary = (d: string) => {
    setSelectedDietary((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleFinish = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter your display name.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Required', 'Please enter a username.');
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      let avatarUrl = profile?.avatar_url;
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadAvatar(avatarUri, user.id);
      }

      const updated = await updateUserProfile(user.id, {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        avatar_url: avatarUrl,
        phone_number: phoneNumber.trim() || undefined,
        venmo_username: venmoUsername || undefined,
        cuisine_preferences: selectedCuisines,
        dietary_restrictions: selectedDietary,
      });

      setProfile(updated);
      setHasCompletedOnboarding(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-6">
            <Text className="text-3xl font-bold text-text-primary mb-1">Set Up Profile</Text>
            <Text className="text-base text-text-secondary mb-8">
              Help your friends find you and personalize your experience.
            </Text>

            {/* Avatar */}
            <TouchableOpacity onPress={pickAvatar} className="items-center mb-6">
              <Avatar
                uri={avatarUri}
                displayName={displayName || 'Me'}
                size={80}
              />
              <Text className="text-sm font-medium text-accent mt-2">Add Photo</Text>
            </TouchableOpacity>

            {/* Display name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#9CA3AF"
                className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              />
            </View>

            {/* Username */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Username</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="@yourhandle"
                autoCapitalize="none"
                placeholderTextColor="#9CA3AF"
                className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              />
            </View>

            {/* Phone number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Phone Number</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="(555) 123-4567"
                placeholderTextColor="#9CA3AF"
                className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              />
              <Text className="text-xs text-text-secondary mt-1.5">So friends can find and split bills with you.</Text>
            </View>

            {/* Venmo (optional) */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-text-primary mb-1.5">Venmo</Text>
              <VenmoConnectButton
                currentUsername={venmoUsername || undefined}
                onUsernameConfirmed={setVenmoUsername}
              />
              <Text className="text-xs text-text-secondary mt-1.5">Optional — you can add this later in Settings.</Text>
            </View>

            {/* Cuisine prefs */}
            <Text className="text-base font-semibold text-text-primary mb-3">Favorite Cuisines</Text>
            <View className="flex-row flex-wrap mb-6">
              {CUISINES.map((c) => (
                <TagChip
                  key={c}
                  label={c}
                  selected={selectedCuisines.includes(c)}
                  onPress={() => toggleCuisine(c)}
                  size="sm"
                />
              ))}
            </View>

            {/* Dietary */}
            <Text className="text-base font-semibold text-text-primary mb-3">Dietary Restrictions</Text>
            <View className="flex-row flex-wrap mb-8">
              {DIETARY_RESTRICTIONS.map((d) => (
                <TagChip
                  key={d}
                  label={d}
                  selected={selectedDietary.includes(d)}
                  onPress={() => toggleDietary(d)}
                  size="sm"
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleFinish}
              disabled={isLoading}
              className="bg-accent rounded-xl py-4 items-center"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-semibold">Let's Eat!</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
