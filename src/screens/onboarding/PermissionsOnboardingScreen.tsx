import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Neutral, Onyx, Semantic } from '../../constants/colors';
import { registerForPushNotifications } from '../../lib/pushNotifications';
import { useSettingsStore } from '../../stores/settingsStore';

const PERMISSIONS = [
  {
    key: 'camera',
    icon: 'camera-outline' as const,
    title: 'Camera',
    description: 'Scan receipts and take food photos.',
    required: true,
  },
  {
    key: 'photos',
    icon: 'images-outline' as const,
    title: 'Photo library',
    description: "Upload food photos you've already taken.",
    required: true,
  },
  {
    key: 'notifications',
    icon: 'notifications-outline' as const,
    title: 'Notifications',
    description: "Tell you when friends like, comment, or tag you.",
    required: false,
  },
];

/**
 * Final onboarding step — grant the permissions Dine needs to actually work,
 * then mark onboarding complete. Replaces the old ProfileSetup screen as the
 * `setHasCompletedOnboarding(true)` trigger.
 */
export function PermissionsOnboardingScreen() {
  const { setHasCompletedOnboarding } = useSettingsStore();
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const requestPermission = async (key: string) => {
    try {
      let status = 'granted';
      if (key === 'camera') {
        const result = await ImagePicker.requestCameraPermissionsAsync();
        status = result.status;
      } else if (key === 'photos') {
        const result = await MediaLibrary.requestPermissionsAsync();
        status = result.status;
      } else if (key === 'notifications') {
        const token = await registerForPushNotifications();
        status = token ? 'granted' : 'denied';
      }
      setGranted((prev) => ({ ...prev, [key]: status === 'granted' }));
    } catch {
      Alert.alert('Permission error', 'Could not request permission. Enable in Settings.');
    }
  };

  const handleFinish = () => {
    setHasCompletedOnboarding(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.headline}>A couple of grants.</Text>
        <Text style={styles.subhead}>
          Dine needs these to scan receipts, post photos, and tell you when friends show up.
        </Text>

        <View style={styles.list}>
          {PERMISSIONS.map((perm) => {
            const isGranted = !!granted[perm.key];
            return (
              <Pressable
                key={perm.key}
                onPress={() => requestPermission(perm.key)}
                style={styles.row}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={perm.icon} size={20} color={Onyx[900]} />
                </View>
                <View style={styles.meta}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{perm.title}</Text>
                    {!perm.required && (
                      <Text style={styles.optional}>· Optional</Text>
                    )}
                  </View>
                  <Text style={styles.description}>{perm.description}</Text>
                </View>
                {isGranted ? (
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Neutral[400]} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <AnimatedPressable onPress={handleFinish} style={[styles.cta, styles.ctaPrimary]}>
          <Text style={styles.ctaLabelPrimary}>Finish</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Semantic.bgCream,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  headline: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
    color: '#1A1612',
  },
  subhead: {
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#5E5C58',
  },
  list: {
    marginTop: 28,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Neutral[200],
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Onyx[900],
  },
  optional: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Neutral[400],
  },
  description: {
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Neutral[500],
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: Onyx[900],
  },
  ctaLabelPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
