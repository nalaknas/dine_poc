import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../services/user-service';
import { formatTimeAgo } from '../../utils/format';
import type { Comment, RootStackParamList } from '../../types';

type CommentsRoute = RouteProp<RootStackParamList, 'Comments'>;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CommentsScreen() {
  const { params } = useRoute<CommentsRoute>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, author:users!comments_author_id_fkey(*)')
      .eq('post_id', params.postId)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as Comment[]);
    setIsLoading(false);
  };

  const sendComment = async () => {
    if (!text.trim() || !user) return;
    setIsSending(true);
    const content = text.trim();
    setText('');
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: params.postId, author_id: user.id, content })
      .select('*, author:users!comments_author_id_fkey(*)')
      .single();
    if (!error && data) {
      setComments((prev) => [...prev, data as Comment]);
      await supabase.rpc('increment_comment_count', { post_id: params.postId });
      // Notify post author (skip self-comments)
      const { data: post } = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', params.postId)
        .single();
      if (post && post.author_id !== user.id) {
        createNotification({
          userId: post.author_id,
          type: 'comment',
          fromUserId: user.id,
          postId: params.postId,
          message: 'commented on your post',
        });
      }
    } else {
      Alert.alert('Error', 'Could not post comment.');
    }
    setIsSending(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#1F2937" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>Comments</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            renderItem={({ item }) => (
              <View className="flex-row mb-4">
                <Pressable onPress={() => navigation.navigate('UserProfile', { userId: item.author_id })}>
                  <Avatar uri={item.author?.avatar_url} displayName={item.author?.display_name ?? 'User'} size={36} />
                </Pressable>
                <View className="flex-1 ml-2 bg-background-secondary rounded-2xl rounded-tl-sm px-3 py-2">
                  <Pressable onPress={() => navigation.navigate('UserProfile', { userId: item.author_id })}>
                    <Text className="text-sm font-semibold text-text-primary">{item.author?.username}</Text>
                  </Pressable>
                  <Text className="text-sm text-text-primary mt-0.5">{item.content}</Text>
                  <Text className="text-xs text-text-secondary mt-1">{formatTimeAgo(item.created_at)}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text className="text-sm text-text-secondary text-center mt-8">No comments yet. Be first!</Text>
            }
          />
        )}

        <View className="flex-row items-center px-4 py-3 border-t border-border-light">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 mr-3 text-base text-text-primary"
            multiline
            maxLength={500}
          />
          <TouchableOpacity onPress={sendComment} disabled={!text.trim() || isSending}>
            <Ionicons name="send" size={22} color={text.trim() ? '#007AFF' : '#D1D5DB'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
