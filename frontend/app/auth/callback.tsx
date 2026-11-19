import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context';
import { isSupabaseConfigured, supabase } from '../../src/services/supabase/supabaseClient';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';

function extractParamsFromUrl(url: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!url) return out;
  try {
    const hashIdx = url.indexOf('#');
    const qIdx = url.indexOf('?');
    if (qIdx !== -1) {
      const end = hashIdx !== -1 && hashIdx > qIdx ? hashIdx : url.length;
      new URLSearchParams(url.slice(qIdx + 1, end)).forEach((v, k) => {
        out[k] = v;
      });
    }
    if (hashIdx !== -1) {
      new URLSearchParams(url.slice(hashIdx + 1)).forEach((v, k) => {
        out[k] = v;
      });
    }
  } catch {
    // Ignore malformed URL safely
  }
  return out;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { isLoading, isDriveChecking, isCloudSyncReady, isAuthenticated } = useAuth();
  const params = useLocalSearchParams<Record<string, string>>();
  const incomingUrl = Linking.useURL();
  const handledRef = useRef(false);

  // Fallback OAuth token/code exchange in case Android Intent delivered the callback directly to Expo Router
  useEffect(() => {
    if (handledRef.current || !isSupabaseConfigured()) return;

    async function completeOAuthIfNeeded() {
      const { data: current } = await supabase.auth.getSession();
      if (current?.session?.user) return;

      const initialUrl = incomingUrl || (await Linking.getInitialURL().catch(() => null));
      const urlParams = extractParamsFromUrl(initialUrl);
      const accessToken = urlParams.access_token || (typeof params.access_token === 'string' ? params.access_token : '');
      const refreshToken = urlParams.refresh_token || (typeof params.refresh_token === 'string' ? params.refresh_token : '');
      const code = urlParams.code || (typeof params.code === 'string' ? params.code : '');

      if (!accessToken && !code) return;
      handledRef.current = true;

      try {
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch (err) {
        console.warn('[AuthCallback] Fallback OAuth exchange failed cleanly:', err);
      }
    }

    void completeOAuthIfNeeded();
  }, [incomingUrl, params.access_token, params.refresh_token, params.code]);

  useEffect(() => {
    if (isLoading || isDriveChecking) return;

    const timer = setTimeout(() => {
      if (isCloudSyncReady) {
        router.replace('/home');
      } else if (isAuthenticated) {
        router.replace('/signin');
      } else {
        router.replace('/signin');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isLoading, isDriveChecking, isCloudSyncReady, isAuthenticated, router]);

  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: isDark ? '#101115' : '#F8FAFC' }}
    >
      <ActivityIndicator size="large" color={NoteColors.cyan} />
      <Text
        className="mt-4 text-sm font-semibold"
        style={{ color: isDark ? '#E2E8F0' : '#334155' }}
      >
        Completing Google Sign-In...
      </Text>
    </View>
  );
}
