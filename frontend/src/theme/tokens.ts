/**
 * ScribeX UI Design System - Tokens
 * Source of Truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md
 * Platform: Universal Expo (iOS, Android, Web)
 */

export type PastelColorKey =
  | 'apricot'
  | 'coral'
  | 'lime'
  | 'lavender'
  | 'cyan'
  | 'pink'
  | 'sky';

export interface ThemeColors {
  /** Outer page/canvas surrounding main workspace (or main canvas) */
  appBg: string;
  /** Main notes workspace / editor canvas */
  surface: string;
  /** Raised surfaces, search bar, menus, popovers */
  surfaceRaised: string;
  /** Primary headings, body content */
  textPrimary: string;
  /** Dates, supporting labels */
  textSecondary: string;
  /** Placeholder text, low-priority metadata */
  textMuted: string;
  /** Subtle dividers and borders only where needed */
  borderSubtle: string;
  /** Circular action buttons background */
  iconBg: string;
  /** Icons inside action buttons */
  iconFg: string;
  /** Star favorite highlight */
  favorite: string;
  /** Border for search/inputs */
  inputBorder: string;
}

export const lightColors: ThemeColors = {
  appBg: '#E8ECF5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  textPrimary: '#171717',
  textSecondary: '#626262',
  textMuted: '#929292',
  borderSubtle: '#E8E8E8',
  iconBg: '#111111',
  iconFg: '#FFFFFF',
  favorite: '#FFD43B',
  inputBorder: '#E0E0E0',
};

export const darkColors: ThemeColors = {
  appBg: '#242424',
  surface: '#242424',
  surfaceRaised: '#303030',
  textPrimary: '#F7F7F7',
  textSecondary: '#B5B5B5',
  textMuted: '#858585',
  borderSubtle: '#3A3A3A',
  iconBg: '#383838',
  iconFg: '#FFFFFF',
  favorite: '#FFD43B',
  inputBorder: '#424242',
};

/**
 * Shared Vivid Pastel Palette
 * CRITICAL RULE: Preserved identically across BOTH light and dark themes.
 * Pastel note tiles must NEVER be darkened or inverted in dark mode.
 */
export const pastelColors: Record<PastelColorKey, string> = {
  apricot: '#FFC96F',
  coral: '#FF9277',
  lime: '#E5F28B',
  lavender: '#B18AF3',
  cyan: '#08C4E5',
  pink: '#F5A4C6',
  sky: '#8EDCEB',
};

/**
 * High-contrast text and action tokens for rendering INSIDE pastel note tiles.
 * Note tiles always use dark text (#191919) in both light and dark modes.
 */
export const noteTileTokens = {
  textPrimary: '#191919',
  textSecondary: 'rgba(25, 25, 25, 0.70)',
  actionBg: '#111111',
  actionFg: '#FFFFFF',
  favoriteActive: '#E5A500',
  favoriteInactive: 'rgba(25, 25, 25, 0.35)',
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  noteTile: 18,
  workspaceShell: 24,
  circularAction: 22, // for 44px circular action button
  search: 12,
  popover: 14,
  pill: 9999,
} as const;

export const typography = {
  pageTitle: {
    fontSize: 46,
    fontWeight: '700' as const,
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  pageTitleMobile: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  noteBodyPreview: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  editorTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  editorBody: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  dateMetadata: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  sidebarBrand: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
};

export const shadows = {
  none: {},
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  popover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
};
