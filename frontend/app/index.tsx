import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { 
  Plus, 
  Sun, 
  Moon, 
  FolderTree, 
  Search, 
  Sparkles,
  CheckCircle2,
  Bookmark
} from 'lucide-react-native';

export default function NotesHomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme, colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'favorites'>('all');
  const [quickThought, setQuickThought] = useState('');

  return (
    <View 
      className="flex-1 bg-light-canvas dark:bg-brand-canvas"
      style={{ paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }}
    >
      {/* Editorial App Header - Non-Generic, Minimalist */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-light-subtle dark:border-white/5">
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-note-lavender flex-items-center justify-center shadow-sm">
            <Text className="text-black font-extrabold text-base text-center">SX</Text>
          </View>
          <View>
            <Text className="text-2xl font-extrabold text-light-textPrimary dark:text-brand-textPrimary tracking-tight">
              Notes
            </Text>
            <Text className="text-xs font-medium text-light-textMuted dark:text-brand-textMuted">
              Friction-Free Personal Canvas
            </Text>
          </View>
        </View>

        {/* Minimal Circular Actions */}
        <View className="flex-row items-center gap-2">
          <Pressable 
            onPress={toggleTheme}
            className="w-10 h-10 rounded-full bg-light-surface dark:bg-brand-elevated items-center justify-center border border-light-subtle dark:border-white/10 active:scale-95 transition-transform"
          >
            {isDark ? (
              <Sun size={18} color="#FFC96F" />
            ) : (
              <Moon size={18} color="#626262" />
            )}
          </Pressable>

          <Pressable 
            className="w-10 h-10 rounded-full bg-black dark:bg-white items-center justify-center shadow-md active:scale-95 transition-transform"
          >
            <Plus size={20} color={isDark ? '#0C0E14' : '#FFFFFF'} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* Main Fluid Canvas */}
      <ScrollView 
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Universal Quick Capture Ribbon (Fluid, non-box) */}
        <View className="mb-8 pb-4 border-b border-light-subtle dark:border-white/10">
          <TextInput
            placeholder="Type a thought, task, or drop a note..."
            placeholderTextColor={isDark ? '#6B7286' : '#929292'}
            value={quickThought}
            onChangeText={setQuickThought}
            className="text-lg font-medium text-light-textPrimary dark:text-brand-textPrimary py-2"
          />
          <View className="flex-row items-center justify-between pt-2">
            <View className="flex-row items-center gap-2">
              <View className="px-3 py-1 rounded-full bg-note-cyan/15 dark:bg-note-cyan/20">
                <Text className="text-xs font-semibold text-note-cyan">Universal Inbox</Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-light-surface dark:bg-brand-elevated border border-light-subtle dark:border-white/5">
                <Text className="text-xs font-medium text-light-textSecondary dark:text-brand-textSecondary">#inbox</Text>
              </View>
            </View>
            <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">
              Enter to capture
            </Text>
          </View>
        </View>

        {/* Dynamic Filter Pills */}
        <View className="flex-row items-center gap-2 mb-6">
          <Pressable 
            onPress={() => setActiveFilter('all')}
            className={`px-4 py-1.5 rounded-full ${
              activeFilter === 'all' 
                ? 'bg-light-surface dark:bg-brand-elevated border border-light-textPrimary/20 dark:border-white/20' 
                : 'bg-transparent'
            }`}
          >
            <Text className={`text-xs font-semibold ${
              activeFilter === 'all' ? 'text-light-textPrimary dark:text-white' : 'text-light-textMuted dark:text-brand-textMuted'
            }`}>
              All Notes
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => setActiveFilter('tasks')}
            className={`px-4 py-1.5 rounded-full flex-row items-center gap-1.5 ${
              activeFilter === 'tasks' 
                ? 'bg-light-surface dark:bg-brand-elevated border border-light-textPrimary/20 dark:border-white/20' 
                : 'bg-transparent'
            }`}
          >
            <CheckCircle2 size={12} color="#E5F28B" />
            <Text className={`text-xs font-semibold ${
              activeFilter === 'tasks' ? 'text-light-textPrimary dark:text-white' : 'text-light-textMuted dark:text-brand-textMuted'
            }`}>
              Actionable Tasks
            </Text>
          </Pressable>

          <Pressable 
            onPress={() => setActiveFilter('favorites')}
            className={`px-4 py-1.5 rounded-full flex-row items-center gap-1.5 ${
              activeFilter === 'favorites' 
                ? 'bg-light-surface dark:bg-brand-elevated border border-light-textPrimary/20 dark:border-white/20' 
                : 'bg-transparent'
            }`}
          >
            <Bookmark size={12} color="#FFD43B" />
            <Text className={`text-xs font-semibold ${
              activeFilter === 'favorites' ? 'text-light-textPrimary dark:text-white' : 'text-light-textMuted dark:text-brand-textMuted'
            }`}>
              Favorites
            </Text>
          </Pressable>
        </View>

        {/* Fluid Note Surface Demonstration (Non-generic, flowing editorial items) */}
        <View className="gap-6">
          
          {/* Note Entry 1: Lavender Pastel Highlight */}
          <View className="relative pl-5 py-2">
            {/* Pastel Left Accent Bar */}
            <View className="absolute left-0 top-1 bottom-1 w-1.5 rounded-full bg-note-lavender" />
            
            <View className="flex-row items-baseline justify-between mb-1">
              <Text className="text-lg font-bold text-light-textPrimary dark:text-brand-textPrimary tracking-tight">
                Universal Engine Architecture
              </Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">
                Just now
              </Text>
            </View>

            <Text className="text-sm text-light-textSecondary dark:text-brand-textSecondary leading-relaxed mb-3">
              Unifying 42 input methods into composable content blocks. Local-first SQLite WAL ensures sub-5ms latency across all platforms.
            </Text>

            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-note-cyan font-mono">Work/Projects/ScribeX</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">•</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted font-mono">#architecture</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted font-mono">#v1</Text>
            </View>
          </View>

          {/* Thin Editorial Divider */}
          <View className="h-[1px] bg-light-subtle dark:bg-white/5" />

          {/* Note Entry 2: Lime Pastel Highlight */}
          <View className="relative pl-5 py-2">
            <View className="absolute left-0 top-1 bottom-1 w-1.5 rounded-full bg-note-lime" />
            
            <View className="flex-row items-baseline justify-between mb-1">
              <Text className="text-lg font-bold text-light-textPrimary dark:text-brand-textPrimary tracking-tight">
                Phase 1 Core Sprint Checklist
              </Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">
                2h ago
              </Text>
            </View>

            <Text className="text-sm text-light-textSecondary dark:text-brand-textSecondary leading-relaxed mb-3">
              Task engine single source of truth: checklist blocks inside notes reflect instantly on the global task board without data duplication.
            </Text>

            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-note-lime font-mono">2 of 3 tasks completed</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">•</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted font-mono">#sprint</Text>
            </View>
          </View>

          {/* Thin Editorial Divider */}
          <View className="h-[1px] bg-light-subtle dark:bg-white/5" />

          {/* Note Entry 3: Apricot Pastel Highlight */}
          <View className="relative pl-5 py-2">
            <View className="absolute left-0 top-1 bottom-1 w-1.5 rounded-full bg-note-apricot" />
            
            <View className="flex-row items-baseline justify-between mb-1">
              <Text className="text-lg font-bold text-light-textPrimary dark:text-brand-textPrimary tracking-tight">
                Bidirectional Relations & Backlinks
              </Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">
                Yesterday
              </Text>
            </View>

            <Text className="text-sm text-light-textSecondary dark:text-brand-textSecondary leading-relaxed mb-3">
              Knowledge graph links (relates_to, supersedes, derived_from) allow traversal across folder boundaries freely.
            </Text>

            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-note-apricot font-mono">Linked to [[Architecture Blueprint]]</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted">•</Text>
              <Text className="text-xs text-light-textMuted dark:text-brand-textMuted font-mono">#graph</Text>
            </View>
          </View>

        </View>

      </ScrollView>
    </View>
  );
}
