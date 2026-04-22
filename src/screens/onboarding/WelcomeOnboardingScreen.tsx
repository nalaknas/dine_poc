import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { Neutral, Onyx, Semantic } from '../../constants/colors';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Editorial Welcome — the first screen a brand-new account sees after sign-in.
 * Replaces the old 4-slide carousel with a single-screen Criterion-esque intro.
 */
export function WelcomeOnboardingScreen() {
  const navigation = useNavigation<any>();
  const { setHasCompletedOnboarding } = useSettingsStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.copyBlock}>
          <Text style={styles.wordmark}>dine</Text>

          <Text style={styles.headline}>
            Where your friends eat — and where you'll eat next.
          </Text>

          <Text style={styles.subhead}>
            Follow the people whose taste you trust. Split the check in one tap.
            Let our taste engine find your next favorite spot.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AnimatedPressable
          onPress={() => navigation.navigate('TastePicker')}
          style={[styles.cta, styles.ctaPrimary]}
        >
          <Text style={styles.ctaLabelPrimary}>Get started</Text>
        </AnimatedPressable>

        <Pressable
          onPress={() => {
            // Escape hatch for returning users whose device somehow lost the
            // "onboarding complete" flag (fresh install, AsyncStorage wipe,
            // etc.) and got pulled into onboarding. Flip the flag → the
            // RootNavigator drops the Onboarding stack and lands on Main.
            setHasCompletedOnboarding(true);
          }}
          style={styles.ghostCta}
        >
          <Text style={styles.ghostCtaLabel}>I already have an account</Text>
        </Pressable>
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
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  copyBlock: {
    maxWidth: 520,
  },
  wordmark: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 64,
    lineHeight: 64 * 0.95,
    letterSpacing: -2.56, // -0.04em × 64
    color: Onyx[900],
  },
  headline: {
    marginTop: 32,
    fontFamily: 'Fraunces_400Regular',
    fontSize: 32,
    lineHeight: 38, // 1.2
    letterSpacing: -0.64, // -0.02em × 32
    color: '#1A1612',
  },
  subhead: {
    marginTop: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23, // 1.55
    color: '#5E5C58',
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 8,
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
  ghostCta: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostCtaLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Neutral[500],
  },
});
