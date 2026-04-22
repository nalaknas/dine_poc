import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Neutral, Onyx } from '../../constants/colors';

interface OnboardingProgressProps {
  /** 1-based current step. */
  step: number;
  /** Total number of steps in the flow. */
  total: number;
}

/**
 * Editorial N-segment progress indicator used across onboarding screens.
 * Filled segments = completed or current, empty segments = upcoming.
 */
export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => i + 1).map((i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i <= step ? styles.segmentActive : styles.segmentInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: Onyx[900],
  },
  segmentInactive: {
    backgroundColor: Neutral[200],
  },
});
