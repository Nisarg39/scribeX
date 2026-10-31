import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { User, Briefcase, Mail, Phone, Trash2 } from 'lucide-react-native';

export interface ContactBlockMetadata {
  name?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface ContactBlockProps {
  metadata?: ContactBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateContact?: (updates: ContactBlockMetadata) => void;
}

export const ContactBlock: React.FC<ContactBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateContact,
}) => {
  const { isDark } = useTheme();

  const name = metadata?.name || content || 'Alex Morgan';
  const role = metadata?.role || 'Lead Systems Architect';
  const company = metadata?.company || 'Distributed Systems Lab';
  const email = metadata?.email || 'alex.m@example.com';
  const phone = metadata?.phone || '+1 (555) 019-2834';
  const notes = metadata?.notes || 'Key point of contact for SQLite sync architecture';

  const [localName, setLocalName] = useState(name);
  const [localRole, setLocalRole] = useState(role);
  const [localCompany, setLocalCompany] = useState(company);
  const [localEmail, setLocalEmail] = useState(email);
  const [localPhone, setLocalPhone] = useState(phone);
  const [localNotes, setLocalNotes] = useState(notes);

  const commitUpdates = (partial: Partial<ContactBlockMetadata>) => {
    onUpdateContact?.({
      name: localName,
      role: localRole,
      company: localCompany,
      email: localEmail,
      phone: localPhone,
      notes: localNotes,
      ...partial,
    });
  };

  // Derive initials for avatar
  const initials = useMemo(() => {
    if (!localName.trim()) return '??';
    const parts = localName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [localName]);

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(167, 139, 250, 0.7)'
          : 'rgba(167, 139, 250, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(167, 139, 250, 0.05)'
          : 'rgba(245, 243, 255, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3.5 my-2 rounded-2xl border-2 transition-all cursor-default"
    >
      {/* Top Header: Avatar + Name + Delete */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-3 flex-1">
          {/* Avatar Pill with Initials */}
          <View className="w-9 h-9 rounded-full bg-purple-500/15 dark:bg-purple-400/20 border border-purple-500/30 items-center justify-center shadow-xs">
            <Text className="text-xs font-black text-purple-600 dark:text-purple-300 tracking-wider">
              {initials}
            </Text>
          </View>

          <View className="flex-1">
            <TextInput
              value={localName}
              onChangeText={(n) => {
                setLocalName(n);
                commitUpdates({ name: n });
              }}
              onFocus={onFocus}
              placeholder="Contact full name..."
              placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
              className="text-base md:text-lg font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0.5"
            />
          </View>
        </View>

        {onDelete && (
          <Pressable
            onPress={onDelete}
            className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 active:bg-red-500/20 ml-1"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
            accessibilityLabel="Delete contact block"
          >
            <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        )}
      </View>

      {/* Role & Company Chips */}
      <View className="flex-row items-center flex-wrap gap-2 mb-2 pl-12">
        <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10">
          <Briefcase size={10} color={isDark ? '#A78BFA' : '#7C3AED'} />
          <TextInput
            value={localRole}
            onChangeText={(r) => {
              setLocalRole(r);
              commitUpdates({ role: r });
            }}
            onFocus={onFocus}
            placeholder="Role / Title..."
            placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
            className="text-[11px] font-semibold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0"
          />
        </View>

        <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10">
          <TextInput
            value={localCompany}
            onChangeText={(c) => {
              setLocalCompany(c);
              commitUpdates({ company: c });
            }}
            onFocus={onFocus}
            placeholder="Organization..."
            placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
            className="text-[11px] font-semibold text-light-textSecondary dark:text-dark-textSecondary outline-none py-0"
          />
        </View>
      </View>

      {/* Email & Phone Details Row */}
      <View className="flex-row items-center flex-wrap gap-3 pl-12 mt-1">
        <View className="flex-row items-center gap-1.5 flex-1 min-w-[140px]">
          <Mail size={11} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            value={localEmail}
            onChangeText={(e) => {
              setLocalEmail(e);
              commitUpdates({ email: e });
            }}
            onFocus={onFocus}
            placeholder="email@example.com..."
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            className="flex-1 text-xs text-light-textSecondary dark:text-dark-textSecondary outline-none py-0"
          />
        </View>

        <View className="flex-row items-center gap-1.5 flex-1 min-w-[140px]">
          <Phone size={11} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            value={localPhone}
            onChangeText={(p) => {
              setLocalPhone(p);
              commitUpdates({ phone: p });
            }}
            onFocus={onFocus}
            placeholder="Phone number..."
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            className="flex-1 text-xs text-light-textSecondary dark:text-dark-textSecondary outline-none py-0"
          />
        </View>
      </View>

      {/* Contextual Relationship Notes */}
      <View className="pl-12 mt-2 pt-1.5 border-t border-light-border/30 dark:border-white/5">
        <TextInput
          value={localNotes}
          onChangeText={(nt) => {
            setLocalNotes(nt);
            commitUpdates({ notes: nt });
          }}
          onFocus={onFocus}
          multiline
          placeholder="Relationship notes, interaction summary, context..."
          placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
          className="text-[11px] italic text-light-textMuted dark:text-dark-textMuted outline-none py-0"
        />
      </View>
    </View>
  );
};

