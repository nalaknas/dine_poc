import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { createPlaylist } from '../../services/user-service';

export function CreatePlaylistScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { setPlaylists, playlists } = useUserProfileStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !user) {
      Alert.alert('Required', 'Please enter a playlist name.');
      return;
    }
    setIsCreating(true);
    try {
      const playlist = await createPlaylist(user.id, name.trim(), description.trim() || undefined, isPublic);
      setPlaylists([...playlists, playlist]);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create playlist');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 px-4 pt-4">
          <View className="mb-4">
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Date Night Spots, Want to Try..."
              placeholderTextColor="#9CA3AF"
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-text-secondary mb-1.5">Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What's this collection about?"
              placeholderTextColor="#9CA3AF"
              multiline
              className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>
          <View className="flex-row items-center justify-between bg-background-secondary rounded-xl p-4 mb-8">
            <View>
              <Text className="text-base font-semibold text-text-primary">Public playlist</Text>
              <Text className="text-xs text-text-secondary">Others can see and follow this list</Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: '#E5E7EB', true: '#007AFF' }} thumbColor="#fff" />
          </View>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={isCreating}
            className="bg-accent rounded-xl py-4 items-center"
          >
            {isCreating ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Create Playlist</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
