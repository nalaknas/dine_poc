import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedPressable } from './AnimatedPressable';
import { Gold, Neutral, Onyx } from '../../constants/colors';

interface RatingSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

function ratingLabel(val: number): string {
  if (val >= 9) return 'Amazing';
  if (val >= 8) return 'Excellent';
  if (val >= 7) return 'Great';
  if (val >= 6) return 'Good';
  if (val >= 5) return 'Okay';
  if (val >= 4) return 'Below avg';
  if (val >= 2) return 'Poor';
  if (val > 0) return 'Terrible';
  return 'Not rated';
}

/**
 * Editorial rating picker — 0-10 grid.
 *
 * Active cell visual:
 * - Rating ≥ 8 → gold fill (precious, earned)
 * - Rating < 8 → onyx fill
 * Inactive cells are neutral-outlined.
 */
export function RatingSlider({ value, onChange, label }: RatingSliderProps) {
  const rated = value > 0;
  const isTopRating = value >= 8;

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.valueNumber}>{rated ? value.toFixed(1) : '—'}</Text>
            {rated && (
              <Text
                style={[
                  styles.valueLabel,
                  isTopRating && styles.valueLabelTop,
                ]}
              >
                {ratingLabel(value)}
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
          const active = value === v;
          const top = v >= 8;
          return (
            <AnimatedPressable
              key={v}
              scaleValue={0.9}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(v);
              }}
              style={[
                styles.cell,
                active
                  ? top
                    ? styles.cellActiveTop
                    : styles.cellActive
                  : styles.cellInactive,
              ]}
            >
              <Text
                style={[
                  styles.cellLabel,
                  active
                    ? top
                      ? styles.cellLabelTop
                      : styles.cellLabelActive
                    : styles.cellLabelInactive,
                ]}
              >
                {v}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Onyx[900],
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  valueNumber: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    color: Onyx[900],
  },
  valueLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Neutral[500],
  },
  valueLabelTop: {
    color: Gold[600],
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    backgroundColor: Onyx[900],
  },
  cellActiveTop: {
    backgroundColor: Gold[400],
  },
  cellInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Neutral[200],
  },
  cellLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
  },
  cellLabelActive: {
    color: '#FFFFFF',
  },
  cellLabelTop: {
    color: Onyx[900],
  },
  cellLabelInactive: {
    color: Neutral[500],
  },
});
