/**
 * SaaS Authentication Screen.
 *
 * Implements the Pastel Tile UI Design System:
 * - Direct surface integration (no generic floating cards or drop shadows)
 * - Clean high-contrast typography
 * - Dark circular action buttons & pastel accent badges
 * - Instant "Continue as Guest" offline onboarding path
 */

import React, { useState } from 'react';
import {
  StyleSheet,
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

  const isWide = width >= 768;

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setLocalError('Please enter your name.');
      return;
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
    <View style={[styles.container, { backgroundColor: colors.appBg }]}>
      {/* Top Quiet Navigation Row */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.brandBadge,
              { backgroundColor: pastelColors.apricot },
            ]}
          >
            <Sparkles size={16} color="#111111" />
          </View>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            ScribeX
          </Text>
        </View>

        <Pressable
          onPress={toggleTheme}
          style={[styles.themeToggle, { backgroundColor: colors.iconBg }]}
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
        contentContainerStyle={[
          styles.contentContainer,
          isWide && styles.contentContainerWide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.formSurface, { maxWidth: isWide ? 460 : '100%' }]}>
          {/* Header Typography */}
          <View style={styles.headerBlock}>
            <View
              style={[
                styles.categoryPill,
                { backgroundColor: pastelColors.lavender },
              ]}
            >
              <Text style={[styles.categoryPillText, { color: '#191919' }]}>
                Cognitive Vault
              </Text>
            </View>

            <Text style={[styles.mainHeading, { color: colors.textPrimary }]}>
              {mode === 'signin'
                ? 'Welcome back to your private memory'
                : 'Create your private ScribeX vault'}
            </Text>

            <Text style={[styles.subHeading, { color: colors.textSecondary }]}>
              {mode === 'signin'
                ? 'Sign in to access your offline notes and real-time syncing across devices.'
                : 'Zero commingled tables. Fully isolated tenant vault powered by offline-first SQLite.'}
            </Text>
          </View>

          {/* Error Message */}
          {activeError && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: pastelColors.coral },
              ]}
            >
              <Text style={[styles.errorText, { color: '#191919' }]}>
                {activeError}
              </Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.fieldsStack}>
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Full Name
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <UserIcon size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="e.g. Alex Turing"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Email Address
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <Mail size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="you@domain.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Password (Optional in dev)
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Primary Action Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.iconBg,
                opacity: pressed || isSubmitting ? 0.85 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.iconFg} />
            ) : (
              <>
                <Text style={[styles.primaryButtonText, { color: colors.iconFg }]}>
                  {mode === 'signin' ? 'Sign In' : 'Create Vault'}
                </Text>
                <ArrowRight size={18} color={colors.iconFg} />
              </>
            )}
          </Pressable>

          {/* Secondary Divider / Actions */}
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]}
            />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>
              or
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]}
            />
          </View>

          {/* Guest Mode Trigger */}
          <Pressable
            onPress={handleGuest}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.guestButton,
              {
                borderColor: colors.borderSubtle,
                backgroundColor: isDark ? '#2D2D2D' : '#F6F8FC',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.guestDot,
                { backgroundColor: pastelColors.lime },
              ]}
            >
              <Zap size={13} color="#191919" />
            </View>
            <Text style={[styles.guestButtonText, { color: colors.textPrimary }]}>
              Try as Guest (Instant Offline)
            </Text>
          </Pressable>

          {/* Mode Switch Link */}
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.textSecondary }]}>
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
              <Text
                style={[
                  styles.switchLink,
                  { color: isDark ? '#FFC96F' : '#111111' },
                ]}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'web' ? 24 : 54,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  themeToggle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  contentContainerWide: {
    paddingVertical: 40,
  },
  formSurface: {
    width: '100%',
  },
  headerBlock: {
    marginBottom: 32,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  mainHeading: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldsStack: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  guestButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  guestDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
