import React, { useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { useAuthStore } from '../../stores/authStore';
import { getUserNotifications, markAllNotificationsRead } from '../../services/user-service';
import { formatTimeAgo } from '../../utils/format';
import type { Notification, RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NOTIFICATION_ICONS = {
  like: { name: 'heart' as const, color: '#EF4444' },
  comment: { name: 'chatbubble' as const, color: '#007AFF' },
  tag: { name: 'pricetag' as const, color: '#10B981' },
  follow: { name: 'person-add' as const, color: '#F59E0B' },
  recommendation: { name: 'star' as const, color: '#F59E0B' },
};

export function ActivityScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { notifications, setNotifications, markAllAsRead } = useNotificationsStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const notifs = await getUserNotifications(user.id);
      setNotifications(notifs);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    markAllAsRead();
    await markAllNotificationsRead(user.id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notif: Notification) => {
    if (notif.post_id) {
      navigation.navigate('MealDetail', { postId: notif.post_id });
    } else if (notif.type === 'follow') {
      navigation.navigate('UserProfile', { userId: notif.from_user_id });
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-light">
        <Text className="text-2xl font-bold text-text-primary">Activity</Text>
        {notifications.some((n) => !n.is_read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text className="text-sm font-semibold text-accent">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        renderItem={({ item }) => {
          const iconInfo = NOTIFICATION_ICONS[item.type] ?? NOTIFICATION_ICONS.like;
          return (
            <TouchableOpacity
              onPress={() => handleNotificationPress(item)}
              className={`flex-row items-center px-4 py-3 border-b border-border-light ${
                !item.is_read ? 'bg-blue-50' : 'bg-background'
              }`}
            >
              <View className="relative mr-3">
                <Avatar
                  uri={item.from_user?.avatar_url}
                  displayName={item.from_user?.display_name ?? item.from_user_id}
                  size={42}
                />
                <View
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full items-center justify-center"
                  style={{ backgroundColor: iconInfo.color }}
                >
                  <Ionicons name={iconInfo.name} size={10} color="#fff" />
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-text-primary leading-5">
                  <Text className="font-semibold">
                    {item.from_user?.display_name ?? 'Someone'}
                  </Text>{' '}
                  {item.message}
                </Text>
                <Text className="text-xs text-text-secondary mt-0.5">
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
              {!item.is_read && (
                <View className="w-2 h-2 rounded-full bg-accent ml-2" />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No notifications yet"
            description="When friends like, comment, or follow you, it'll show up here."
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
