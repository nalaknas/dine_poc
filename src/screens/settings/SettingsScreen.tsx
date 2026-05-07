import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useNotificationsStore } from '../../stores/notificationsStore';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { signOut } = useAuthStore();
  const { themePreference, setThemePreference, taxSplitMethod, setTaxSplitMethod, tipSplitMethod, setTipSplitMethod, defaultTipPercentage, setDefaultTipPercentage } = useSettingsStore();
  const { profile, reset: resetProfile } = useUserProfileStore();
  const { reset: resetNotifications } = useNotificationsStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          resetProfile();
          resetNotifications();
        },
      },
    ]);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-text-secondary uppercase tracking-widest px-4 mb-2">{title}</Text>
      <View className="bg-background-secondary rounded-xl overflow-hidden">{children}</View>
    </View>
  );

  const Row = ({ label, value, onPress, last = false }: { label: string; value?: string; onPress?: () => void; last?: boolean }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-4 ${!last ? 'border-b border-border-light' : ''}`}
      disabled={!onPress}
    >
      <Text className="text-base text-text-primary">{label}</Text>
      <View className="flex-row items-center">
        {value && <Text className="text-base text-text-secondary mr-2">{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background-secondary" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Section title="Appearance">
          {(['light', 'dark', 'system'] as const).map((pref, i, arr) => (
            <TouchableOpacity
              key={pref}
              onPress={() => setThemePreference(pref)}
              className={`flex-row items-center justify-between px-4 py-4 ${i < arr.length - 1 ? 'border-b border-border-light' : ''}`}
            >
              <Text className="text-base text-text-primary capitalize">{pref} Mode</Text>
              {themePreference === pref && <Ionicons name="checkmark" size={18} color="#007AFF" />}
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Bill Splitting">
          <Row label="Sent payment requests" onPress={() => (navigation as any).navigate('SplitHistory')} />
          <Row label="Tax Split" value={taxSplitMethod === 'proportional' ? 'By items' : 'Equal'} onPress={() => setTaxSplitMethod(taxSplitMethod === 'proportional' ? 'equal' : 'proportional')} />
          <Row label="Tip Split" value={tipSplitMethod === 'proportional' ? 'By items' : 'Equal'} onPress={() => setTipSplitMethod(tipSplitMethod === 'proportional' ? 'equal' : 'proportional')} last />
        </Section>

        <Section title="Notifications">
          <Row label="Notification Preferences" onPress={() => (navigation as any).navigate('NotificationPreferences')} last />
        </Section>

        <Section title="Account">
          <Row label="Edit Profile" onPress={() => (navigation as any).navigate('EditProfile')} />
          <Row label="Venmo" value={profile?.venmo_username ? `@${profile.venmo_username}` : 'Not connected'} onPress={() => (navigation as any).navigate('EditProfile')} />
          <Row label="Dining Partners" onPress={() => {}} />
          <Row label="Playlists" onPress={() => {}} last />
        </Section>

        <Section title="Legal">
          <Row label="Privacy Policy" />
          <Row label="Terms of Service" last />
        </Section>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-error/10 border border-error/30 rounded-xl py-4 items-center mt-2"
        >
          <Text className="text-base font-semibold text-error">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
