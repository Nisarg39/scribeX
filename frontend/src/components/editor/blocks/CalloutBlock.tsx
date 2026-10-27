import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme, NoteColors } from '../../../theme';
import { Info, AlertTriangle, CheckCircle2, Quote } from 'lucide-react-native';

export type CalloutVariant = 'info' | 'warning' | 'success' | 'quote';

interface CalloutBlockProps {
  content: string;
  variant?: CalloutVariant;
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
  onUpdateContent,
  onUpdateVariant,
}) => {
  const { isDark } = useTheme();
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const IconComponent = config.icon;

  return (
    <View
      style={{
        borderLeftColor: config.color,
        borderLeftWidth: 4,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      }}
      className="my-2 p-3.5 rounded-r-2xl border-t border-r border-b border-light-border/40 dark:border-white/5"
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
            const isSelected = variant === v;
            const vConf = VARIANT_CONFIG[v];
            return (
              <Pressable
                key={v}
                onPress={() => onUpdateVariant(v)}
                style={{
                  backgroundColor: isSelected ? vConf.color : 'transparent',
                }}
                className={`px-2 py-0.5 rounded-full border ${
                  isSelected 
                    ? 'border-transparent' 
                    : 'border-light-border dark:border-white/10'
                } active:scale-90`}
              >
                <Text
                  style={{
                    color: isSelected ? '#191919' : (isDark ? '#B5B5B5' : '#626262'),
                    fontWeight: isSelected ? '700' : '500',
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
        multiline
        value={content}
        onChangeText={onUpdateContent}
        placeholder={`Write ${config.label.toLowerCase()} text or highlight...`}
        placeholderTextColor={isDark ? '#858585' : '#929292'}
        className="text-sm leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0"
        textAlignVertical="top"
      />
    </View>
  );
};
