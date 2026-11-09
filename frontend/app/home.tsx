import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context';
import { useNotesStore } from '../src/state/useNotesStore';
import { NotesView } from '../src/components/NotesView';
import { TasksView } from '../src/components/TasksView';
import { BottomDock } from '../src/components/BottomDock';
import { Sun, Moon, LogOut, Database, Bell } from 'lucide-react-native';
import { WorkspaceSettingsModal } from '../src/components/settings/WorkspaceSettingsModal';
import { NotificationCenterModal } from '../src/components/common/NotificationCenterModal';

export default function HomeContainerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { tasks, unreadNotificationsCount } = useNotesStore();
  const params = useLocalSearchParams<{ tab?: string; taskId?: string }>();

  const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes');
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const pendingCount = tasks.filter((t) => !t.isCompleted).length;

  useEffect(() => {
    if (params.tab === 'tasks') {
      setActiveTab('tasks');
    } else if (params.tab === 'notes') {
      setActiveTab('notes');
    }
    if (params.taskId) {
      setFocusedTaskId(params.taskId);
    }
  }, [params.tab, params.taskId]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/signin');
  };

  const handleNavigateFromNotification = (targetType: string, targetId: string, noteId?: string) => {
    setIsNotificationCenterOpen(false);
    if (targetType === 'task') {
      setActiveTab('tasks');
      setFocusedTaskId(targetId);
    } else if (targetType === 'note') {
      const destinationId = noteId || targetId;
      if (destinationId) {
        router.push(`/note/${destinationId}`);
      }
    }
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
            {/* Sync / Local Status Badge (Interactive) */}
            <Pressable
              onPress={() => setIsSettingsModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Workspace Settings"
              className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-light-surface/60 dark:bg-white/5 border border-light-border/60 dark:border-white/10 active:scale-95"
            >
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted tracking-tight">
                Local SQLite Active
              </Text>
            </Pressable>

            {/* Quiet Action Cluster */}
            <View className="flex-row items-center gap-2">
              {/* In-App Notification Center Bell Trigger */}
              <Pressable
                onPress={() => setIsNotificationCenterOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Open In-App Notification Center"
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
                className="w-10 h-10 rounded-full bg-light-border/60 dark:bg-dark-raised items-center justify-center relative active:scale-95"
              >
                <Bell
                  size={17}
                  color={unreadNotificationsCount > 0 ? (isDark ? '#F7F7F7' : '#171717') : (isDark ? '#B5B5B5' : '#626262')}
                  strokeWidth={2}
                />
                {unreadNotificationsCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 8.5,
                    }}
                    className="bg-light-iconBg dark:bg-white items-center justify-center px-1 border border-light-surface dark:border-dark-surface"
                  >
                    <Text className="text-[9px] font-black text-white dark:text-[#111111] leading-none">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Workspace Settings / Backup Button */}
              <Pressable
                onPress={() => setIsSettingsModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Workspace & Storage Settings"
                style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
                className="w-10 h-10 rounded-full bg-light-border/60 dark:bg-dark-raised items-center justify-center active:scale-95"
              >
                <Database size={16} color={isDark ? '#B5B5B5' : '#626262'} strokeWidth={2} />
              </Pressable>

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
            {activeTab === 'notes' ? (
              <NotesView />
            ) : (
              <TasksView
                focusedTaskId={focusedTaskId}
                onClearFocusedTask={() => setFocusedTaskId(null)}
              />
            )}
          </View>

          {/* Floating Bottom Navigation Dock */}
          <BottomDock 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            pendingTasksCount={pendingCount} 
          />

          {/* In-App Notification Center Popover */}
          <NotificationCenterModal
            visible={isNotificationCenterOpen}
            onClose={() => setIsNotificationCenterOpen(false)}
            onNavigateToTarget={handleNavigateFromNotification}
          />

          {/* Workspace Storage & Backup Settings Modal */}
          <WorkspaceSettingsModal
            visible={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />

        </View>
      </View>
    </View>
  );
}
