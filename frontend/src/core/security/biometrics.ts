/**
 * ScribeX Biometric Authentication Bridge
 * Provides cross-platform native biometric verification (Face ID / Touch ID / Fingerprint)
 * with strict zero-knowledge Master PIN fallback and safe Web platform stubbing.
 */

import { Platform } from 'react-native';

export type BiometricDisplayName =
  | 'Face ID'
  | 'Touch ID'
  | 'Fingerprint'
  | 'Iris Recognition'
  | 'Biometrics';

export interface BiometricCapability {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  displayName: BiometricDisplayName;
  supportedTypes: number[];
}

export interface BiometricAuthResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

const DEFAULT_UNAVAILABLE_CAPABILITY: BiometricCapability = {
  isAvailable: false,
  hasHardware: false,
  isEnrolled: false,
  displayName: 'Biometrics',
  supportedTypes: [],
};

/**
 * Checks whether native biometrics hardware is present and active on this device.
 * Always returns false on Web, keeping web workspaces strictly Master PIN/Password driven.
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return DEFAULT_UNAVAILABLE_CAPABILITY;
  }

  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let displayName: BiometricDisplayName = 'Biometrics';
    if (Platform.OS === 'ios') {
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        displayName = 'Face ID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        displayName = 'Touch ID';
      }
    } else if (Platform.OS === 'android') {
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        displayName = 'Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        displayName = 'Face ID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        displayName = 'Iris Recognition';
      }
    }

    return {
      isAvailable: Boolean(hasHardware && isEnrolled),
      hasHardware: Boolean(hasHardware),
      isEnrolled: Boolean(isEnrolled),
      displayName,
      supportedTypes: supportedTypes || [],
    };
  } catch {
    return DEFAULT_UNAVAILABLE_CAPABILITY;
  }
}

/**
 * Invokes native biometric challenge.
 *
 * IMPORTANT: `disableDeviceFallback: true` enforces that device passcode/pattern
 * CANNOT bypass ScribeX's vault. If biometric fails or is cancelled, ScribeX's
 * own Master PIN / Password remains as the active fallback.
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Unlock ScribeX Workspace',
  options?: {
    cancelLabel?: string;
    promptSubtitle?: string;
  }
): Promise<BiometricAuthResult> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      error: 'Biometric authentication is not supported on Web.',
    };
  }

  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: options?.promptSubtitle || 'Confirm your identity to proceed',
      cancelLabel: options?.cancelLabel || 'Cancel',
      fallbackLabel: 'Use Master PIN',
      disableDeviceFallback: true,
    });

    if (res.success) {
      return { success: true };
    }

    const isCancelled =
      res.error === 'user_cancel' ||
      res.error === 'app_cancel' ||
      res.error === 'system_cancel' ||
      res.error === 'user_fallback';

    return {
      success: false,
      cancelled: isCancelled,
      error: res.error || 'Biometric authentication failed.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Biometric authentication encountered an error.',
    };
  }
}
