import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { PhoneOtpFlow } from './PhoneOtpFlow';

/**
 * First step of OnboardingNavigator (ENG-147). Captures + verifies a phone
 * number for the freshly-signed-up user via Supabase phone OTP. The user
 * cannot proceed past this screen; on success the verified phone is mirrored
 * into public.users and the user advances to Welcome.
 */
export function PhoneVerifyScreen() {
  const navigation = useNavigation<any>();
  const { profile, setProfile } = useUserProfileStore();

  // Set when our own verify path navigates away, so the force-quit recovery
  // effect doesn't double-fire navigation.replace on the same frame.
  const navigatedAwaySelf = useRef(false);

  // Force-quit recovery: if the user verified previously but force-killed the
  // app before completing the rest of onboarding, skip straight to Welcome.
  // hasCompletedOnboarding is still false (Permissions hasn't flipped it),
  // so they'd otherwise re-enter PhoneVerify on relaunch.
  useEffect(() => {
    if (navigatedAwaySelf.current) return;
    if (profile?.phone_verified_at) {
      navigation.replace('Welcome');
    }
  }, [profile?.phone_verified_at, navigation]);

  return (
    <PhoneOtpFlow
      headline="What's your number?"
      subhead="We'll text a 6-digit code. Friends can find you and tag you in meals — we won't text you about anything else."
      onSuccess={(updated) => {
        navigatedAwaySelf.current = true;
        setProfile(updated);
        navigation.replace('Welcome');
      }}
    />
  );
}
