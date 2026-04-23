import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Neutral, Onyx } from '../../constants/colors';
import { AnimatedPressable } from './AnimatedPressable';

interface EmptyStateProps {
  /**
   * Editorial Fraunces glyph (e.g. `◌` `◐` `◎`) — preferred going forward.
   * If set, overrides `icon`.
   */
  glyph?: string;
  /**
   * Legacy Ionicons name. Kept for existing consumers that haven't been
   * migrated to glyphs. Rendered at a subdued tint (no more blue/indigo
   * gradient circle).
   */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Editorial empty state card — matches the design-bundle pattern:
 * white card on cream, 16px radius, hairline border, Fraunces glyph +
 * headline, max-280 body, secondary outlined CTA + optional ghost link.
 *
 * Layout: centered in its parent with generous top padding. Works whether
 * rendered as the sole content of a ScrollView (filling the screen) or as
 * a ListEmptyComponent in a FlatList.
 */
export function EmptyState({
  glyph,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        {glyph ? (
          <Text style={styles.glyph}>{glyph}</Text>
        ) : icon ? (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={36} color={Neutral[300]} />
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{description}</Text>

        {actionLabel && onAction && (
          <AnimatedPressable onPress={onAction} style={styles.primaryCta}>
            <Text style={styles.primaryCtaLabel}>{actionLabel}</Text>
          </AnimatedPressable>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <Pressable onPress={onSecondaryAction} style={styles.secondaryCta}>
            <Text style={styles.secondaryCtaLabel}>{secondaryActionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
    alignItems: 'stretch',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F1EEE7',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  glyph: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 36,
    color: '#D4CDBE',
    marginBottom: 12,
    lineHeight: 36,
  },
  iconWrap: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 22,
    letterSpacing: -0.33, // -0.015em × 22
    color: '#1A1612',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21, // 1.5
    color: '#5E5C58',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 20,
  },
  primaryCta: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Neutral[200],
  },
  primaryCtaLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Onyx[900],
  },
  secondaryCta: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryCtaLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Neutral[500],
  },
});
