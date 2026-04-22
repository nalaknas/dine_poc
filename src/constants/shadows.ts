import type { ViewStyle } from 'react-native';

export type ShadowPreset = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

/**
 * Dine elevation system — 5 steps + two colored glows.
 *
 * Source of truth: dine-design-system/project/colors_and_type.css (--shadow-*).
 * Web rgba(10,10,10,X) maps to RN shadowColor='#000' + shadowOpacity=X, which
 * renders identically on iOS.
 */
export const Shadows: Record<string, ShadowPreset> = {
  /** Subtle item lift — avatars, chips. */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  /** Post cards, primary buttons. The house default. */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  /** Post card hover/press (web parity; used on Pressable active state). */
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
  },
  /** Modals, overlays, sheets. */
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  /** Sticky top bars. */
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  /** Bottom tab bar — shadow points upward. */
  tab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  /** Alias for back-compat with existing `Shadows.tabBar` consumers. */
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  /** Floating primary action button (blue glow, iOS feel). */
  glowBlue: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Earned / premium gold glow — AI moments, tier badges. */
  glowGold: {
    shadowColor: '#F7B52E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};

/** Colored glow for an arbitrary accent — pass any hex. */
export function glowShadow(color: string): ShadowPreset {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  };
}
