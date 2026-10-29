import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Edit3, Check, Sigma, Sparkles } from 'lucide-react-native';

interface EquationBlockProps {
  latex: string;
  displayMode?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
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
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateLatex,
  onUpdateDisplayMode,
}) => {
  const { isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(!latex || latex.trim() === '');

  const handleInsertSymbol = (snippet: string) => {
    const updated = latex ? `${latex} ${snippet}` : snippet;
    onUpdateLatex(updated);
  };

  const previewText = renderReadableMath(latex);

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : isEditing
            ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)')
            : 'transparent',
          backgroundColor: isSelected
            ? (isDark ? 'rgba(6, 182, 212, 0.03)' : 'rgba(6, 182, 212, 0.02)')
            : isEditing
            ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)')
            : 'transparent',
        },
      ]}
      className="my-1.5 w-full rounded-2xl border-2 p-3 transition-all relative group"
    >
      {/* Floating Toolbar when selected in preview mode */}
      {isSelected && !isEditing && (
        <View className="absolute top-2 right-2 flex-row items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full shadow-lg z-20">
          <Pressable
            onPress={() => {
              onFocus?.();
              setIsEditing(true);
            }}
            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full hover:bg-white/20"
          >
            <Edit3 size={11} color="#FFFFFF" />
            <Text className="text-[10px] font-bold text-white">Edit Formula</Text>
          </Pressable>
        </View>
      )}

      {/* Mode 1: Edit LaTeX formula */}
      {isEditing ? (
        <View className="w-full">
          <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-light-border/40 dark:border-white/5">
            <View className="flex-row items-center gap-1.5">
              <Sigma size={13} color={isDark ? '#8EDCEB' : '#08C4E5'} />
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                LaTeX Formula
              </Text>
            </View>

            <Pressable
              onPress={() => setIsEditing(false)}
              style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
              className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-light-iconBg dark:bg-white"
            >
              <Check size={12} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
              <Text className="text-[11px] font-bold text-white dark:text-[#111111]">
                Done
              </Text>
            </Pressable>
          </View>

          {/* LaTeX Input Box */}
          <TextInput
            value={latex}
            onChangeText={onUpdateLatex}
            onFocus={onFocus}
            placeholder="Type LaTeX e.g. \frac{a}{b} or E = mc^{2}"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            multiline
            className="p-2.5 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 font-mono text-xs text-light-textPrimary dark:text-dark-textPrimary min-h-[48px] mb-2"
          />

          {/* Symbol Quick-Insert Chips */}
          <View className="flex-row flex-wrap items-center gap-1 mb-2">
            {COMMON_SYMBOLS.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => handleInsertSymbol(s.insert)}
                className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-light-border/40 dark:border-white/5"
              >
                <Text className="text-[10px] font-mono font-medium text-light-textPrimary dark:text-dark-textPrimary">
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Live Preview Strip */}
          {latex ? (
            <View className="p-2 rounded-xl bg-black/[0.02] dark:bg-black/20 border border-light-border/30 dark:border-white/5 items-center justify-center">
              <Text className="text-sm font-mono text-light-textPrimary dark:text-dark-textPrimary tracking-wider">
                {previewText}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        /* Mode 2: Clean Mathematical Typography sitting directly on the canvas */
        <View className="py-2 px-1 items-center justify-center w-full min-h-[44px]">
          {latex ? (
            <Text 
              className="text-base md:text-lg font-mono italic text-light-textPrimary dark:text-dark-textPrimary text-center tracking-wide leading-relaxed"
            >
              {previewText}
            </Text>
          ) : (
            <Text className="text-xs italic text-light-textMuted dark:text-dark-textMuted text-center">
              Empty LaTeX formula. Click to edit math notation.
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
};
