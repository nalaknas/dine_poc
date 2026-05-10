import React from 'react';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { PhoneOtpFlow } from './PhoneOtpFlow';

/**
 * ENG-168: mandatory phone-verify gate. Rendered by RootNavigator as the
 * only screen when an authenticated user has no `phone_verified_at` set —
 * before Onboarding or Main mount. Replaces the dual-path approach:
 *   - ENG-147 PhoneVerifyScreen (first step of OnboardingNavigator)
 *   - ENG-148 PhoneBackfillScreen (effect-triggered modal over Main)
 *
 * On success, `setProfile` updates Zustand with the verified row; RootNavigator
 * re-renders and the gate falls through to Onboarding (new signups) or Main
 * (returning users). No in-screen navigation needed.
 *
 * Copy variant chosen by `hasCompletedOnboarding`: returning users (whose
 * accounts pre-date phone verification) see the "one last thing" framing;
 * fresh signups see "what's your number" as the first onboarding step.
 */
export function PhoneGateScreen() {
  const { setProfile } = useUserProfileStore();
  const { hasCompletedOnboarding } = useSettingsStore();

  const isBackfill = hasCompletedOnboarding;

  return (
    <PhoneOtpFlow
      headline={isBackfill ? 'One last thing.' : "What's your number?"}
      subhead={
        isBackfill
          ? "Add your number so friends can tag you in meals and split bills with you. Takes 30 seconds — we won't text you about anything else."
          : "We'll text a 6-digit code. Friends can find you and tag you in meals — we won't text you about anything else."
      }
      onSuccess={setProfile}
    />
  );
}
