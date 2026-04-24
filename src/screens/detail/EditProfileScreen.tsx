import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { updateUserProfile } from '../../services/auth-service';
import { uploadAvatar } from '../../services/receipt-service';
import { VenmoConnectButton } from '../../components/ui/VenmoConnectButton';
import { useToast } from '../../contexts/ToastContext';

export function EditProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { profile, updateProfile } = useUserProfileStore();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [state, setState] = useState(profile?.state ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [isSaving, setIsSaving] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;
      if (avatarUri && avatarUri !== profile?.avatar_url) {
        avatarUrl = await uploadAvatar(avatarUri, user.id);
      }
      const updates = {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || undefined,
        venmo_username: venmo.trim().replace(/^@+/, '') || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        avatar_url: avatarUrl,
      };
      await updateUserProfile(user.id, updates);
      updateProfile(updates);
      showToast({ message: 'Profile updated', type: 'success' });
      navigation.goBack();
    } catch (err: any) {
      showToast({
        message: err?.message ?? 'Could not save profile. Try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <TouchableOpacity onPress={pickAvatar} className="items-center mb-6">
            <Avatar uri={avatarUri} displayName={displayName || 'Me'} size={80} />
            <Text className="text-sm font-semibold text-accent mt-2">Change Photo</Text>
          </TouchableOpacity>

          {[
            { label: 'Display Name', value: displayName, set: setDisplayName, placeholder: 'Your name' },
            { label: 'Username', value: username, set: (v: string) => setUsername(v.toLowerCase()), placeholder: '@handle', autoCapitalize: 'none' as const },
            { label: 'Bio', value: bio, set: setBio, placeholder: 'Tell people about yourself', multiline: true },
            { label: 'City', value: city, set: setCity, placeholder: 'New York' },
            { label: 'State', value: state, set: setState, placeholder: 'NY', maxLength: 2 },
          ].map((field) => (
            <View key={field.label} className="mb-4">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.set}
                placeholder={field.placeholder}
                placeholderTextColor="#9CA3AF"
                autoCapitalize={field.autoCapitalize ?? 'words'}
                multiline={field.multiline}
                maxLength={field.maxLength}
                className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
                style={field.multiline ? { minHeight: 80, textAlignVertical: 'top' } : undefined}
              />
            </View>
          ))}

          {/* Venmo */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Venmo</Text>
            <VenmoConnectButton
              currentUsername={venmo || undefined}
              onUsernameConfirmed={setVenmo}
              onDisconnect={() => setVenmo('')}
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-accent rounded-xl py-4 items-center mt-2"
          >
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
