/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.ts',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme tokens referencing CSS variables (auto-switching between light and dark)
        appBg: 'rgb(var(--color-app-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceRaised: 'rgb(var(--color-surface-raised) / <alpha-value>)',
        textPrimary: 'rgb(var(--color-text-primary) / <alpha-value>)',
        textSecondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        textMuted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        borderSubtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
        iconBg: 'rgb(var(--color-icon-bg) / <alpha-value>)',
        iconFg: 'rgb(var(--color-icon-fg) / <alpha-value>)',
        favorite: 'rgb(var(--color-favorite) / <alpha-value>)',
        inputBorder: 'rgb(var(--color-input-border) / <alpha-value>)',

        // Explicit light theme palette
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
          inputBorder: '#E0E0E0',
        },

        // Explicit dark theme palette
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
          inputBorder: '#424242',
        },

        // Shared vivid pastel palette (preserved identically across light and dark modes)
        pastel: {
          apricot: '#FFC96F',
          coral: '#FF9277',
          lime: '#E5F28B',
          lavender: '#B18AF3',
          cyan: '#08C4E5',
          pink: '#F5A4C6',
          sky: '#8EDCEB',
        },

        // High-contrast tokens for rendering inside pastel note tiles
        noteTile: {
          textPrimary: '#191919',
          textSecondary: 'rgba(25, 25, 25, 0.70)',
          actionBg: '#111111',
          actionFg: '#FFFFFF',
          favoriteSurfaceActive: '#111111',
          favoriteSurfaceInactive: 'rgba(25, 25, 25, 0.08)',
          favoriteIconActive: '#FFD43B',
          favoriteIconInactive: 'rgba(25, 25, 25, 0.40)',
        },
      },
      borderRadius: {
        noteTile: '18px',
        workspaceShell: '24px',
        circularAction: '22px',
        search: '12px',
        popover: '14px',
        pill: '9999px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
