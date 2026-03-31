import React, { useEffect, useState } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../lib/pushNotifications';

const PREFERENCE_ITEMS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'likes', label: 'Likes', description: 'When someone likes your post' },
  { key: 'comments', label: 'Comments', description: 'When someone comments on your post' },
  { key: 'tags', label: 'Tags', description: 'When someone tags you in a post' },
  { key: 'follows', label: 'Follows', description: 'When someone follows you' },
  { key: 'recommendations', label: 'Recommendations', description: 'Personalized restaurant recommendations' },
];

export function NotificationPreferencesScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNotificationPreferences().then((prefs) => {
      setPreferences(prefs);
      setIsLoading(false);
    });
  }, []);

  const togglePreference = async (key: keyof NotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    await updateNotificationPreferences(updated);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background-secondary" edges={['bottom']}>
      <View className="px-4 pt-4">
        <Text className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
          Push Notifications
        </Text>
        <View className="bg-background-secondary rounded-xl overflow-hidden">
          {PREFERENCE_ITEMS.map((item, i) => (
            <View
              key={item.key}
              className={`flex-row items-center justify-between px-4 py-4 ${
                i < PREFERENCE_ITEMS.length - 1 ? 'border-b border-border-light' : ''
              }`}
            >
              <View className="flex-1 mr-4">
                <Text className="text-base text-text-primary">{item.label}</Text>
                <Text className="text-sm text-text-secondary mt-0.5">{item.description}</Text>
              </View>
              <Switch
                value={preferences[item.key]}
                onValueChange={() => togglePreference(item.key)}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                ios_backgroundColor="#767577"
              />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
