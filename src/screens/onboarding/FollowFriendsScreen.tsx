import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { OnboardingProgress } from './OnboardingProgress';
import { Gold, Neutral, Onyx, Semantic } from '../../constants/colors';
import { useUserProfileStore } from '../../stores/userProfileStore';

/**
 * Static suggested-follow fixtures. Real algorithmic suggestions are a
 * separate backend ticket — for onboarding we need something concrete to
 * get the user comfortable with the follow pattern.
 */
const SUGGESTED = [
  { id: 'fixture_julia',  handle: 'julia.eats',  name: 'Julia Chen',    bio: 'chef · eats her way thru LA',  tier: 'Black' as const,  initials: 'JC', avatarColor: '#5E6AD2' },
  { id: 'fixture_sam',    handle: 'sam.tastes',  name: 'Sam Okafor',    bio: 'natural wine · no fusion',     tier: 'Gold' as const,   initials: 'SO', avatarColor: '#B84545' },
  { id: 'fixture_priya',  handle: 'priya.r',     name: 'Priya Ramani',  bio: 'pastry cook, night shift',     tier: 'Silver' as const, initials: 'PR', avatarColor: '#4A8260' },
  { id: 'fixture_noah',   handle: 'noah.nyc',    name: 'Noah Park',     bio: 'omakase obsessed',             tier: 'Gold' as const,   initials: 'NP', avatarColor: '#C47A2A' },
];

export function FollowFriendsScreen() {
  const navigation = useNavigation<any>();
  const { setIsFollowing } = useUserProfileStore();

  // First two auto-followed to give the new user a warm feed on day one.
  const [followed, setFollowed] = useState<Set<string>>(
    new Set(SUGGESTED.slice(0, 2).map((s) => s.id)),
  );

  const toggle = (id: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      const willFollow = !next.has(id);
      if (willFollow) next.add(id);
      else next.delete(id);
      // Mirror state into the profile store so the feed / suggestions can
      // read it immediately. Fixture IDs won't round-trip to the server
      // yet — real follow-suggestion sourcing lands in a follow-up ticket.
      setIsFollowing(id, willFollow);
      return next;
    });
  };

  const handleContinue = () => {
    navigation.navigate('Permissions');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={3} total={3} />

      <View style={styles.copyBlock}>
        <Text style={styles.headline}>Follow people you trust.</Text>
        <Text style={styles.subhead}>
          Friends of friends are a good start. You can always change this.
        </Text>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {SUGGESTED.map((person) => {
          const isFollowing = followed.has(person.id);
          return (
            <View key={person.id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: person.avatarColor }]}>
                <Text style={styles.avatarInitials}>{person.initials}</Text>
              </View>

              <View style={styles.meta}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{person.name}</Text>
                  {person.tier === 'Gold' && (
                    <View style={[styles.tier, styles.tierGold]}>
                      <Text style={styles.tierLabelGold}>GOLD</Text>
                    </View>
                  )}
                  {person.tier === 'Black' && (
                    <View style={[styles.tier, styles.tierBlack]}>
                      <Text style={styles.tierLabelBlack}>BLACK</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  @{person.handle} · {person.bio}
                </Text>
              </View>

              <AnimatedPressable
                onPress={() => toggle(person.id)}
                style={[
                  styles.followButton,
                  isFollowing ? styles.followButtonActive : styles.followButtonIdle,
                ]}
              >
                <Text
                  style={[
                    styles.followLabel,
                    isFollowing ? styles.followLabelActive : styles.followLabelIdle,
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </AnimatedPressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <AnimatedPressable onPress={handleContinue} style={[styles.cta, styles.ctaPrimary]}>
          <Text style={styles.ctaLabelPrimary}>Jump in</Text>
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
  listScroll: {
    flex: 1,
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#1A1612',
  },
  tier: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  tierGold: {
    backgroundColor: Gold[400],
  },
  tierBlack: {
    backgroundColor: Onyx[900],
  },
  tierLabelGold: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Onyx[900],
    letterSpacing: 0.36,
  },
  tierLabelBlack: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.36,
  },
  handle: {
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8E8B84',
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  followButtonActive: {
    backgroundColor: Onyx[900],
    borderColor: Onyx[900],
  },
  followButtonIdle: {
    backgroundColor: 'transparent',
    borderColor: Neutral[300],
  },
  followLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  followLabelActive: {
    color: '#FFFFFF',
  },
  followLabelIdle: {
    color: Onyx[900],
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
