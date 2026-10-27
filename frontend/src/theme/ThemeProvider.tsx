import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { ThemeColors, ThemeColorPalette, ThemeMode } from './tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColorPalette;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: ThemeColors.dark,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const rnScheme = useRNColorScheme();
  const { setColorScheme: setNWColorScheme } = useNativeWindColorScheme();

  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return rnScheme === 'light' ? 'light' : 'dark';
  });

  // Sync DOM classes and NativeWind scheme safely inside useEffect
  useEffect(() => {
    try {
      setNWColorScheme(mode);
    } catch {
      // NativeWind sync fallback if not supported
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', mode);
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  }, [mode, setNWColorScheme]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const colors = ThemeColors[mode];
  const isDark = mode === 'dark';

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, toggleTheme, setTheme: setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
