/**
 * SaaS Authentication Screen.
 *
 * Implements the Pastel Tile UI Design System:
 * - Direct surface integration (no generic floating cards or drop shadows)
 * - Clean high-contrast typography
 * - Dark circular action buttons & pastel accent badges
 * - Native outline suppression with smooth container focus rings
 * - Instant "Continue as Guest" offline onboarding path
 */

import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Lock,
  Mail,
  User as UserIcon,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { webInputReset } from '../../core/webStyles';

export const AuthScreen: React.FC = () => {
  const { colors, isDark, toggleTheme, pastelColors } = useTheme();
  const { signIn, signUp, continueAsGuest, error, clearError } = useAuth();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  const nameRef = React.useRef<any>(null);
  const emailRef = React.useRef<any>(null);
  const passwordRef = React.useRef<any>(null);

  const isWide = width >= 768;

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setLocalError('Please enter your full name.');
        return;
      }
      if (!password || password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
    } else {
      if (!password) {
        setLocalError('Please enter your password.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn({ email, password });
      } else {
        await signUp({ name, email, password });
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuest = async () => {
    setIsSubmitting(true);
    try {
      await continueAsGuest();
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = localError || error;

  return (
    <View className="flex-1 bg-appBg">
      {/* Top Quiet Navigation Row */}
      <View className="flex-row justify-between items-center px-8 pt-6 pb-4">
        <View className="flex-row items-center gap-2.5">
          <View className="w-[30px] h-[30px] rounded-full justify-center items-center bg-pastel-apricot">
            <Sparkles size={16} color="#111111" />
          </View>
          <Text className="text-lg font-bold tracking-tight text-textPrimary">
            ScribeX
          </Text>
        </View>

        <Pressable
          onPress={toggleTheme}
          className="w-10 h-10 rounded-full justify-center items-center bg-iconBg active:opacity-80"
          accessibilityLabel="Toggle Theme"
        >
          {isDark ? (
            <Sun size={18} color={colors.iconFg} />
          ) : (
            <Moon size={18} color={colors.iconFg} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName={`grow justify-center items-center px-6 pb-12 ${isWide ? 'py-12' : ''}`}
        showsVerticalScrollIndicator={false}
      >
        <View className={`w-full ${isWide ? 'max-w-[440px]' : ''}`}>
          {/* Header Block */}
          <View className="mb-7">
            <View className="self-start px-2.5 py-1 rounded-xl mb-3.5 bg-pastel-lavender">
              <Text className="text-[#191919] text-[11px] font-bold tracking-wider uppercase">
                Cognitive Vault
              </Text>
            </View>

            <Text className="text-[32px] font-bold leading-[38px] tracking-tight mb-2.5 text-textPrimary">
              {mode === 'signin'
                ? 'Welcome back to your private memory'
                : 'Create your private ScribeX vault'}
            </Text>

            <Text className="text-sm leading-[21px] text-textSecondary">
              {mode === 'signin'
                ? 'Sign in to access your notes, knowledge graph, and cloud sync.'
                : 'Zero commingled tables. Fully isolated tenant vault powered by offline-first SQLite.'}
            </Text>
          </View>

          {/* Error Message */}
          {activeError && (
            <View className="px-3.5 py-2.5 rounded-[10px] mb-4 bg-pastel-coral">
              <Text className="text-[#191919] text-[13px] font-semibold leading-[18px]">
                {activeError}
              </Text>
            </View>
          )}

          {/* Form Fields Stack */}
          <View className="gap-3.5 mb-5">
            {mode === 'signup' && (
              <View className="gap-1.5">
                <Text className="text-xs font-semibold tracking-tight text-textSecondary">
                  Full Name
                </Text>
                <Pressable
                  onPress={() => nameRef.current?.focus()}
                  className={`flex-row items-center rounded-xl px-3 h-11 bg-surface dark:bg-surfaceRaised border ${
                    focusedField === 'name'
                      ? 'border-textPrimary border-[1.5px]'
                      : 'border-borderSubtle'
                  }`}
                >
                  <UserIcon size={16} color={colors.textMuted} className="mr-2" />
                  <TextInput
                    ref={nameRef}
                    className="flex-1 text-sm h-full text-textPrimary"
                    style={webInputReset}
                    placeholder="e.g. Alex Turing"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    selectionColor={isDark ? '#F7F7F7' : '#171717'}
                  />
                </Pressable>
              </View>
            )}

            <View className="gap-1.5">
              <Text className="text-xs font-semibold tracking-tight text-textSecondary">
                Email Address
              </Text>
              <Pressable
                onPress={() => emailRef.current?.focus()}
                className={`flex-row items-center rounded-xl px-3 h-11 bg-surface dark:bg-surfaceRaised border ${
                  focusedField === 'email'
                    ? 'border-textPrimary border-[1.5px]'
                    : 'border-borderSubtle'
                }`}
              >
                <Mail size={16} color={colors.textMuted} className="mr-2" />
                <TextInput
                  ref={emailRef}
                  className="flex-1 text-sm h-full text-textPrimary"
                  style={webInputReset}
                  placeholder="you@domain.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  selectionColor={isDark ? '#F7F7F7' : '#171717'}
                />
              </Pressable>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-semibold tracking-tight text-textSecondary">
                {mode === 'signup' ? 'Password (min. 6 characters)' : 'Password'}
              </Text>
              <Pressable
                onPress={() => passwordRef.current?.focus()}
                className={`flex-row items-center rounded-xl px-3 h-11 bg-surface dark:bg-surfaceRaised border ${
                  focusedField === 'password'
                    ? 'border-textPrimary border-[1.5px]'
                    : 'border-borderSubtle'
                }`}
              >
                <Lock size={16} color={colors.textMuted} className="mr-2" />
                <TextInput
                  ref={passwordRef}
                  className="flex-1 text-sm h-full text-textPrimary"
                  style={webInputReset}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry
                  selectionColor={isDark ? '#F7F7F7' : '#171717'}
                />
              </Pressable>
            </View>
          </View>

          {/* Primary Action Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`h-[46px] rounded-full flex-row justify-center items-center gap-2 mb-4 bg-iconBg ${
              isSubmitting ? 'opacity-85' : 'active:opacity-85'
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.iconFg} />
            ) : (
              <>
                <Text className="text-[15px] font-semibold tracking-tight text-iconFg">
                  {mode === 'signin' ? 'Sign In' : 'Create Vault'}
                </Text>
                <ArrowRight size={17} color={colors.iconFg} />
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="flex-1 h-[1px] bg-borderSubtle" />
            <Text className="text-xs font-medium text-textMuted">or</Text>
            <View className="flex-1 h-[1px] bg-borderSubtle" />
          </View>

          {/* Guest Mode Button */}
          <Pressable
            onPress={handleGuest}
            disabled={isSubmitting}
            className="h-11 rounded-full border border-borderSubtle flex-row justify-center items-center gap-2.5 mb-5 bg-surface dark:bg-surfaceRaised px-4 active:opacity-85"
          >
            <View className="w-5 h-5 rounded-full justify-center items-center bg-pastel-lime">
              <Zap size={12} color="#191919" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-textPrimary">
                Try as Guest (Instant Offline)
              </Text>
              <Text className="text-[11px] text-textMuted mt-0.5">
                No account required • Stored locally on this device
              </Text>
            </View>
          </Pressable>

          {/* Mode Switch Link */}
          <View className="flex-row justify-center items-center gap-1.5">
            <Text className="text-[13px] text-textSecondary">
              {mode === 'signin'
                ? "Don't have an account yet?"
                : 'Already have an account?'}
            </Text>
            <Pressable
              onPress={() => {
                setLocalError(null);
                clearError();
                setMode(mode === 'signin' ? 'signup' : 'signin');
              }}
            >
              <Text className="text-[13px] font-bold text-[#111111] dark:text-[#FFC96F]">
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

