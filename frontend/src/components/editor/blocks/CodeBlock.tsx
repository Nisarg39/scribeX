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
  onFocus?: () => void;
  onLongPress?: () => void;
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
  onFocus,
  onLongPress,
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
    <View className="w-full">
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
              <Text className="text-[11px] font-bold text-[#10B981]">
                Copied!
              </Text>
            </>
          ) : (
            <>
              <Copy size={12} color={isDark ? '#B5B5B5' : '#626262'} />
              <Text className="text-[11px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                Copy
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Language Selector Menu Bar */}
      {showLangMenu && (
        <View className="p-2 bg-light-surface dark:bg-[#202020] border-b border-light-border dark:border-white/10 flex-row flex-wrap gap-1.5">
          {POPULAR_LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              onPress={() => {
                onUpdateLanguage(lang);
                setShowLangMenu(false);
              }}
              className={`px-2 py-1 rounded-md ${
                language === lang 
                  ? 'bg-light-iconBg dark:bg-white' 
                  : 'bg-black/5 dark:bg-white/5'
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-medium ${
                  language === lang
                    ? 'text-white dark:text-[#111111] font-bold'
                    : 'text-light-textSecondary dark:text-dark-textSecondary'
                }`}
              >
                {lang}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Code Editor Body with Line Numbers */}
      <View className="flex-row p-3 font-mono">
        {/* Line Numbers Gutter */}
        <View className="pr-3 border-r border-light-border/40 dark:border-white/5 select-none opacity-40 items-end">
          {lineNumbers.map((num) => (
            <Text
              key={num}
              className="text-xs font-mono text-light-textMuted dark:text-dark-textMuted leading-6"
            >
              {num}
            </Text>
          ))}
        </View>

        {/* Code Input Area */}
        <TextInput
          multiline
          value={code}
          onFocus={onFocus}
          onChangeText={onUpdateCode}
          placeholder="// Paste or write code snippet..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          className="flex-1 pl-3 font-mono text-xs md:text-sm text-light-textPrimary dark:text-[#E6E6E6] leading-6 py-0"
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </View>
    </View>
  );
};
