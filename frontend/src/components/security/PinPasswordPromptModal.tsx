import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { NoteColors } from '../../theme/tokens';
import { CredentialKind, LockType } from '../../db/types';
import {
  securityRateLimiter,
  validateCredentialFormat,
} from '../../core/security/pinCrypto';

export type ActiveSecurityModalRequest =
  | {
      id: number;
      kind: 'verify';
      title: string;
      subtitle?: string;
      stepLabel?: string;
      lockType: LockType;
      credentialKind?: CredentialKind | null;
      hint?: string | null;
      rateLimitKey: string;
      confirmLabel?: string;
      verifyCandidate: (secret: string) => boolean;
      resolve: (ok: boolean) => void;
    }
  | {
      id: number;
      kind: 'configure_lock';
      targetLabel: string;
      entityType: 'note' | 'folder' | 'batch_notes';
      hasMasterConfigured: boolean;
      masterCredentialType?: CredentialKind | null;
      initialLockType?: LockType;
      initialHint?: string | null;
      resolve: (
        result: {
          lockType: LockType;
          credentialKind?: CredentialKind;
          secret?: string;
          hint?: string | null;
          newMasterSetup?: {
            secret: string;
            credentialKind: CredentialKind;
            hint?: string | null;
          };
        } | null
      ) => void;
    }
  | {
      id: number;
      kind: 'setup_master';
      mode: 'create' | 'change';
      initialCredentialKind?: CredentialKind;
      initialHint?: string | null;
      resolve: (
        result: {
          secret: string;
          credentialKind: CredentialKind;
          hint: string | null;
        } | null
      ) => void;
    };

interface PinPasswordPromptModalProps {
  request: ActiveSecurityModalRequest | null;
}

export const PinPasswordPromptModal: React.FC<PinPasswordPromptModalProps> = ({ request }) => {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [secret, setSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [hintInput, setHintInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedLockType, setSelectedLockType] = useState<LockType>('master');
  const [selectedCredKind, setSelectedCredKind] = useState<CredentialKind>('pin');
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);

  // Reset form state whenever a new request arrives
  useEffect(() => {
    if (!request) {
      setSecret('');
      setConfirmSecret('');
      setHintInput('');
      setShowSecret(false);
      setShowHint(false);
      setErrorText(null);
      setLockoutRemainingMs(0);
      return;
    }

    setSecret('');
    setConfirmSecret('');
    setShowSecret(false);
    setShowHint(false);
    setErrorText(null);

    if (request.kind === 'verify') {
      setSelectedCredKind(request.credentialKind || 'pin');
      setLockoutRemainingMs(securityRateLimiter.getLockoutRemainingMs(request.rateLimitKey));
    } else if (request.kind === 'configure_lock') {
      setSelectedLockType(
        request.initialLockType || (request.hasMasterConfigured ? 'master' : 'custom')
      );
      setSelectedCredKind('pin');
      setHintInput(request.initialHint || '');
      setLockoutRemainingMs(0);
    } else if (request.kind === 'setup_master') {
      setSelectedCredKind(request.initialCredentialKind || 'pin');
      setHintInput(request.initialHint || '');
      setLockoutRemainingMs(0);
    }

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [request]);

  // Live 1s countdown during rate-limit cooldown
  useEffect(() => {
    if (!request || request.kind !== 'verify' || lockoutRemainingMs <= 0) return;

    const timer = setInterval(() => {
      const remaining = securityRateLimiter.getLockoutRemainingMs(request.rateLimitKey);
      setLockoutRemainingMs(remaining);
      if (remaining <= 0) {
        setErrorText(null);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [request, lockoutRemainingMs]);

  if (!request) return null;

  const handleCancel = () => {
    if (request.kind === 'verify') {
      request.resolve(false);
    } else {
      request.resolve(null);
    }
  };

  const handleVerifySubmit = () => {
    if (request.kind !== 'verify') return;
    const remaining = securityRateLimiter.getLockoutRemainingMs(request.rateLimitKey);
    if (remaining > 0) {
      setLockoutRemainingMs(remaining);
      setErrorText(`Too many failed attempts. Wait ${Math.ceil(remaining / 1000)}s.`);
      return;
    }

    if (!secret.trim()) {
      setErrorText('Please enter your PIN or Password.');
      return;
    }

    const ok = request.verifyCandidate(secret);
    if (ok) {
      securityRateLimiter.recordSuccess(request.rateLimitKey);
      request.resolve(true);
      return;
    }

    const failure = securityRateLimiter.recordFailure(request.rateLimitKey);
    const remainingAttempts = securityRateLimiter.getRemainingAttempts(request.rateLimitKey);
    setSecret('');
    if (failure.lockedOut) {
      setLockoutRemainingMs(failure.remainingMs);
      setErrorText(
        `Too many failed attempts. Locked for ${Math.ceil(failure.remainingMs / 1000)}s.`
      );
    } else {
      setErrorText(
        `Incorrect credential. ${remainingAttempts} attempt${
          remainingAttempts === 1 ? '' : 's'
        } left.`
      );
    }
  };

  const handleConfigureSubmit = () => {
    if (request.kind !== 'configure_lock') return;

    if (selectedLockType === 'master' && request.hasMasterConfigured) {
      request.resolve({
        lockType: 'master',
        hint: hintInput.trim() || null,
      });
      return;
    }

    // Either Custom credential OR inline Master credential setup when none configured yet
    const validation = validateCredentialFormat(secret, selectedCredKind);
    if (!validation.valid) {
      setErrorText(validation.error || 'Invalid credential format.');
      return;
    }

    if (secret !== confirmSecret) {
      setErrorText('Entries do not match. Please re-enter to confirm.');
      return;
    }

    if (selectedLockType === 'master' && !request.hasMasterConfigured) {
      request.resolve({
        lockType: 'master',
        hint: hintInput.trim() || null,
        newMasterSetup: {
          secret,
          credentialKind: selectedCredKind,
          hint: hintInput.trim() || null,
        },
      });
      return;
    }

    request.resolve({
      lockType: 'custom',
      credentialKind: selectedCredKind,
      secret,
      hint: hintInput.trim() || null,
    });
  };

  const handleMasterSetupSubmit = () => {
    if (request.kind !== 'setup_master') return;

    const validation = validateCredentialFormat(secret, selectedCredKind);
    if (!validation.valid) {
      setErrorText(validation.error || 'Invalid credential format.');
      return;
    }

    if (secret !== confirmSecret) {
      setErrorText('Entries do not match. Please confirm your Master credential.');
      return;
    }

    request.resolve({
      secret,
      credentialKind: selectedCredKind,
      hint: hintInput.trim() || null,
    });
  };

  const needsSecretInputs =
    request.kind === 'setup_master' ||
    (request.kind === 'configure_lock' &&
      (selectedLockType === 'custom' || !request.hasMasterConfigured));

  const cooldownSeconds = Math.ceil(lockoutRemainingMs / 1000);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/60 justify-center items-center px-5"
      >
        <View
          className="w-full max-w-[440px] rounded-3xl border overflow-hidden shadow-2xl"
          style={{
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.borderSubtle,
          }}
        >
          {/* Accent top strip */}
          <View
            className="h-1.5 w-full"
            style={{
              backgroundColor:
                request.kind === 'verify' && request.lockType === 'custom'
                  ? NoteColors.lavender
                  : NoteColors.cyan,
            }}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 22 }}
          >
            {/* Header Row */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-row items-center gap-3 flex-1 pr-3">
                <View
                  className="w-11 h-11 rounded-2xl items-center justify-center"
                  style={{
                    backgroundColor: isDark ? 'rgba(177, 138, 243, 0.16)' : '#F2ECFE',
                  }}
                >
                  {request.kind === 'verify' ? (
                    <Lock size={20} color={NoteColors.lavender} />
                  ) : (
                    <ShieldCheck size={20} color={NoteColors.cyan} />
                  )}
                </View>

                <View className="flex-1">
                  {request.kind === 'verify' && request.stepLabel ? (
                    <Text
                      className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                      style={{ color: NoteColors.lavender }}
                    >
                      {request.stepLabel}
                    </Text>
                  ) : null}

                  <Text
                    className="text-[18px] font-extrabold tracking-tight"
                    style={{ color: colors.textPrimary }}
                  >
                    {request.kind === 'verify'
                      ? request.title
                      : request.kind === 'configure_lock'
                      ? `Lock ${request.entityType === 'folder' ? 'Folder' : request.entityType === 'batch_notes' ? 'Selected Notes' : 'Note'}`
                      : request.mode === 'change'
                      ? 'Change Master Credential'
                      : 'Set Up Master Credential'}
                  </Text>

                  <Text className="text-[12.5px] mt-0.5" style={{ color: colors.textSecondary }}>
                    {request.kind === 'verify'
                      ? request.subtitle ||
                        (request.lockType === 'custom'
                          ? 'Requires this item’s own Custom PIN or Password.'
                          : 'Enter your Workspace Master PIN or Password.')
                      : request.kind === 'configure_lock'
                      ? request.targetLabel
                      : 'Protects app startup and serves as your quick-lock credential.'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleCancel}
                hitSlop={8}
                accessibilityLabel="Close Security Modal"
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: isDark ? '#383838' : '#F2F4F8' }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* VERIFY MODE */}
            {request.kind === 'verify' && (
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <View
                    className="px-2.5 py-1 rounded-full border"
                    style={{
                      backgroundColor:
                        request.lockType === 'custom'
                          ? 'rgba(177, 138, 243, 0.12)'
                          : 'rgba(8, 196, 229, 0.12)',
                      borderColor:
                        request.lockType === 'custom'
                          ? 'rgba(177, 138, 243, 0.4)'
                          : 'rgba(8, 196, 229, 0.4)',
                    }}
                  >
                    <Text
                      className="text-[11px] font-bold"
                      style={{
                        color:
                          request.lockType === 'custom'
                            ? NoteColors.lavender
                            : NoteColors.cyan,
                      }}
                    >
                      {request.lockType === 'custom'
                        ? 'Custom Credential Required (No Master Bypass)'
                        : 'Master Credential'}
                    </Text>
                  </View>

                  {!request.credentialKind && (
                    <Pressable
                      onPress={() =>
                        setSelectedCredKind((k) => (k === 'pin' ? 'password' : 'pin'))
                      }
                      hitSlop={8}
                      className="px-2.5 py-1 rounded-full active:opacity-70"
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: colors.textMuted }}>
                        Use {selectedCredKind === 'pin' ? 'Full Keyboard' : 'PIN Pad'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <View
                  className="flex-row items-center rounded-2xl border px-3.5 h-12 mt-1"
                  style={{
                    backgroundColor: isDark ? '#242424' : '#F8FAFC',
                    borderColor: errorText ? NoteColors.coral : colors.borderSubtle,
                  }}
                >
                  <KeyRound size={16} color={colors.textMuted} />
                  <TextInput
                    ref={inputRef}
                    value={secret}
                    onChangeText={(txt) => {
                      setSecret(txt);
                      if (errorText && lockoutRemainingMs <= 0) setErrorText(null);
                    }}
                    placeholder={
                      selectedCredKind === 'pin'
                        ? 'Enter 4–6 digit PIN'
                        : 'Enter password'
                    }
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showSecret}
                    keyboardType={selectedCredKind === 'pin' ? 'number-pad' : 'default'}
                    maxLength={selectedCredKind === 'pin' ? 6 : 64}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={lockoutRemainingMs <= 0}
                    onSubmitEditing={handleVerifySubmit}
                    className="flex-1 mx-2.5 text-[15px] font-semibold outline-none"
                    style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                  />
                  <Pressable
                    onPress={() => setShowSecret((prev) => !prev)}
                    hitSlop={8}
                    accessibilityLabel={showSecret ? 'Hide credential' : 'Show credential'}
                    className="w-8 h-8 items-center justify-center active:opacity-70"
                  >
                    {showSecret ? (
                      <EyeOff size={17} color={colors.textMuted} />
                    ) : (
                      <Eye size={17} color={colors.textMuted} />
                    )}
                  </Pressable>
                </View>

                {request.hint ? (
                  <View className="mt-2.5">
                    <Pressable
                      onPress={() => setShowHint((prev) => !prev)}
                      hitSlop={8}
                      className="flex-row items-center gap-1.5 self-start py-1 active:opacity-70"
                    >
                      <HelpCircle size={14} color={NoteColors.cyan} />
                      <Text className="text-[12px] font-semibold" style={{ color: NoteColors.cyan }}>
                        {showHint ? 'Hide Hint' : 'Show Password/PIN Hint'}
                      </Text>
                    </Pressable>
                    {showHint ? (
                      <View
                        className="mt-1 px-3 py-2 rounded-xl border"
                        style={{
                          backgroundColor: isDark ? '#252830' : '#F0F9FF',
                          borderColor: colors.borderSubtle,
                        }}
                      >
                        <Text className="text-[12.5px]" style={{ color: colors.textSecondary }}>
                          Hint: {request.hint}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {errorText || lockoutRemainingMs > 0 ? (
                  <View className="flex-row items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-red-500/10">
                    <AlertTriangle size={15} color={NoteColors.coral} />
                    <Text className="text-[12.5px] font-semibold flex-1" style={{ color: NoteColors.coral }}>
                      {lockoutRemainingMs > 0
                        ? `Too many failed attempts. Try again in ${cooldownSeconds}s.`
                        : errorText}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-end gap-2.5 mt-5">
                  <Pressable
                    onPress={handleCancel}
                    className="px-4 py-2.5 rounded-full active:opacity-75"
                    style={{ backgroundColor: isDark ? '#383838' : '#EEF1F6' }}
                  >
                    <Text className="text-[13.5px] font-bold" style={{ color: colors.textSecondary }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleVerifySubmit}
                    disabled={lockoutRemainingMs > 0}
                    className="px-5 py-2.5 rounded-full active:opacity-80"
                    style={{
                      backgroundColor:
                        lockoutRemainingMs > 0 ? colors.borderSubtle : NoteColors.lavender,
                      opacity: lockoutRemainingMs > 0 ? 0.6 : 1,
                    }}
                  >
                    <Text className="text-[13.5px] font-extrabold text-[#171717]">
                      {request.confirmLabel || 'Unlock'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* CONFIGURE LOCK MODE (Note / Folder / Batch) */}
            {request.kind === 'configure_lock' && (
              <View>
                <Text
                  className="text-[12px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.textMuted }}
                >
                  Choose Lock Protection
                </Text>

                <View className="flex-row gap-2.5 mb-4">
                  <Pressable
                    onPress={() => {
                      setSelectedLockType('master');
                      setErrorText(null);
                    }}
                    className="flex-1 p-3 rounded-2xl border active:opacity-80"
                    style={{
                      backgroundColor:
                        selectedLockType === 'master'
                          ? isDark
                            ? 'rgba(8, 196, 229, 0.14)'
                            : '#ECFEFF'
                          : isDark
                          ? '#242424'
                          : '#F8FAFC',
                      borderColor:
                        selectedLockType === 'master' ? NoteColors.cyan : colors.borderSubtle,
                    }}
                  >
                    <Text className="text-[13.5px] font-extrabold" style={{ color: colors.textPrimary }}>
                      Master Credential
                    </Text>
                    <Text className="text-[11.5px] mt-1" style={{ color: colors.textSecondary }}>
                      {request.hasMasterConfigured
                        ? 'Quick-lock using your Workspace Master PIN/Password.'
                        : 'Set up your Workspace Master now & apply.'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setSelectedLockType('custom');
                      setErrorText(null);
                    }}
                    className="flex-1 p-3 rounded-2xl border active:opacity-80"
                    style={{
                      backgroundColor:
                        selectedLockType === 'custom'
                          ? isDark
                            ? 'rgba(177, 138, 243, 0.16)'
                            : '#F5F3FF'
                          : isDark
                          ? '#242424'
                          : '#F8FAFC',
                      borderColor:
                        selectedLockType === 'custom' ? NoteColors.lavender : colors.borderSubtle,
                    }}
                  >
                    <Text className="text-[13.5px] font-extrabold" style={{ color: colors.textPrimary }}>
                      Custom PIN/Pass
                    </Text>
                    <Text className="text-[11.5px] mt-1" style={{ color: colors.textSecondary }}>
                      Isolated lock. Even Master cannot bypass it.
                    </Text>
                  </Pressable>
                </View>

                {selectedLockType === 'master' && request.hasMasterConfigured ? (
                  <View
                    className="px-3.5 py-2.5 rounded-2xl border mb-3"
                    style={{
                      backgroundColor: isDark ? '#242424' : '#F8FAFC',
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <Text className="text-[12.5px] font-medium" style={{ color: colors.textSecondary }}>
                      This item will unlock only with your configured Workspace Master{' '}
                      {request.masterCredentialType === 'password' ? 'Password' : 'PIN'}.
                    </Text>
                  </View>
                ) : null}

                {needsSecretInputs && (
                  <View>
                    {selectedLockType === 'master' && !request.hasMasterConfigured ? (
                      <View className="mb-3 px-3 py-2 rounded-xl bg-cyan-500/10">
                        <Text className="text-[12px] font-semibold" style={{ color: NoteColors.cyan }}>
                          No Master Credential set yet — create it once below and apply automatically.
                        </Text>
                      </View>
                    ) : null}

                    {/* PIN vs Password toggle */}
                    <View className="flex-row gap-2 mb-3">
                      <Pressable
                        onPress={() => {
                          setSelectedCredKind('pin');
                          setSecret('');
                          setConfirmSecret('');
                          setErrorText(null);
                        }}
                        className="flex-1 py-2 rounded-xl items-center border active:opacity-80"
                        style={{
                          backgroundColor:
                            selectedCredKind === 'pin'
                              ? isDark
                                ? '#383838'
                                : '#171717'
                              : 'transparent',
                          borderColor:
                            selectedCredKind === 'pin' ? 'transparent' : colors.borderSubtle,
                        }}
                      >
                        <Text
                          className="text-[12.5px] font-bold"
                          style={{
                            color: selectedCredKind === 'pin' ? '#FFFFFF' : colors.textSecondary,
                          }}
                        >
                          4–6 Digit PIN
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setSelectedCredKind('password');
                          setSecret('');
                          setConfirmSecret('');
                          setErrorText(null);
                        }}
                        className="flex-1 py-2 rounded-xl items-center border active:opacity-80"
                        style={{
                          backgroundColor:
                            selectedCredKind === 'password'
                              ? isDark
                                ? '#383838'
                                : '#171717'
                              : 'transparent',
                          borderColor:
                            selectedCredKind === 'password' ? 'transparent' : colors.borderSubtle,
                        }}
                      >
                        <Text
                          className="text-[12.5px] font-bold"
                          style={{
                            color:
                              selectedCredKind === 'password' ? '#FFFFFF' : colors.textSecondary,
                          }}
                        >
                          Alphanumeric Password
                        </Text>
                      </Pressable>
                    </View>

                    <View
                      className="flex-row items-center rounded-2xl border px-3.5 h-11 mb-2.5"
                      style={{
                        backgroundColor: isDark ? '#242424' : '#F8FAFC',
                        borderColor: colors.borderSubtle,
                      }}
                    >
                      <TextInput
                        ref={inputRef}
                        value={secret}
                        onChangeText={(txt) => {
                          setSecret(txt);
                          setErrorText(null);
                        }}
                        placeholder={
                          selectedCredKind === 'pin'
                            ? 'Enter 4–6 digit PIN'
                            : 'Enter password (min 4 chars)'
                        }
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showSecret}
                        keyboardType={selectedCredKind === 'pin' ? 'number-pad' : 'default'}
                        maxLength={selectedCredKind === 'pin' ? 6 : 64}
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 text-[14px] font-semibold outline-none"
                        style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                      />
                      <Pressable
                        onPress={() => setShowSecret((p) => !p)}
                        hitSlop={8}
                        className="w-8 h-8 items-center justify-center active:opacity-70"
                      >
                        {showSecret ? (
                          <EyeOff size={16} color={colors.textMuted} />
                        ) : (
                          <Eye size={16} color={colors.textMuted} />
                        )}
                      </Pressable>
                    </View>

                    <View
                      className="flex-row items-center rounded-2xl border px-3.5 h-11 mb-2.5"
                      style={{
                        backgroundColor: isDark ? '#242424' : '#F8FAFC',
                        borderColor: colors.borderSubtle,
                      }}
                    >
                      <TextInput
                        value={confirmSecret}
                        onChangeText={(txt) => {
                          setConfirmSecret(txt);
                          setErrorText(null);
                        }}
                        placeholder={
                          selectedCredKind === 'pin' ? 'Confirm 4–6 digit PIN' : 'Confirm password'
                        }
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showSecret}
                        keyboardType={selectedCredKind === 'pin' ? 'number-pad' : 'default'}
                        maxLength={selectedCredKind === 'pin' ? 6 : 64}
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 text-[14px] font-semibold outline-none"
                        style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                      />
                    </View>
                  </View>
                )}

                {/* Optional Hint */}
                <View
                  className="flex-row items-center rounded-2xl border px-3.5 h-11 mb-1"
                  style={{
                    backgroundColor: isDark ? '#242424' : '#F8FAFC',
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <HelpCircle size={15} color={colors.textMuted} />
                  <TextInput
                    value={hintInput}
                    onChangeText={setHintInput}
                    placeholder="Optional Hint (remember: zero-knowledge, no reset)"
                    placeholderTextColor={colors.textMuted}
                    maxLength={80}
                    className="flex-1 ml-2 text-[13px] outline-none"
                    style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                  />
                </View>

                {errorText ? (
                  <View className="flex-row items-center gap-2 mt-2.5 px-3 py-2 rounded-xl bg-red-500/10">
                    <AlertTriangle size={15} color={NoteColors.coral} />
                    <Text className="text-[12px] font-semibold flex-1" style={{ color: NoteColors.coral }}>
                      {errorText}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-end gap-2.5 mt-5">
                  <Pressable
                    onPress={handleCancel}
                    className="px-4 py-2.5 rounded-full active:opacity-75"
                    style={{ backgroundColor: isDark ? '#383838' : '#EEF1F6' }}
                  >
                    <Text className="text-[13.5px] font-bold" style={{ color: colors.textSecondary }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfigureSubmit}
                    className="px-5 py-2.5 rounded-full active:opacity-80"
                    style={{ backgroundColor: NoteColors.cyan }}
                  >
                    <Text className="text-[13.5px] font-extrabold text-[#171717]">
                      Apply Lock
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* SETUP MASTER MODE */}
            {request.kind === 'setup_master' && (
              <View>
                <View className="flex-row gap-2 mb-3">
                  <Pressable
                    onPress={() => {
                      setSelectedCredKind('pin');
                      setSecret('');
                      setConfirmSecret('');
                      setErrorText(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl items-center border active:opacity-80"
                    style={{
                      backgroundColor:
                        selectedCredKind === 'pin'
                          ? isDark
                            ? '#383838'
                            : '#171717'
                          : 'transparent',
                      borderColor: selectedCredKind === 'pin' ? 'transparent' : colors.borderSubtle,
                    }}
                  >
                    <Text
                      className="text-[12.5px] font-bold"
                      style={{
                        color: selectedCredKind === 'pin' ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      4–6 Digit PIN
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSelectedCredKind('password');
                      setSecret('');
                      setConfirmSecret('');
                      setErrorText(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl items-center border active:opacity-80"
                    style={{
                      backgroundColor:
                        selectedCredKind === 'password'
                          ? isDark
                            ? '#383838'
                            : '#171717'
                          : 'transparent',
                      borderColor:
                        selectedCredKind === 'password' ? 'transparent' : colors.borderSubtle,
                    }}
                  >
                    <Text
                      className="text-[12.5px] font-bold"
                      style={{
                        color: selectedCredKind === 'password' ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      Password
                    </Text>
                  </Pressable>
                </View>

                <View
                  className="flex-row items-center rounded-2xl border px-3.5 h-11 mb-2.5"
                  style={{
                    backgroundColor: isDark ? '#242424' : '#F8FAFC',
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <TextInput
                    ref={inputRef}
                    value={secret}
                    onChangeText={(txt) => {
                      setSecret(txt);
                      setErrorText(null);
                    }}
                    placeholder={
                      selectedCredKind === 'pin'
                        ? 'New 4–6 digit PIN'
                        : 'New password (min 4 chars)'
                    }
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showSecret}
                    keyboardType={selectedCredKind === 'pin' ? 'number-pad' : 'default'}
                    maxLength={selectedCredKind === 'pin' ? 6 : 64}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 text-[14px] font-semibold outline-none"
                    style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                  />
                  <Pressable
                    onPress={() => setShowSecret((p) => !p)}
                    hitSlop={8}
                    className="w-8 h-8 items-center justify-center active:opacity-70"
                  >
                    {showSecret ? (
                      <EyeOff size={16} color={colors.textMuted} />
                    ) : (
                      <Eye size={16} color={colors.textMuted} />
                    )}
                  </Pressable>
                </View>

                <View
                  className="flex-row items-center rounded-2xl border px-3.5 h-11 mb-2.5"
                  style={{
                    backgroundColor: isDark ? '#242424' : '#F8FAFC',
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <TextInput
                    value={confirmSecret}
                    onChangeText={(txt) => {
                      setConfirmSecret(txt);
                      setErrorText(null);
                    }}
                    placeholder={
                      selectedCredKind === 'pin' ? 'Confirm PIN' : 'Confirm password'
                    }
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showSecret}
                    keyboardType={selectedCredKind === 'pin' ? 'number-pad' : 'default'}
                    maxLength={selectedCredKind === 'pin' ? 6 : 64}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleMasterSetupSubmit}
                    className="flex-1 text-[14px] font-semibold outline-none"
                    style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                  />
                </View>

                <View
                  className="flex-row items-center rounded-2xl border px-3.5 h-11"
                  style={{
                    backgroundColor: isDark ? '#242424' : '#F8FAFC',
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <HelpCircle size={15} color={colors.textMuted} />
                  <TextInput
                    value={hintInput}
                    onChangeText={setHintInput}
                    placeholder="Optional Hint (e.g., First pet's birth year)"
                    placeholderTextColor={colors.textMuted}
                    maxLength={80}
                    className="flex-1 ml-2 text-[13px] outline-none"
                    style={{ color: colors.textPrimary, outlineStyle: 'none' } as any}
                  />
                </View>

                <Text className="text-[11px] mt-2 leading-4" style={{ color: colors.textMuted }}>
                  Zero-knowledge protection: ScribeX cannot reset a forgotten Master or Custom PIN/Password.
                </Text>

                {errorText ? (
                  <View className="flex-row items-center gap-2 mt-2.5 px-3 py-2 rounded-xl bg-red-500/10">
                    <AlertTriangle size={15} color={NoteColors.coral} />
                    <Text className="text-[12px] font-semibold flex-1" style={{ color: NoteColors.coral }}>
                      {errorText}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-end gap-2.5 mt-5">
                  <Pressable
                    onPress={handleCancel}
                    className="px-4 py-2.5 rounded-full active:opacity-75"
                    style={{ backgroundColor: isDark ? '#383838' : '#EEF1F6' }}
                  >
                    <Text className="text-[13.5px] font-bold" style={{ color: colors.textSecondary }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleMasterSetupSubmit}
                    className="px-5 py-2.5 rounded-full active:opacity-80"
                    style={{ backgroundColor: NoteColors.cyan }}
                  >
                    <Text className="text-[13.5px] font-extrabold text-[#171717]">
                      Save Master Credential
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
