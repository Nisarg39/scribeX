export const NoteColors = {
  apricot: '#FFC96F',
  coral: '#FF9277',
  lime: '#E5F28B',
  lavender: '#B18AF3',
  cyan: '#08C4E5',
  pink: '#F5A4C6',
  sky: '#8EDCEB',
} as const;

export type NoteColorToken = keyof typeof NoteColors;

export interface ThemeColorPalette {
  appBg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSubtle: string;
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
    surfaceSubtle: '#F4F6FB',
    textPrimary: '#171717',
    textSecondary: '#626262',
    textMuted: '#929292',
    borderSubtle: '#E8E8E8',
    iconBg: '#111111',
    iconFg: '#FFFFFF',
    favorite: '#FFD43B',
  },
  dark: {
    appBg: '#0C0E14',
    surface: '#141722',
    surfaceRaised: '#1A1E2E',
    surfaceSubtle: '#20263A',
    textPrimary: '#F0F2FA',
    textSecondary: '#A0A6BA',
    textMuted: '#6B7286',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    iconBg: '#FFFFFF',
    iconFg: '#111111',
    favorite: '#FFD43B',
  },
};

export type ThemeMode = 'light' | 'dark';
