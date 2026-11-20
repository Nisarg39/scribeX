import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context';
import { googleDriveVaultService } from '../../src/services/drive/googleDriveVaultService';
import { isSupabaseConfigured, supabase } from '../../src/services/supabase/supabaseClient';
import { useTheme } from '../../src/theme';
import { NoteColors } from '../../src/theme/tokens';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Ignore when unavailable in non-browser runners
}

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
  const { isLoading, isDriveChecking, isCloudSyncReady, isAuthenticated, refreshDriveState } =
    useAuth();
  const params = useLocalSearchParams<Record<string, string>>();
  const incomingUrl = Linking.useURL();
  const handledRef = useRef(false);
  const [isExchanging, setIsExchanging] = useState(true);

  // Fallback OAuth token/code exchange in case Android Intent delivered the callback directly to Expo Router
  useEffect(() => {
    let active = true;

    async function completeOAuthIfNeeded() {
      if (handledRef.current || !isSupabaseConfigured()) {
        if (active) setIsExchanging(false);
        return;
      }

      try {
        const initialUrl = incomingUrl || (await Linking.getInitialURL().catch(() => null));
        const urlParams = extractParamsFromUrl(initialUrl);
        const accessToken =
          urlParams.access_token ||
          (typeof params.access_token === 'string' ? params.access_token : '');
        const refreshToken =
          urlParams.refresh_token ||
          (typeof params.refresh_token === 'string' ? params.refresh_token : '');
        const providerToken =
          urlParams.provider_token ||
          (typeof params.provider_token === 'string' ? params.provider_token : '');
        const providerRefreshToken =
          urlParams.provider_refresh_token ||
          (typeof params.provider_refresh_token === 'string' ? params.provider_refresh_token : '');
        const code = urlParams.code || (typeof params.code === 'string' ? params.code : '');

        const { data: current } = await supabase.auth.getSession();
        if (current?.session?.user) {
          if (providerToken) {
            handledRef.current = true;
            await googleDriveVaultService.syncDriveTokenFromSupabaseSession({
              ...current.session,
              provider_token: providerToken,
              ...(providerRefreshToken ? { provider_refresh_token: providerRefreshToken } : {}),
            });
            await refreshDriveState();
          }
          return;
        }

        if (!accessToken && !code) return;
        handledRef.current = true;

        let activeSession: any = null;
        if (accessToken && refreshToken) {
          const { data: setRes } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          activeSession = setRes?.session || null;
        } else if (code) {
          const { data: exchRes } = await supabase.auth.exchangeCodeForSession(code);
          activeSession = exchRes?.session || null;
        }

        if (activeSession && providerToken) {
          await googleDriveVaultService.syncDriveTokenFromSupabaseSession({
            ...activeSession,
            provider_token: providerToken,
            ...(providerRefreshToken ? { provider_refresh_token: providerRefreshToken } : {}),
          });
          await refreshDriveState();
        }
      } catch (err) {
        console.warn('[AuthCallback] Fallback OAuth exchange failed cleanly:', err);
      } finally {
        if (active) setIsExchanging(false);
      }
    }

    void completeOAuthIfNeeded();
    return () => {
      active = false;
    };
  }, [
    incomingUrl,
    params.access_token,
    params.refresh_token,
    params.provider_token,
    params.provider_refresh_token,
    params.code,
    refreshDriveState,
  ]);

  useEffect(() => {
    if (isLoading || isDriveChecking || isExchanging) return;

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
  }, [isLoading, isDriveChecking, isExchanging, isCloudSyncReady, isAuthenticated, router]);

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
