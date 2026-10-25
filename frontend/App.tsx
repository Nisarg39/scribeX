import React from 'react';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/auth';
import { RootNavigator } from './src/navigation';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
