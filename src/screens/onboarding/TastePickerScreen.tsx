import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { OnboardingProgress } from './OnboardingProgress';
import { Neutral, Onyx, Semantic } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { updateUserProfile } from '../../services/auth-service';

const FLAVORS = [
  'Briny', 'High-acid', 'Fermented', 'Charred',
  'Spicy', 'Umami-rich', 'Herbaceous', 'Smoky',
  'Sweet', 'Bitter', 'Funky', 'Creamy',
] as const;

const MIN_SELECTIONS = 3;

export function TastePickerScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { setProfile } = useUserProfileStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (flavor: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(flavor)) next.delete(flavor);
      else next.add(flavor);
      return next;
    });
  };

  const canContinue = selected.size >= MIN_SELECTIONS;

  const handleContinue = async () => {
    if (!canContinue || !user) return;
    setIsSaving(true);
    try {
      // Flavors are stored on the user row's `cuisine_preferences` for now —
      // dedicated `flavor_preferences` column is a small follow-up migration.
      // The local profile reflects selections immediately so Discover's
      // warming-up gate reads them on the next paint.
      const updated = await updateUserProfile(user.id, {
        cuisine_preferences: Array.from(selected),
      });
      setProfile(updated);
    } catch {
      // Onboarding isn't worth blocking on a server hiccup — state is in
      // memory and the user can resave via Edit Profile later.
    } finally {
      setIsSaving(false);
      navigation.navigate('FollowFriends');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={2} total={3} />

      <View style={styles.copyBlock}>
        <Text style={styles.headline}>What do you taste for?</Text>
        <Text style={styles.subhead}>
          Pick at least {MIN_SELECTIONS}. This teaches our engine what to bring you.
        </Text>
      </View>

      <ScrollView
        style={styles.chipScroll}
        contentContainerStyle={styles.chipWrap}
        showsVerticalScrollIndicator={false}
      >
        {FLAVORS.map((flavor) => {
          const on = selected.has(flavor);
          return (
            <Pressable
              key={flavor}
              onPress={() => toggle(flavor)}
              style={[styles.chip, on ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipLabel, on ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {on ? '✓ ' : ''}{flavor}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.counter}>
          {selected.size} selected
          {selected.size < MIN_SELECTIONS && ` · pick ${MIN_SELECTIONS - selected.size} more`}
        </Text>

        <AnimatedPressable
          onPress={handleContinue}
          disabled={!canContinue || isSaving}
          style={[
            styles.cta,
            canContinue ? styles.ctaPrimary : styles.ctaDisabled,
          ]}
        >
          <Text style={[
            styles.ctaLabel,
            canContinue ? styles.ctaLabelPrimary : styles.ctaLabelDisabled,
          ]}>
            {isSaving ? 'Saving…' : 'Continue'}
          </Text>
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
  copyBlock: {
    paddingHorizontal: 20,
    paddingTop: 24,
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
  chipScroll: {
    flex: 1,
    marginTop: 28,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: Neutral[200],
  },
  chipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  chipLabelInactive: {
    color: '#1A1612',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  counter: {
    marginBottom: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Neutral[500],
    textAlign: 'center',
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
  ctaDisabled: {
    backgroundColor: Neutral[100],
  },
  ctaLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  ctaLabelPrimary: {
    color: '#FFFFFF',
  },
  ctaLabelDisabled: {
    color: Neutral[400],
  },
});
