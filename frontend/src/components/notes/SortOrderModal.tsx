import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import {
  ArrowDownUp,
  Clock,
  Calendar,
  ArrowDownAZ,
  ArrowUpAZ,
  History,
  Check,
  X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { NoteSortBy } from '../../core/noteQueryEngine';

export interface SortOptionItem {
  id: NoteSortBy;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

export const SORT_OPTIONS: SortOptionItem[] = [
  {
    id: 'updated_desc',
    label: 'Recently Modified',
    sublabel: 'Notes edited most recently (Default)',
    icon: Clock,
  },
  {
    id: 'updated_asc',
    label: 'Least Recently Modified',
    sublabel: 'Notes untouched for the longest time',
    icon: History,
  },
  {
    id: 'created_desc',
    label: 'Date Created (Newest First)',
    sublabel: 'Recently created thoughts and captures',
    icon: Calendar,
  },
  {
    id: 'created_asc',
    label: 'Date Created (Oldest First)',
    sublabel: 'Earliest archived entries and notes',
    icon: Calendar,
  },
  {
    id: 'title_asc',
    label: 'Title (A → Z)',
    sublabel: 'Alphabetical ascending order',
    icon: ArrowDownAZ,
  },
  {
    id: 'title_desc',
    label: 'Title (Z → A)',
    sublabel: 'Alphabetical descending order',
    icon: ArrowUpAZ,
  },
];

interface SortOrderModalProps {
  visible: boolean;
  currentSort: NoteSortBy;
  onClose: () => void;
  onSelectSort: (sort: NoteSortBy) => void;
}

export const SortOrderModal: React.FC<SortOrderModalProps> = ({
  visible,
  currentSort,
  onClose,
  onSelectSort,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end sm:justify-center items-center p-0 sm:p-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-white dark:bg-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-light-border dark:border-dark-border/40"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-light-border/40 dark:border-dark-border/40">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 items-center justify-center">
                <ArrowDownUp size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Sort Notes
                </Text>
                <Text className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Choose how your notes are organized
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close sort options"
              className="w-8 h-8 rounded-full bg-light-border/40 dark:bg-dark-raised items-center justify-center active:scale-95"
            >
              <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          </View>

          {/* Options List */}
          <View className="gap-2 mb-2">
            {SORT_OPTIONS.map((option) => {
              const isSelected = currentSort === option.id;
              const IconComponent = option.icon;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onSelectSort(option.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${option.label}`}
                  className={`flex-row items-center justify-between p-3.5 rounded-2xl active:scale-[0.99] ${
                    isSelected
                      ? 'bg-cyan-500/15 border border-cyan-500/40 dark:bg-cyan-500/20'
                      : 'bg-light-surface dark:bg-dark-surface/60 border border-light-border/50 dark:border-dark-border/30'
                  }`}
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        isSelected
                          ? 'bg-[#06B6D4]'
                          : 'bg-light-border/60 dark:bg-dark-raised'
                      }`}
                    >
                      <IconComponent
                        size={15}
                        color={isSelected ? '#FFFFFF' : isDark ? '#B5B5B5' : '#626262'}
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected
                            ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                            : 'text-light-textPrimary dark:text-dark-textPrimary'
                        }`}
                      >
                        {option.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-[11px] text-light-textMuted dark:text-dark-textMuted mt-0.5"
                      >
                        {option.sublabel}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View className="w-5 h-5 rounded-full bg-[#06B6D4] items-center justify-center">
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

