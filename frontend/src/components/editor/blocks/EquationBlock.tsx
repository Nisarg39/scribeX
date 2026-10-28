import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Eye, Edit3, Sigma, Sparkles } from 'lucide-react-native';

interface EquationBlockProps {
  latex: string;
  displayMode?: boolean;
  isSelected?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateLatex: (latex: string) => void;
  onUpdateDisplayMode?: (displayMode: boolean) => void;
}

const COMMON_SYMBOLS = [
  { label: 'a/b', insert: '\\frac{a}{b}' },
  { label: '√x', insert: '\\sqrt{x}' },
  { label: 'x²', insert: 'x^{2}' },
  { label: 'xᵢ', insert: 'x_{i}' },
  { label: '∑', insert: '\\sum_{i=1}^{n}' },
  { label: '∫', insert: '\\int_{a}^{b}' },
  { label: 'π', insert: '\\pi' },
  { label: '∞', insert: '\\infty' },
  { label: '±', insert: '\\pm' },
  { label: 'α', insert: '\\alpha' },
  { label: 'β', insert: '\\beta' },
  { label: 'θ', insert: '\\theta' },
];

/**
 * Cleanly maps common LaTeX tokens into human-friendly unicode mathematical representations for instant live preview
 */
function renderReadableMath(latex: string): string {
  if (!latex) return '';

  let out = latex;

  // Replacements
  out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  out = out.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  out = out.replace(/\^\{([^}]+)\}/g, '^$1');
  out = out.replace(/_\{([^}]+)\}/g, '_$1');
  out = out.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑[$1 to $2]');
  out = out.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1 to $2]');

  // Symbols
  out = out.replace(/\\pi/g, 'π');
  out = out.replace(/\\alpha/g, 'α');
  out = out.replace(/\\beta/g, 'β');
  out = out.replace(/\\theta/g, 'θ');
  out = out.replace(/\\lambda/g, 'λ');
  out = out.replace(/\\infty/g, '∞');
  out = out.replace(/\\pm/g, '±');
  out = out.replace(/\\times/g, '×');
  out = out.replace(/\\div/g, '÷');
  out = out.replace(/\\neq/g, '≠');
  out = out.replace(/\\approx/g, '≈');
  out = out.replace(/\\sum/g, '∑');
  out = out.replace(/\\int/g, '∫');

  return out;
}

export const EquationBlock: React.FC<EquationBlockProps> = ({
  latex,
  displayMode = true,
  isSelected = false,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
  onUpdateLatex,
  onUpdateDisplayMode,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  const handleInsertSymbol = (snippet: string) => {
    const updated = latex ? `${latex} ${snippet}` : snippet;
    onUpdateLatex(updated);
  };

  const previewText = renderReadableMath(latex);

  return (
    <View className="w-full">
      {/* Top Header Controls */}
      <View className="flex-row items-center justify-between px-3 py-2 bg-light-appBg dark:bg-dark-raised border-b border-light-border/60 dark:border-white/5">
        {/* Title */}
        <View className="flex-row items-center gap-1.5">
          <Sigma size={13} color={isDark ? '#B18AF3' : '#8B5CF6'} />
          <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
            LaTeX Formula
          </Text>
        </View>

        {/* View / Edit Mode Switcher */}
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setActiveTab('preview')}
            className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
              activeTab === 'preview' 
                ? 'bg-light-iconBg dark:bg-white' 
                : 'bg-black/5 dark:bg-white/5'
            }`}
          >
            <Eye 
              size={11} 
              color={activeTab === 'preview' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} 
            />
            <Text
              className={`text-[11px] font-semibold ${
                activeTab === 'preview'
                  ? 'text-white dark:text-[#111111] font-bold'
                  : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}
            >
              Preview
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('edit')}
            className={`flex-row items-center gap-1 px-2.5 py-1 rounded-lg ${
              activeTab === 'edit' 
                ? 'bg-light-iconBg dark:bg-white' 
                : 'bg-black/5 dark:bg-white/5'
            }`}
          >
            <Edit3 
              size={11} 
              color={activeTab === 'edit' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} 
            />
            <Text
              className={`text-[11px] font-semibold ${
                activeTab === 'edit'
                  ? 'text-white dark:text-[#111111] font-bold'
                  : 'text-light-textSecondary dark:text-dark-textSecondary'
              }`}
            >
              Formula
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Symbol Toolbar (visible in edit mode) */}
      {activeTab === 'edit' && (
        <View className="p-2 border-b border-light-border/40 dark:border-white/5 flex-row flex-wrap gap-1 bg-black/[0.01] dark:bg-black/20">
          {COMMON_SYMBOLS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => handleInsertSymbol(s.insert)}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="px-2 py-1 rounded-md bg-light-surface dark:bg-[#252525] border border-light-border/40 dark:border-white/5"
            >
              <Text className="text-xs font-mono font-bold text-light-textPrimary dark:text-dark-textPrimary">
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Body: Preview or Edit */}
      {activeTab === 'preview' ? (
        <Pressable
          onPress={() => { onFocus?.(); setActiveTab('edit'); }}
          className="p-5 items-center justify-center min-h-[70px]"
        >
          {latex ? (
            <Text className="text-lg md:text-xl font-serif text-light-textPrimary dark:text-dark-textPrimary tracking-widest text-center">
              {previewText}
            </Text>
          ) : (
            <Text className="text-xs italic text-light-textMuted dark:text-dark-textMuted">
              Empty equation. Tap to edit LaTeX...
            </Text>
          )}
        </Pressable>
      ) : (
        <View className="p-3">
          <TextInput
            multiline
            value={latex}
            onFocus={onFocus}
            onChangeText={onUpdateLatex}
            placeholder="e.g. \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="font-mono text-xs md:text-sm text-light-textPrimary dark:text-[#E6E6E6] py-1"
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>
      )}
    </View>
  );
};
