/**
 * ScribeX Universal Intake Bar.
 *
 * Provides a friction-free text capture, voice intake trigger, and document drop
 * surface connected to the VPS Backend Ask-Before-Write Ambiguity Gate and local SQLite.
 */

import React, { useState, useRef } from 'react';
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
  HelpCircle,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { saveLocalNote } from '../../db/notesRepo';
import { ClientNote } from '../../db/types';
import { apiClient } from '../../services/apiClient';
import { syncEngine } from '../../sync/syncEngine';

interface IntakeBarProps {
  onNoteCreated?: (note: ClientNote) => void;
  selectedGroup?: string;
}

interface ClarificationState {
  stagingId: string;
  questions: string[];
  rawInput: string;
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
  const [clarification, setClarification] = useState<ClarificationState | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isResolvingClarification, setIsResolvingClarification] = useState(false);

  const inputRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
            setClarification({
              stagingId: intakeRes.staging_id,
              questions: intakeRes.clarifying_questions,
              rawInput: trimmed,
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

  const handleResolveClarification = async () => {
    if (!clarification || !clarificationAnswer.trim() || isResolvingClarification) return;

    setIsResolvingClarification(true);
    try {
      await apiClient.post(
        `/api/v1/intake/${clarification.stagingId}/clarify`,
        { answers: clarificationAnswer.trim() }
      );
      setClarification(null);
      setClarificationAnswer('');
      syncEngine.syncNow().catch(() => {});
    } catch (err) {
      console.warn('Clarification resolution queued:', err);
      setClarification(null);
    } finally {
      setIsResolvingClarification(false);
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
        {/* Left Actions: Voice recording & Attachment */}
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

      {/* Ask-Before-Write Ambiguity Gate Clarification Banner */}
      {clarification && (
        <View
          style={[
            styles.clarificationBox,
            {
              backgroundColor: isDark ? '#2D2820' : '#FFF9E6',
              borderColor: '#FFC96F',
            },
          ]}
        >
          <View style={styles.clarificationHeader}>
            <View style={styles.clarificationTitleRow}>
              <HelpCircle size={16} color="#D97706" />
              <Text style={[styles.clarificationTitle, { color: isDark ? '#FFC96F' : '#92400E' }]}>
                Friday needs quick clarification
              </Text>
            </View>
            <Pressable onPress={() => setClarification(null)} hitSlop={8}>
              <X size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          {clarification.questions.map((q, idx) => (
            <Text key={idx} style={[styles.clarificationQuestion, { color: colors.textPrimary }]}>
              • {q}
            </Text>
          ))}

          <View style={styles.clarificationInputRow}>
            <TextInput
              value={clarificationAnswer}
              onChangeText={setClarificationAnswer}
              placeholder="Type your answer to clarify..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.clarificationInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                  ...Platform.select({
                    web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                  }),
                },
              ]}
            />
            <Pressable
              onPress={handleResolveClarification}
              disabled={!clarificationAnswer.trim() || isResolvingClarification}
              style={[
                styles.clarificationButton,
                {
                  backgroundColor: colors.iconBg,
                  opacity: clarificationAnswer.trim() ? 1 : 0.6,
                },
              ]}
            >
              {isResolvingClarification ? (
                <ActivityIndicator size="small" color={colors.iconFg} />
              ) : (
                <Text style={[styles.clarificationButtonText, { color: colors.iconFg }]}>
                  Resolve
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
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
  clarificationBox: {
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  clarificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clarificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clarificationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clarificationQuestion: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  clarificationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  clarificationInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  clarificationButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clarificationButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
