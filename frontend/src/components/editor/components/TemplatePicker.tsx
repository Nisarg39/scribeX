import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Users,
  Sun,
  FileCode,
  RotateCcw,
  Compass,
  Sparkles,
} from 'lucide-react-native';
import { NoteColors, useTheme } from '../../../theme';
import { NOTE_TEMPLATES, NoteTemplate } from '../../../core/templates/noteTemplates';

interface TemplatePickerProps {
  onSelectTemplate: (template: NoteTemplate) => void;
  className?: string;
}

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  Users,
  Sun,
  FileCode,
  RotateCcw,
  Compass,
};

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  onSelectTemplate,
  className = '',
}) => {
  const { isDark } = useTheme();

  return (
    <View className={`my-4 w-full select-none ${className}`}>
      {/* Subtle Section Label */}
      <View className="flex-row items-center gap-1.5 mb-2.5">
        <Sparkles size={11} color="#06B6D4" />
        <Text className="text-[11px] font-bold uppercase tracking-wider text-light-textMuted dark:text-dark-textMuted">
          Start with a Template
        </Text>
      </View>

      {/* Canvas-Integrated Pill Chips (No Boxed Generic Cards) */}
      <View className="flex-row flex-wrap items-center gap-2">
        {NOTE_TEMPLATES.map((tpl) => {
          const IconComp = TEMPLATE_ICONS[tpl.iconName] || Sparkles;
          const accentColor = (NoteColors as Record<string, string>)[tpl.colorToken] || '#06B6D4';

          return (
            <Pressable
              key={tpl.id}
              onPress={() => onSelectTemplate(tpl)}
              style={({ pressed }) => [
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="flex-row items-center gap-2 px-3.5 py-2 rounded-full border transition-all hover:border-note-cyan/60 hover:bg-note-cyan/5 group"
            >
              {/* Pastel Category Accent Dot */}
              <View
                style={{ backgroundColor: accentColor }}
                className="w-2 h-2 rounded-full flex-shrink-0"
              />

              <IconComp size={12} color={isDark ? '#F7F7F7' : '#171717'} />

              <Text className="text-xs font-semibold text-light-textPrimary dark:text-dark-textPrimary group-hover:text-note-cyan">
                {tpl.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
