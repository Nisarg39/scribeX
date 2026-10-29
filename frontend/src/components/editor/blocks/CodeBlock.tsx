import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { Copy, Check, Terminal, ChevronDown } from 'lucide-react-native';

const POPULAR_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'sql',
  'json',
  'html',
  'css',
  'bash',
  'markdown',
];

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateCode: (code: string) => void;
  onUpdateLanguage: (language: string) => void;
  onUpdateFileName?: (fileName: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  fileName = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
  onEndDrag,
  onDelete,
  onUpdateCode,
  onUpdateLanguage,
  onUpdateFileName,
}) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lineCount = Math.max(1, (code || '').split('\n').length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'),
        },
      ]}
      className="my-1.5 w-full rounded-2xl border overflow-hidden transition-all group"
    >
      {/* Code Header Bar */}
      <View className="flex-row items-center justify-between px-3.5 py-2 bg-black/[0.04] dark:bg-[#1E1E1E] border-b border-light-border/60 dark:border-white/5">
        {/* Left: Language Picker & File Name */}
        <View className="flex-row items-center gap-2">
          {/* Language Selector Dropdown Trigger */}
          <Pressable
            onPress={() => setShowLangMenu(!showLangMenu)}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-light-surface dark:bg-[#252525] border border-light-border/60 dark:border-white/10"
          >
            <Terminal size={12} color={isDark ? '#8EDCEB' : '#08C4E5'} />
            <Text className="text-xs font-mono font-bold text-light-textPrimary dark:text-dark-textPrimary lowercase">
              {language}
            </Text>
            <ChevronDown size={11} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>

          {/* Optional File Name */}
          <TextInput
            value={fileName}
            onChangeText={onUpdateFileName}
            placeholder="filename (optional)"
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            className="text-xs font-mono text-light-textSecondary dark:text-dark-textSecondary py-0 max-w-[160px]"
          />
        </View>

        {/* Right: Copy Button */}
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
          className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-light-surface dark:bg-[#252525] border border-light-border/60 dark:border-white/10"
          accessibilityLabel="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={12} color="#10B981" strokeWidth={2.5} />
              <Text className="text-[11px] font-mono font-semibold text-emerald-500">
                Copied
              </Text>
            </>
          ) : (
            <>
              <Copy size={12} color={isDark ? '#B5B5B5' : '#626262'} />
              <Text className="text-[11px] font-mono text-light-textSecondary dark:text-dark-textSecondary">
                Copy
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Language Dropdown Menu (Inline) */}
      {showLangMenu && (
        <View className="flex-row flex-wrap gap-1 p-2 bg-light-appBg dark:bg-[#1E1E1E] border-b border-light-border/60 dark:border-white/5">
          {POPULAR_LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              onPress={() => {
                onUpdateLanguage(lang);
                setShowLangMenu(false);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                language === lang
                  ? 'bg-note-cyan/20 border border-note-cyan text-note-cyan'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-textSecondary dark:text-dark-textSecondary'
              }`}
            >
              <Text
                className={`text-[11px] font-mono ${
                  language === lang
                    ? 'font-bold text-note-cyan'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                {lang}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Code Text Area with Line Numbers */}
      <View className="flex-row p-3 bg-black/[0.02] dark:bg-[#181818] min-h-[100px]">
        {/* Line Numbers Column */}
        <View className="pr-3 mr-2 border-r border-light-border/40 dark:border-white/5 select-none">
          {lineNumbers.map((num) => (
            <Text
              key={num}
              className="text-xs font-mono text-light-textMuted dark:text-dark-textMuted/40 text-right leading-5"
            >
              {num}
            </Text>
          ))}
        </View>

        {/* Code Input */}
        <TextInput
          value={code}
          onChangeText={onUpdateCode}
          onFocus={onFocus}
          multiline
          placeholder="// Paste or write code snippet here..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          className="flex-1 font-mono text-xs text-light-textPrimary dark:text-dark-textPrimary leading-5 py-0"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </Pressable>
  );
};
