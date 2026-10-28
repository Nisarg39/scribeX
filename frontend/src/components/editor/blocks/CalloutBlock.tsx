import React, { useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Platform } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { Info, AlertTriangle, CheckCircle2, Quote } from 'lucide-react-native';

export type CalloutVariant = 'info' | 'warning' | 'success' | 'quote';

interface CalloutBlockProps {
  content: string;
  variant?: CalloutVariant;
  isSelected?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateContent: (content: string) => void;
  onUpdateVariant: (variant: CalloutVariant) => void;
}

const VARIANT_CONFIG: Record<
  CalloutVariant,
  { label: string; color: string; icon: React.FC<{ size: number; color: string }> }
> = {
  info: {
    label: 'Info',
    color: NoteColors.sky,
    icon: ({ size, color }) => <Info size={size} color={color} />,
  },
  warning: {
    label: 'Warning',
    color: NoteColors.apricot,
    icon: ({ size, color }) => <AlertTriangle size={size} color={color} />,
  },
  success: {
    label: 'Success',
    color: NoteColors.lime,
    icon: ({ size, color }) => <CheckCircle2 size={size} color={color} />,
  },
  quote: {
    label: 'Insight',
    color: NoteColors.lavender,
    icon: ({ size, color }) => <Quote size={size} color={color} />,
  },
};

export const CalloutBlock: React.FC<CalloutBlockProps> = ({
  content,
  variant = 'info',
  isSelected = false,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
  onUpdateContent,
  onUpdateVariant,
}) => {
  const { isDark } = useTheme();
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const IconComponent = config.icon;
  const inputRef = useRef<any>(null);

  const adjustWebTextareaHeight = (el: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const domEl = (el && el.tagName === 'TEXTAREA') ? el : el?.querySelector?.('textarea') || el;
    if (!domEl || !domEl.style) return;

    const apply = () => {
      try {
        (domEl.style as any).fieldSizing = 'content';
        domEl.style.overflow = 'hidden';
        domEl.style.resize = 'none';
        if ('rows' in domEl) {
          domEl.rows = 1;
        }

        domEl.style.height = 'auto';
        const scrollH = domEl.scrollHeight;
        if (scrollH > 0) {
          domEl.style.height = `${scrollH}px`;
        }
      } catch (err) {
        // ignore
      }
    };

    apply();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(apply);
    }
  };

  useEffect(() => {
    adjustWebTextareaHeight(inputRef.current);
  }, [content]);

  return (
    <View 
      style={{
        borderLeftColor: config.color,
        borderLeftWidth: 4,
      }}
      className="pl-3 py-1 w-full"
    >
      {/* Top Variant Pill Selector */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <View
            style={{ backgroundColor: config.color }}
            className="w-5 h-5 rounded-full items-center justify-center"
          >
            <IconComponent size={11} color="#191919" />
          </View>
          <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary uppercase tracking-wider">
            {config.label}
          </Text>
        </View>

        {/* Variant Switcher Pills */}
        <View className="flex-row items-center gap-1">
          {(['info', 'warning', 'success', 'quote'] as CalloutVariant[]).map((v) => {
            const isVariantActive = variant === v;
            const vConf = VARIANT_CONFIG[v];
            return (
              <Pressable
                key={v}
                onPress={() => { onFocus?.(); onUpdateVariant(v); }}
                style={({ pressed }) => [
                  {
                    backgroundColor: isVariantActive ? vConf.color : 'transparent',
                  },
                  pressed ? { transform: [{ scale: 0.9 }] } : undefined,
                ]}
                className={`px-2 py-0.5 rounded-full border ${
                  isVariantActive 
                    ? 'border-transparent' 
                    : 'border-light-border dark:border-white/10'
                }`}
              >
                <Text
                  style={{
                    color: isVariantActive ? '#191919' : (isDark ? '#B5B5B5' : '#626262'),
                    fontWeight: isVariantActive ? '700' : '500',
                  }}
                  className="text-[10px] capitalize"
                >
                  {v}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Editable Callout Body */}
      <TextInput
        ref={(el) => {
          inputRef.current = el;
          if (el) adjustWebTextareaHeight(el);
        }}
        multiline
        scrollEnabled={false}
        value={content}
        onFocus={onFocus}
        onChangeText={(text) => {
          onUpdateContent(text);
          adjustWebTextareaHeight(inputRef.current);
        }}
        placeholder={`Write ${config.label.toLowerCase()} text or highlight...`}
        placeholderTextColor={isDark ? '#858585' : '#929292'}
        className="text-sm leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0 outline-none"
        textAlignVertical="top"
      />
    </View>
  );
};
