/**
 * Design tokens — lifted verbatim from SPEC §4 (design system from the founder mockups).
 * The mockups in /design/ are the visual contract; these tokens encode it. Accessibility is a
 * floor, not a nice-to-have: WCAG AA contrast, 44px targets, reduced motion respected.
 */

export const color = {
  // Primary purple + accents
  primary: '#4C1D95',
  primaryAccent: '#6D28D9',
  primaryBright: '#7C3AED',
  primaryWash: '#F5F3FF', // soft lavender canvas (A0 welcome)

  // Semantic states
  success: '#16A34A', // Confirmed / Available / Paid
  pending: '#F59E0B', // Pending / amber
  danger: '#DC2626', // destructive + urgency ONLY

  // Surfaces
  canvas: '#FBFBFD', // near-white
  card: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
} as const;

/** Type scale (px). Plus Jakarta Sans is the closest verified match — confirm if the design file exists. */
export const fontSize = {
  hero: 30, // 28–32 range
  title: 17,
  body: 14,
  caption: 12,
} as const;

export const radius = {
  card: 14, // 12–16px rounded cards
  pill: 999,
} as const;

/** Minimum interactive target — WCAG / platform floor. Never ship a tap target below this. */
export const MIN_TAP_TARGET = 44;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
