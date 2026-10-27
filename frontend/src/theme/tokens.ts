/**
 * ScribeX Design System Tokens
 * Source of truth: docs/ScribeX-Pastel-Tile-UI-Design-System.md
 */

export const NoteColors = {
  apricot: '#FFC96F',
  coral: '#FF9277',
  lime: '#E5F28B',
  lavender: '#B18AF3',
  cyan: '#08C4E5',
  pink: '#F5A4C6',
  sky: '#8EDCEB',
  darkText: '#191919', // Dark legible text for pastel tiles in both themes
} as const;

export type NoteColorToken = keyof typeof NoteColors;

export interface ThemeColorPalette {
  appBg: string;
  surface: string;
  surfaceRaised: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  iconBg: string;
  iconFg: string;
  favorite: string;
}

export const ThemeColors: Record<'light' | 'dark', ThemeColorPalette> = {
  light: {
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
  },
  dark: {
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
  },
};

export type ThemeMode = 'light' | 'dark';
