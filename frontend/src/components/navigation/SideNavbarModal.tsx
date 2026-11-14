import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Lock,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { NoteColors } from '../../theme/tokens';
import { useAuth, useSecurity } from '../../context';

interface SideNavbarModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenWorkspaceSettings: () => void;
  onOpenSettings: () => void;
}

export const SideNavbarModal: React.FC<SideNavbarModalProps> = ({
  visible,
  onClose,
  onOpenWorkspaceSettings,
  onOpenSettings,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const {
    securityConfig,
    hasMasterConfigured,
    activeUnlockedCount,
    lockNow,
  } = useSecurity();

  const canLockNow =
    (securityConfig.appLockEnabled && hasMasterConfigured) || activeUnlockedCount > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row">
        {/* Left Navigation Drawer */}
        <View
          className="h-full border-r justify-between"
          style={{
            width: '82%',
            maxWidth: 320,
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            paddingTop: Math.max(insets.top, 18),
            paddingBottom: Math.max(insets.bottom, 20),
            paddingHorizontal: 18,
          }}
        >
          <View>
            {/* Brand Header */}
            <View
              className="flex-row items-center justify-between pb-4 mb-5 border-b"
              style={{ borderColor: colors.borderSubtle }}
            >
              <View className="flex-row items-center gap-2.5">
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: NoteColors.apricot }}
                >
                  <ShieldCheck size={18} color="#171717" strokeWidth={2.3} />
                </View>
                <View>
                  <Text
                    className="text-[19px] font-black tracking-tight"
                    style={{ color: colors.textPrimary }}
                  >
                    ScribeX
                  </Text>
                  <Text className="text-[11px] font-semibold" style={{ color: colors.textMuted }}>
                    Private Workspace
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close Navigation Menu"
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: isDark ? '#383838' : '#F1F3F7' }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Primary Navigation Links */}
            <View className="gap-2.5">
              {/* Option 1: Workspace Sync / Local SQLite Status Interactive Badge */}
              <Pressable
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenWorkspaceSettings(), 60);
                }}
                accessibilityRole="button"
                accessibilityLabel="Open Workspace Settings"
                className="flex-row items-center justify-between px-3.5 py-3.5 rounded-2xl border active:opacity-80"
                style={{
                  backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC',
                  borderColor: colors.borderSubtle,
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-bold tracking-tight"
                      style={{ color: colors.textPrimary }}
                    >
                      {isAuthenticated ? 'Cloud Synced' : 'Local SQLite Active'}
                    </Text>
                    <Text className="text-[11.5px] mt-0.5" style={{ color: colors.textMuted }}>
                      Workspace storage, backup & sync
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>

              {/* Option 2: Settings */}
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenSettings();
                }}
                accessibilityRole="button"
                accessibilityLabel="Open Settings"
                className="flex-row items-center justify-between px-3.5 py-3.5 rounded-2xl border active:opacity-80"
                style={{
                  backgroundColor: isDark ? '#2C2C2C' : '#F8FAFC',
                  borderColor: colors.borderSubtle,
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View
                    className="w-8 h-8 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: isDark ? 'rgba(177, 138, 243, 0.16)' : '#F2ECFE',
                    }}
                  >
                    <Settings size={16} color={NoteColors.lavender} strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14.5px] font-bold tracking-tight"
                      style={{ color: colors.textPrimary }}
                    >
                      Settings
                    </Text>
                    <Text className="text-[11.5px] mt-0.5" style={{ color: colors.textMuted }}>
                      Security, PIN & Password vault lock
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Bottom Security Quick Action */}
          <View>
            {canLockNow ? (
              <Pressable
                onPress={() => {
                  onClose();
                  lockNow();
                }}
                accessibilityRole="button"
                accessibilityLabel="Lock Vault Now"
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-2xl border active:opacity-80"
                style={{
                  backgroundColor: isDark ? 'rgba(177, 138, 243, 0.14)' : '#F5F3FF',
                  borderColor: 'rgba(177, 138, 243, 0.4)',
                }}
              >
                <Lock size={15} color={NoteColors.lavender} strokeWidth={2.3} />
                <Text className="text-[13.5px] font-extrabold" style={{ color: NoteColors.lavender }}>
                  Lock Now{activeUnlockedCount > 0 ? ` (${activeUnlockedCount} active)` : ''}
                </Text>
              </Pressable>
            ) : (
              <Text className="text-[11.5px] text-center" style={{ color: colors.textMuted }}>
                Zero-knowledge local-first workspace
              </Text>
            )}
          </View>
        </View>

        {/* Backdrop Scrim */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Navigation Menu"
          className="flex-1 bg-black/45"
        />
      </View>
    </Modal>
  );
};
