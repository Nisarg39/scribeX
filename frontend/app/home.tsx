import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context';
import { useNotesStore } from '../src/state/useNotesStore';
import { NotesView } from '../src/components/NotesView';
import { TasksView } from '../src/components/TasksView';
import { BottomDock } from '../src/components/BottomDock';
import { Sun, Moon, LogOut } from 'lucide-react-native';

export default function HomeContainerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { tasks } = useNotesStore();

  const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes');
  const pendingCount = tasks.filter((t) => !t.isCompleted).length;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/signin');
  };

  return (
    <View 
      className="flex-1 bg-light-surface dark:bg-dark-surface relative"
      style={{
        paddingTop: Math.max(insets.top, 8),
        paddingBottom: 0,
      }}
    >
      {/* Full-bleed workspace: no outer card, fills entire width and height */}
      <View className="flex-1 px-4 md:px-8">
        <View className="flex-1 relative">
          
          {/* Top Quiet App Bar */}
          <View className="flex-row items-center justify-between mb-6 pb-2 border-b border-light-border/40 dark:border-dark-border/40">
            {/* Sync / Local Status Badge */}
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted tracking-tight">
                Local SQLite Active
              </Text>
            </View>

            {/* Quiet Action Cluster */}
            <View className="flex-row items-center gap-2">
              {/* Circular Theme Toggle Button */}
              <Pressable
                onPress={toggleTheme}
                accessibilityRole="button"
                accessibilityLabel="Toggle Theme"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
                className="w-10 h-10 rounded-full bg-light-iconBg dark:bg-dark-iconBg items-center justify-center"
              >
                {isDark ? (
                  <Sun size={18} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Moon size={18} color="#FFFFFF" strokeWidth={2} />
                )}
              </Pressable>

              {/* Sign Out Button */}
              <Pressable
                onPress={handleSignOut}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
                className="w-10 h-10 rounded-full bg-light-border dark:bg-dark-raised items-center justify-center"
              >
                <LogOut size={16} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Active View Content: Notes or Tasks */}
          <View className="flex-1">
            {activeTab === 'notes' ? <NotesView /> : <TasksView />}
          </View>

          {/* Floating Bottom Navigation Dock */}
          <BottomDock 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            pendingTasksCount={pendingCount} 
          />

        </View>
      </View>
    </View>
  );
}
