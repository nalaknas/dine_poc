import React, { useEffect, useCallback } from 'react';
import {
  View, Text, SectionList, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ActivitySkeleton } from '../../components/ui/Skeleton';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Shadows } from '../../constants/shadows';
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

function groupNotifications(notifications: Notification[]) {
  const now = Date.now();
  const today: Notification[] = [];
  const thisWeek: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of notifications) {
    const age = now - new Date(n.created_at).getTime();
    if (age < 86400000) today.push(n);
    else if (age < 604800000) thisWeek.push(n);
    else earlier.push(n);
  }

  const sections: { title: string; data: Notification[] }[] = [];
  if (today.length) sections.push({ title: 'Today', data: today });
  if (thisWeek.length) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length) sections.push({ title: 'Earlier', data: earlier });
  return sections;
}

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }, Shadows.header]}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937' }}>Activity</Text>
        </View>
        <ActivitySkeleton />
      </SafeAreaView>
    );
  }

  const sections = groupNotifications(notifications);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }, Shadows.header]}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1F2937' }}>Activity</Text>
        {notifications.some((n) => !n.is_read) && (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const iconInfo = NOTIFICATION_ICONS[item.type] ?? NOTIFICATION_ICONS.like;
          const isUnread = !item.is_read;
          return (
            <AnimatedPressable
              onPress={() => handleNotificationPress(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginHorizontal: 12,
                marginBottom: 4,
                borderRadius: 12,
                backgroundColor: isUnread ? 'rgba(0,122,255,0.04)' : '#FFFFFF',
                borderLeftWidth: isUnread ? 3 : 0,
                borderLeftColor: '#007AFF',
              }}
            >
              <Pressable
                style={{ position: 'relative', marginRight: 12 }}
                onPress={(e) => { e.stopPropagation(); navigation.navigate('UserProfile', { userId: item.from_user_id }); }}
              >
                <Avatar
                  uri={item.from_user?.avatar_url}
                  displayName={item.from_user?.display_name ?? item.from_user_id}
                  size={42}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: iconInfo.color,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                  }}
                >
                  <Ionicons name={iconInfo.name} size={10} color="#fff" />
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>
                  <Text
                    style={{ fontWeight: '600' }}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.from_user_id })}
                  >
                    {item.from_user?.display_name ?? 'Someone'}
                  </Text>{' '}
                  {item.message}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
              {isUnread && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF', marginLeft: 8 }} />
              )}
            </AnimatedPressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No notifications yet"
            description="When friends like, comment, or follow you, it'll show up here."
          />
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}
