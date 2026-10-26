/**
 * ScribeX Universal Intake Bar.
 *
 * Provides a friction-free text capture, voice intake trigger, and document drop
 * surface connected to the VPS Backend Ask-Before-Write Ambiguity Gate and local SQLite.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Text,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import {
  ArrowUp,
  Mic,
  Paperclip,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { saveLocalNote } from '../../db/notesRepo';
import { ClientNote } from '../../db/types';
import { apiClient } from '../../services/apiClient';
import { syncEngine } from '../../sync/syncEngine';
import { assetService } from '../../services/assetService';
import { ClarificationModal, ClarificationData } from './ClarificationModal';

interface IntakeBarProps {
  onNoteCreated?: (note: ClientNote) => void;
  selectedGroup?: string;
}

export const IntakeBar: React.FC<IntakeBarProps> = ({
  onNoteCreated,
  selectedGroup,
}) => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isGuest } = useAuth();

  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [clarificationData, setClarificationData] = useState<ClarificationData | null>(null);

  const inputRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Listen for background OCR/Whisper ASSET_PROCESSED events
  useEffect(() => {
    const unsubscribe = assetService.subscribe((event) => {
      if (event.extracted_text) {
        setText((prev) => {
          if (prev && !prev.includes(event.extracted_text!)) {
            return `${prev}\n\n${event.extracted_text}`;
          }
          return prev || event.extracted_text || '';
        });
      }
    });
    return unsubscribe;
  }, []);

  // File / Document / Audio upload trigger
  const handleTriggerFileUpload = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf,text/*,audio/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        await uploadAndAttachFile(file);
      };
      input.click();
    }
  };

  const uploadAndAttachFile = async (filePayload: any) => {
    setIsUploadingAsset(true);
    try {
      const asset = await assetService.uploadAsset(filePayload);
      const assetRef = `\n\n[Asset: ${asset.file_name}](/api/v1/assets/${asset.id}/file)\n`;
      let snippet = assetRef;
      if (asset.extracted_text) {
        snippet += `\n> ${asset.extracted_text.trim()}\n`;
      }
      setText((prev) => (prev ? `${prev.trim()}${snippet}` : `${asset.file_name}${snippet}`));
    } catch (err: any) {
      console.warn('Asset upload error:', err);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  // Toggle mic pulse animation
  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      setIsRecording(false);
      pulseAnim.setValue(1);
      // Simulate speech-to-text transcript append
      if (!text) {
        setText('Voice memo: Research modern distributed graph synchronization protocols');
      }
    }
  };

  const parseInput = (raw: string) => {
    const lines = raw.trim().split('\n');
    const firstLine = lines[0].replace(/^[#\-*\s]+/, '').trim();
    const title = firstLine.length > 50 ? `${firstLine.substring(0, 47)}...` : firstLine || 'Untitled Thought';
    const contentMarkdown = lines.length > 1 ? lines.slice(1).join('\n').trim() : raw.trim();
    return { title, contentMarkdown };
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    const { title, contentMarkdown } = parseInput(trimmed);
    const group = selectedGroup && selectedGroup !== 'All' ? selectedGroup : 'General';

    try {
      // 1. Instant Optimistic Local SQLite Write (< 5ms)
      const optimisticNote = await saveLocalNote({
        title,
        content_markdown: contentMarkdown,
        group_name: group,
      });

      if (onNoteCreated) {
        onNoteCreated(optimisticNote);
      }

      setText('');
      inputRef.current?.blur();

      // 2. If Authenticated, Dispatch to VPS Universal Intake API
      if (isAuthenticated && !isGuest) {
        try {
          const intakeRes = await apiClient.post<any>('/api/v1/intake', {
            raw_input: trimmed,
            source_type: isRecording ? 'voice' : 'text',
          });

          if (intakeRes.status === 'NEEDS_CLARIFICATION' && intakeRes.clarifying_questions?.length) {
            setClarificationData({
              stagingId: intakeRes.staging_id,
              rawInput: trimmed,
              clarifyingQuestions: intakeRes.clarifying_questions,
              proposedAction: intakeRes.proposed_action,
              clarityScore: intakeRes.clarity_score,
            });
          } else {
            // Trigger background catch-up sync
            syncEngine.syncNow().catch(() => {});
          }
        } catch (apiErr) {
          // Local note already saved optimistically; syncEngine will catch up
          console.warn('Backend intake queued for delta sync:', apiErr);
        }
      }
    } catch (err) {
      console.error('Failed to capture note locally:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web' && e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Universal Intake Capsule */}
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
            borderColor: isFocused
              ? isDark
                ? '#FFC96F'
                : colors.iconBg
              : colors.borderSubtle,
          },
        ]}
      >
        {/* Left Actions: Voice recording, Attachments & Templates */}
        <View style={styles.leftActions}>
          <Pressable
            onPress={toggleRecording}
            hitSlop={8}
            style={({ pressed }) => [
              styles.utilityButton,
              isRecording && { backgroundColor: isDark ? '#FF9277' : '#FF9277' },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityLabel="Voice capture"
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Mic
                size={18}
                color={
                  isRecording
                    ? '#111111'
                    : isDark
                    ? colors.textSecondary
                    : colors.textMuted
                }
              />
            </Animated.View>
          </Pressable>

          <Pressable
            onPress={handleTriggerFileUpload}
            hitSlop={8}
            disabled={isUploadingAsset}
            style={({ pressed }) => [
              styles.utilityButton,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityLabel="Attach document or file"
          >
            {isUploadingAsset ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Paperclip size={17} color={colors.textMuted} />
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              if (!text) {
                setText('Meeting notes with team:\n- Review Phase 2 architecture\n- Finalize AST block registry');
              }
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.utilityButton,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityLabel="Attach template"
          >
            <Sparkles size={17} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Input Text Box */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Capture a thought, task, or paste markdown..."
          placeholderTextColor={colors.textMuted}
          multiline
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyPress={handleKeyPress}
          onSubmitEditing={Platform.OS === 'web' ? handleSubmit : undefined}
          style={[
            styles.textInput,
            {
              color: colors.textPrimary,
              ...Platform.select({
                web: {
                  outlineStyle: 'none',
                  outlineWidth: 0,
                  outline: 'none',
                } as any,
              }),
            },
          ]}
        />

        {/* Right Action: Circular Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: text.trim() ? colors.iconBg : isDark ? '#3A3A3A' : '#E8E8E8',
              opacity: pressed ? 0.8 : text.trim() ? 1 : 0.6,
            },
          ]}
          accessibilityLabel="Submit Note"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.iconFg} />
          ) : (
            <ArrowUp
              size={18}
              color={text.trim() ? colors.iconFg : colors.textMuted}
            />
          )}
        </Pressable>
      </View>

      {/* ScribeX Ask-Before-Write Ambiguity Gate Clarification Modal */}
      <ClarificationModal
        visible={!!clarificationData}
        data={clarificationData}
        onResolved={(noteResult) => {
          setClarificationData(null);
          syncEngine.syncNow().catch(() => {});
        }}
        onDismiss={() => {
          setClarificationData(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginVertical: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 10 : 6,
    minHeight: 56,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 10,
  },
  utilityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  submitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});
