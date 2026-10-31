import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FileText, CheckSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

interface BottomDockProps {
  activeTab: 'notes' | 'tasks';
  onTabChange: (tab: 'notes' | 'tasks') => void;
  pendingTasksCount: number;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  pendingTasksCount,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={{ bottom: Math.max(insets.bottom, 0) + 12 }} className="absolute left-0 right-0 items-center px-4 z-40">
      {/* Floating Minimalist Capsule Dock */}
      <View 
        className="flex-row items-center p-1.5 rounded-full bg-light-iconBg dark:bg-dark-raised border border-light-border dark:border-dark-border shadow-lg"
      >
        {/* Notes Tab Button */}
        <Pressable
          onPress={() => onTabChange('notes')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'notes' }}
          accessibilityLabel="Notes Tab"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
          className={`flex-row items-center gap-2 px-5 py-2.5 rounded-full ${
            activeTab === 'notes'
              ? 'bg-white/20 dark:bg-white/15'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <FileText 
            size={18} 
            color="#FFFFFF" 
            strokeWidth={activeTab === 'notes' ? 2.4 : 1.8} 
          />
          <Text className="text-sm font-semibold text-white tracking-tight">
            Notes
          </Text>
        </Pressable>

        {/* Tasks Tab Button */}
        <Pressable
          onPress={() => onTabChange('tasks')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'tasks' }}
          accessibilityLabel="Tasks Tab"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
          className={`flex-row items-center gap-2 px-5 py-2.5 rounded-full ${
            activeTab === 'tasks'
              ? 'bg-white/20 dark:bg-white/15'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <CheckSquare 
            size={18} 
            color="#FFFFFF" 
            strokeWidth={activeTab === 'tasks' ? 2.4 : 1.8} 
          />
          <Text className="text-sm font-semibold text-white tracking-tight">
            Tasks
          </Text>

          {pendingTasksCount > 0 && (
            <View className="px-1.5 py-0.5 rounded-full bg-note-lime ml-1">
              <Text className="text-[10px] font-extrabold text-[#191919]">
                {pendingTasksCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
};
