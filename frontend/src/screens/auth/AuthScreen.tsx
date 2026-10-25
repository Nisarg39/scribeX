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
          style={({ pressed }) => [
            styles.themeToggle,
            {
              backgroundColor: colors.iconBg,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
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
        <View style={[styles.formSurface, { maxWidth: isWide ? 440 : '100%' }]}>
          {/* Header Block */}
          <View style={styles.headerBlock}>
            <View
              style={[
                styles.categoryPill,
                { backgroundColor: pastelColors.lavender },
              ]}
            >
              <Text style={styles.categoryPillText}>Cognitive Vault</Text>
            </View>

            <Text style={[styles.mainHeading, { color: colors.textPrimary }]}>
              {mode === 'signin'
                ? 'Welcome back to your private memory'
                : 'Create your private ScribeX vault'}
            </Text>

            <Text style={[styles.subHeading, { color: colors.textSecondary }]}>
              {mode === 'signin'
                ? 'Sign in to access your notes, knowledge graph, and cloud sync.'
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
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          {/* Form Fields Stack */}
          <View style={styles.fieldsStack}>
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Full Name
                </Text>
                <Pressable
                  onPress={() => nameRef.current?.focus()}
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                      borderColor:
                        focusedField === 'name'
                          ? isDark
                            ? '#F7F7F7'
                            : '#171717'
                          : colors.borderSubtle,
                      borderWidth: focusedField === 'name' ? 1.5 : 1,
                    },
                  ]}
                >
                  <UserIcon size={16} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    ref={nameRef}
                    style={[
                      styles.input,
                      { color: colors.textPrimary },
                      webInputReset,
                    ]}
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

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Email Address
              </Text>
              <Pressable
                onPress={() => emailRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                    borderColor:
                      focusedField === 'email'
                        ? isDark
                          ? '#F7F7F7'
                          : '#171717'
                        : colors.borderSubtle,
                    borderWidth: focusedField === 'email' ? 1.5 : 1,
                  },
                ]}
              >
                <Mail size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={emailRef}
                  style={[
                    styles.input,
                    { color: colors.textPrimary },
                    webInputReset,
                  ]}
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

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {mode === 'signup' ? 'Password (min. 6 characters)' : 'Password'}
              </Text>
              <Pressable
                onPress={() => passwordRef.current?.focus()}
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                    borderColor:
                      focusedField === 'password'
                        ? isDark
                          ? '#F7F7F7'
                          : '#171717'
                        : colors.borderSubtle,
                    borderWidth: focusedField === 'password' ? 1.5 : 1,
                  },
                ]}
              >
                <Lock size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    { color: colors.textPrimary },
                    webInputReset,
                  ]}
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
                <ArrowRight size={17} color={colors.iconFg} />
              </>
            )}
          </Pressable>

          {/* Divider */}
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

          {/* Guest Mode Button */}
          <Pressable
            onPress={handleGuest}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.guestButton,
              {
                borderColor: colors.borderSubtle,
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.guestDot,
                { backgroundColor: pastelColors.lime },
              ]}
            >
              <Zap size={12} color="#191919" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guestButtonText, { color: colors.textPrimary }]}>
                Try as Guest (Instant Offline)
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                No account required • Stored locally on this device
              </Text>
            </View>
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
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'web' ? 24 : 54,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  contentContainerWide: {
    paddingVertical: 48,
  },
  formSurface: {
    width: '100%',
  },
  headerBlock: {
    marginBottom: 28,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  categoryPillText: {
    color: '#191919',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 18,
  },
  errorText: {
    color: '#191919',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldsStack: {
    gap: 14,
    marginBottom: 22,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  primaryButton: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  guestButton: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginBottom: 22,
  },
  guestDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  switchText: {
    fontSize: 13,
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});
