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
  const { colorScheme: nwScheme, setColorScheme: setNWColorScheme } = useNativeWindColorScheme();

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return rnScheme === 'light' ? 'light' : 'dark';
  });

  const applyTheme = (targetMode: ThemeMode) => {
    setModeState(targetMode);
    try {
      setNWColorScheme(targetMode);
    } catch {
      // NativeWind sync fallback if not supported
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', targetMode);
      if (targetMode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  };

  useEffect(() => {
    applyTheme(mode);
  }, []);

  const toggleTheme = () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    applyTheme(nextMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    applyTheme(newMode);
  };

  const colors = ThemeColors[mode];
  const isDark = mode === 'dark';

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
