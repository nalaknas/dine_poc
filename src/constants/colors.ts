/* -----------------------------------------------------------------------------
 * Dine color tokens
 *
 * Source of truth: dine-design-system/project/colors_and_type.css
 *
 * The legacy `Colors` export at the bottom is preserved so existing screens
 * keep rendering. New code should reach for the editorial scales (`Gold`,
 * `Onyx`, `Neutral`), `Semantic` tokens, or `Gradients` instead.
 * --------------------------------------------------------------------------- */

// ─── Brand palette ──────────────────────────────────────────────────────────

/** Signature yellow — `Gold[400]` is the logo color (#F7B52E, warm marigold). */
export const Gold = {
  50: '#FFF7E0',
  100: '#FCEBB0',
  200: '#FADB78',
  300: '#F9C849',
  400: '#F7B52E',
  500: '#DB9C1F',
  600: '#B07C15',
  700: '#83590E',
  800: '#553A09',
} as const;

/** Warm off-black. `Onyx[900]` is the marketing / splash background. */
export const Onyx = {
  500: '#3A3A3A',
  600: '#262626',
  700: '#1C1C1C',
  800: '#141414',
  900: '#0A0A0A',
} as const;

/** Warm-biased neutrals for everyday UI. */
export const Neutral = {
  0: '#FFFFFF',
  25: '#FCFCFB',
  50: '#F8F7F5',
  100: '#F0EFEC',
  200: '#E4E2DE',
  300: '#C9C6C1',
  400: '#9B9791',
  500: '#6E6A63',
  600: '#4A4640',
  700: '#2C2A26',
  800: '#1A1815',
} as const;

/** Functional action accent (iOS blue, preserved from existing codebase). */
export const AccentBlue = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  500: '#007AFF',
  600: '#0062CC',
  700: '#0050A6',
} as const;

/** Pairs with AccentBlue in gradients. Also the Linear indigo. */
export const Indigo = {
  500: '#5856D6',
  linear: '#5E6AD2',
} as const;

// ─── Semantic (status) ──────────────────────────────────────────────────────

export const Success = { 50: '#ECFDF5', 500: '#10B981', 700: '#047857' } as const;
export const Warning = { 50: '#FFFBEB', 500: '#F59E0B', 700: '#B45309' } as const;
export const Danger = { 50: '#FEF2F2', 500: '#EF4444', 700: '#B91C1C' } as const;

// ─── Tier system (consumer earns; restaurant sees) ──────────────────────────

export const Tier = {
  rock: '#9CA3AF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  black: '#1A1A1A',
} as const;

// ─── Semantic surface tokens (light mode default) ───────────────────────────
// Reach for these in screens instead of raw hex values.

export const Semantic = {
  bgPrimary: Neutral[0],
  bgSecondary: Neutral[50],
  bgTertiary: Neutral[100],
  bgInverse: Onyx[900],
  bgBrand: Gold[400],
  /** The working-surface cream used on feed, profile, discover, etc. */
  bgCream: '#FAF8F4',

  fgPrimary: Neutral[800],
  fgSecondary: Neutral[500],
  fgTertiary: Neutral[400],
  fgInverse: Neutral[0],
  fgBrand: Gold[400],
  fgAccent: AccentBlue[500],

  borderSubtle: Neutral[100],
  borderDefault: Neutral[200],
  borderStrong: Neutral[300],

  overlayLight: 'rgba(255, 255, 255, 0.72)',
  overlayDark: 'rgba(10, 10, 10, 0.72)',
  scrim: 'rgba(10, 10, 10, 0.48)',
} as const;

// ─── Gradients (tuples for expo-linear-gradient) ────────────────────────────

/** Primary action gradient (iOS blue → indigo). */
export const GRAD_ACTION = ['#007AFF', '#5856D6'] as const;
/** High-rating badge (≥ 8.0) gold → red. */
export const GRAD_RATING = ['#F59E0B', '#EF4444'] as const;
/** Earned / premium gold gradient. */
export const GRAD_GOLD = ['#F7C857', '#E0A024'] as const;
/** Splash / marketing onyx gradient (3-stop, creates a dim spotlight). */
export const GRAD_ONYX = ['#0A0A0A', '#1A1A2E', '#0A0A0A'] as const;
/** Very subtle paper gradient for hero / profile backgrounds. */
export const GRAD_PAPER = ['#FCFCFB', '#F8F7F5'] as const;

export const Gradients = {
  action: GRAD_ACTION,
  rating: GRAD_RATING,
  gold: GRAD_GOLD,
  onyx: GRAD_ONYX,
  paper: GRAD_PAPER,
} as const;

// ─── Legacy export (do not remove — consumed across the codebase) ───────────

export const Colors = {
  light: {
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
  },
  dark: {
    background: '#111827',
    backgroundSecondary: '#1F2937',
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF',
    border: '#374151',
    borderLight: '#374151',
  },
  accent: '#007AFF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  /** Legacy amber gold. New editorial work should use `Gold[400]` (#F7B52E). */
  gold: '#F59E0B',
  red: '#EF4444',
  transparent: 'transparent',
} as const;
