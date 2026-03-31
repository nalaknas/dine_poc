import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register the push token with Supabase.
 * Returns the token string on success, null if permissions denied or not a device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const token = tokenData.data;

  // Store token in Supabase via RPC
  const { error } = await supabase.rpc('update_push_token', { p_token: token });
  if (error) {
    console.error('Failed to save push token:', error.message);
  }

  // iOS requires explicit badge/sound/alert settings
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

/**
 * Clear push token from Supabase (call on sign out).
 */
export async function unregisterPushToken(): Promise<void> {
  const { error } = await supabase.rpc('clear_push_token');
  if (error) {
    console.error('Failed to clear push token:', error.message);
  }
}

export type NotificationPreferences = {
  likes: boolean;
  comments: boolean;
  tags: boolean;
  follows: boolean;
  recommendations: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  likes: true,
  comments: true,
  tags: true,
  follows: true,
  recommendations: true,
};

/**
 * Fetch notification preferences from Supabase.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_NOTIFICATION_PREFERENCES;

  const { data, error } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', user.id)
    .single();

  if (error || !data?.notification_preferences) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return data.notification_preferences as NotificationPreferences;
}

/**
 * Update notification preferences in Supabase.
 */
export async function updateNotificationPreferences(
  preferences: NotificationPreferences
): Promise<void> {
  const { error } = await supabase.rpc('update_notification_preferences', {
    p_preferences: preferences,
  });
  if (error) {
    console.error('Failed to update notification preferences:', error.message);
  }
}
