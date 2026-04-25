import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { PhoneOtpFlow } from './PhoneOtpFlow';

/**
 * ENG-148: existing-user phone backfill modal. Presented full-screen on top
 * of Main when an authenticated user has no `phone_verified_at` set — i.e.
 * accounts that completed onboarding before ENG-147 shipped. RootNavigator
 * navigates here via effect; this screen has no dismiss affordance (no back
 * button, no swipe), so the user must complete OTP to keep using the app.
 */
export function PhoneBackfillScreen() {
  const navigation = useNavigation<any>();
  const { setProfile } = useUserProfileStore();

  return (
    <PhoneOtpFlow
      headline="One last thing."
      subhead="Add your number so friends can tag you in meals and split bills with you. Takes 30 seconds — we won't text you about anything else."
      onSuccess={(updated) => {
        setProfile(updated);
        navigation.goBack();
      }}
    />
  );
}
