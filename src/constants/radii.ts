/**
 * Dine corner-radius scale.
 *
 * Source of truth: dine-design-system/project/colors_and_type.css (--radius-*).
 * The 14 / 16 / pill triad is the brand identity — never square corners,
 * never `borderRadius: '50%'` on non-avatar shapes.
 */
export const Radii = {
  /** Chips, micro-badges. */
  xs: 4,
  /** Small inline controls. */
  sm: 6,
  /** Secondary buttons, small cards, panels. */
  md: 10,
  /** Primary buttons — signature radius. */
  lg: 14,
  /** Post cards — signature radius. */
  xl: 16,
  /** Onboarding icon containers, empty-state cards. */
  xxl: 20,
  /** Hero cards, large illustrated containers. */
  xxxl: 24,
  /** Avatars, tag chips, leaderboard rank badges. */
  pill: 999,
} as const;

export type Radius = keyof typeof Radii;
