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
import { likeComment, unlikeComment, notifyTaggedParticipants } from '../../services/post-service';
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

    const rawComments = (data ?? []) as Comment[];

    // Attach is_liked for current user
    if (user && rawComments.length > 0) {
      const commentIds = rawComments.map((c) => c.id);
      const { data: liked } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds);
      const likedSet = new Set((liked ?? []).map((r: { comment_id: string }) => r.comment_id));
      setComments(rawComments.map((c) => ({ ...c, is_liked: likedSet.has(c.id) })));
    } else {
      setComments(rawComments);
    }

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
      setComments((prev) => [...prev, { ...(data as Comment), is_liked: false }]);
      await supabase.rpc('increment_comment_count', { post_id: params.postId });

      // Fetch post author once; notify them + tagged participants
      const { data: post } = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', params.postId)
        .single();

      if (post) {
        if (post.author_id !== user.id) {
          createNotification({
            userId: post.author_id,
            type: 'comment',
            fromUserId: user.id,
            postId: params.postId,
            message: 'commented on your post',
          });
        }
        // Notify tagged meal participants (skip author — already notified above)
        notifyTaggedParticipants(
          params.postId,
          user.id,
          'comment',
          'commented on a post you were part of',
        );
      }
    } else {
      Alert.alert('Error', 'Could not post comment.');
    }

    setIsSending(false);
  };

  const toggleCommentLike = async (comment: Comment) => {
    if (!user) return;

    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              is_liked: !c.is_liked,
              like_count: c.is_liked
                ? Math.max(0, (c.like_count ?? 0) - 1)
                : (c.like_count ?? 0) + 1,
            }
          : c,
      ),
    );

    try {
      if (comment.is_liked) {
        await unlikeComment(comment.id, user.id);
      } else {
        await likeComment(comment.id, user.id, comment.author_id, params.postId);
      }
    } catch {
      // Revert on error
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                is_liked: comment.is_liked,
                like_count: comment.like_count,
              }
            : c,
        ),
      );
    }
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
                <View className="flex-1 ml-2">
                  <View className="bg-background-secondary rounded-2xl rounded-tl-sm px-3 py-2">
                    <Pressable onPress={() => navigation.navigate('UserProfile', { userId: item.author_id })}>
                      <Text className="text-sm font-semibold text-text-primary">{item.author?.username}</Text>
                    </Pressable>
                    <Text className="text-sm text-text-primary mt-0.5">{item.content}</Text>
                  </View>
                  {/* Timestamp + like row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4, gap: 12 }}>
                    <Text className="text-xs text-text-secondary">{formatTimeAgo(item.created_at)}</Text>
                    <TouchableOpacity
                      onPress={() => toggleCommentLike(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={item.is_liked ? 'heart' : 'heart-outline'}
                        size={13}
                        color={item.is_liked ? '#EF4444' : '#9CA3AF'}
                      />
                      {(item.like_count ?? 0) > 0 && (
                        <Text style={{ fontSize: 11, color: item.is_liked ? '#EF4444' : '#9CA3AF', fontWeight: '600' }}>
                          {item.like_count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
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