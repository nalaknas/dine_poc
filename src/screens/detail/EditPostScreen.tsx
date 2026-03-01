import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSocialStore } from '../../stores/socialStore';
import { getPost, updatePost, deletePost } from '../../services/post-service';
import type { Post, RootStackParamList } from '../../types';

type EditRoute = RouteProp<RootStackParamList, 'EditPost'>;

export function EditPostScreen() {
  const { params } = useRoute<EditRoute>();
  const navigation = useNavigation();
  const { updatePost: updatePostStore, removePost } = useSocialStore();

  const [post, setPost] = useState<Post | null>(null);
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getPost(params.postId).then((p) => {
      if (p) {
        setPost(p);
        setCaption(p.caption);
        setIsPublic(p.is_public);
      }
    });
  }, [params.postId]);

  const handleSave = async () => {
    if (!post) return;
    setIsSaving(true);
    try {
      const updated = await updatePost(post.id, { caption, is_public: isPublic });
      updatePostStore(post.id, updated);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update post');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(params.postId);
            removePost(params.postId);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Could not delete post.');
          }
        },
      },
    ]);
  };

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text className="text-sm font-medium text-text-secondary mb-1.5">Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            multiline
            placeholder="Write a caption..."
            placeholderTextColor="#9CA3AF"
            className="bg-background-secondary border border-border rounded-xl px-4 py-3 text-base text-text-primary mb-6"
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          <Text className="text-sm font-medium text-text-secondary mb-3">Visibility</Text>
          {[
            { label: 'Public', value: true },
            { label: 'Private', value: false },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.label}
              onPress={() => setIsPublic(opt.value)}
              className={`flex-row items-center p-4 rounded-xl border mb-2 ${
                isPublic === opt.value ? 'border-accent bg-accent/5' : 'border-border bg-background-secondary'
              }`}
            >
              <Text className="text-base font-semibold text-text-primary flex-1">{opt.label}</Text>
              {isPublic === opt.value && <Text className="text-accent font-semibold">✓</Text>}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-accent rounded-xl py-4 items-center mt-4"
          >
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Save Changes</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete} className="items-center py-4 mt-2">
            <Text className="text-base font-semibold text-error">Delete Post</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
