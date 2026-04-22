import type { TextStyle } from 'react-native';

/**
 * Dine typography presets.
 *
 * Source of truth: dine-design-system/project/colors_and_type.css (`.t-*`).
 * Font families are loaded via @expo-google-fonts in App.tsx (ENG-124) — these
 * names match the `Fraunces_400Regular` etc. exports from those packages.
 *
 * CSS `letter-spacing: Xem` is converted to RN points (Xem * fontSize).
 * CSS `line-height: N` (unitless) is converted to RN points (N * fontSize).
 *
 * Rule of thumb: when `fontFamily` is set to a specific weighted variant
 * (e.g. `Manrope_800ExtraBold`), don't also set `fontWeight` — the family
 * encodes the weight, and layering is a no-op or buggy on Android.
 */

/** Emotional display — brand wordmark, hero logo. */
export const Wordmark: TextStyle = {
  fontFamily: 'Manrope_800ExtraBold',
  fontSize: 64,
  lineHeight: 64,
  letterSpacing: -2.56, // -0.04em × 64
};

/** Screen-level title (Manrope, geometric sans). */
export const H1: TextStyle = {
  fontFamily: 'Manrope_800ExtraBold',
  fontSize: 40,
  lineHeight: 42,
  letterSpacing: -0.88, // -0.022em × 40
};

export const H2: TextStyle = {
  fontFamily: 'Manrope_700Bold',
  fontSize: 28,
  lineHeight: 32,
  letterSpacing: -0.42, // -0.015em × 28
};

export const H3: TextStyle = {
  fontFamily: 'Manrope_700Bold',
  fontSize: 20,
  lineHeight: 25,
  letterSpacing: -0.2, // -0.01em × 20
};

export const H4: TextStyle = {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 16,
  lineHeight: 22,
  letterSpacing: -0.08, // -0.005em × 16
};

/** Editorial moment — Fraunces serif, used for hero numbers + AI copy. */
export const Hero: TextStyle = {
  fontFamily: 'Fraunces_400Regular',
  fontSize: 32,
  lineHeight: 38,
  letterSpacing: -0.64, // -0.02em × 32
};

export const HeroSmall: TextStyle = {
  fontFamily: 'Fraunces_500Medium',
  fontSize: 22,
  lineHeight: 28,
  letterSpacing: -0.33, // -0.015em × 22
};

/** Italic variant for emphasis inside a Fraunces headline. */
export const HeroItalic: TextStyle = {
  fontFamily: 'Fraunces_400Regular_Italic',
  fontSize: 32,
  lineHeight: 38,
  letterSpacing: -0.64,
};

/** Standard UI body copy. */
export const Body: TextStyle = {
  fontFamily: 'Inter_400Regular',
  fontSize: 15,
  lineHeight: 23, // 1.5
};

export const BodySmall: TextStyle = {
  fontFamily: 'Inter_400Regular',
  fontSize: 13,
  lineHeight: 19, // 1.45
};

/** Secondary label (metadata, timestamps). */
export const Caption: TextStyle = {
  fontFamily: 'Inter_500Medium',
  fontSize: 11,
  lineHeight: 15,
  letterSpacing: 0.22, // +0.02em × 11
};

/** Eyebrow / overline — uppercase with wide tracking. Apply `textTransform: 'uppercase'` at the call site. */
export const Overline: TextStyle = {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 11,
  lineHeight: 13,
  letterSpacing: 1.32, // +0.12em × 11
};

/** Tabular numerics — receipts, prices, stats, ratings. */
export const Mono: TextStyle = {
  fontFamily: 'JetBrainsMono_500Medium',
  fontSize: 13,
  lineHeight: 18,
  letterSpacing: -0.065, // -0.005em × 13
};

export const Price: TextStyle = {
  fontFamily: 'JetBrainsMono_600SemiBold',
  fontSize: 15,
  lineHeight: 20,
  letterSpacing: -0.15,
};

/**
 * Namespaced export for ergonomic destructuring:
 *   import { Typography } from '@/constants/typography';
 *   <Text style={Typography.h2}>...</Text>
 */
export const Typography = {
  wordmark: Wordmark,
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  hero: Hero,
  heroSmall: HeroSmall,
  heroItalic: HeroItalic,
  body: Body,
  bodySmall: BodySmall,
  caption: Caption,
  overline: Overline,
  mono: Mono,
  price: Price,
} as const;
