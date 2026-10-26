/**
 * ScribeX Ask-Before-Write Ambiguity Gate Clarification Modal.
 *
 * Intercepts ambiguous inputs (clarity_score < 0.85 or ambiguity_detected),
 * presenting Friday's clarifying questions with actionable choice pills
 * and free-form resolution input before writing to the Git Vault.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  HelpCircle,
  Sparkles,
  ArrowRight,
  X,
  FileQuestion,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { apiClient } from '../../services/apiClient';

export interface ClarificationData {
  stagingId: string;
  rawInput: string;
  clarifyingQuestions: string[];
  proposedAction?: string;
  clarityScore?: number;
}

interface ClarificationModalProps {
  visible: boolean;
  data: ClarificationData | null;
  onResolved: (noteResult?: any) => void;
  onDismiss: () => void;
}

const DEFAULT_CHOICE_PILLS = [
  'Create as a brand new note',
  'Update existing relevant note',
  'File under Projects domain',
  'Convert into an actionable checklist',
];

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  visible,
  data,
  onResolved,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();

  const [answer, setAnswer] = useState('');
  const [selectedPill, setSelectedPill] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!visible || !data) return null;

  const handleSelectPill = (pill: string) => {
    setSelectedPill(pill);
    setAnswer((prev) => (prev ? `${prev} • ${pill}` : pill));
  };

  const handleConfirm = async () => {
    const finalAnswer = answer.trim() || selectedPill;
    if (!finalAnswer || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<any>(
        `/api/v1/intake/${data.stagingId}/clarify`,
        { answers: finalAnswer }
      );

      if (response.status === 'PROCESSED') {
        onResolved(response.note);
      } else if (response.status === 'NEEDS_CLARIFICATION') {
        // Additional round of clarification needed
        setAnswer('');
        setSelectedPill(null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resolve clarification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await apiClient.delete(`/api/v1/intake/${data.stagingId}`);
      onDismiss();
    } catch (err) {
      console.warn('Failed to discard staging item:', err);
      onDismiss();
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? colors.surface : colors.surface,
              borderColor: isDark ? '#3A3A3A' : '#E8E8E8',
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: isDark ? '#3D2F1D' : '#FFF3D6' },
                ]}
              >
                <HelpCircle size={18} color="#D97706" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Ambiguity Gate
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Friday wants to align before committing to your vault
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? colors.surfaceRaised : '#F5F5F5' },
              ]}
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Raw Input Preview Quote */}
            <View
              style={[
                styles.rawInputBox,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : '#F8FAFC',
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.rawInputLabel, { color: colors.textMuted }]}>
                ORIGINAL CAPTURE
              </Text>
              <Text style={[styles.rawInputText, { color: colors.textPrimary }]} numberOfLines={3}>
                "{data.rawInput}"
              </Text>
            </View>

            {/* Friday's Clarifying Questions */}
            <View style={styles.questionsSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Clarifying Questions
              </Text>
              {data.clarifyingQuestions.map((q, idx) => (
                <View key={idx} style={styles.questionItem}>
                  <Text style={[styles.questionBullet, { color: '#D97706' }]}>?</Text>
                  <Text style={[styles.questionText, { color: colors.textPrimary }]}>
                    {q}
                  </Text>
                </View>
              ))}
            </View>

            {/* Quick Action Choice Pills */}
            <View style={styles.pillsSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Suggested Resolutions
              </Text>
              <View style={styles.pillsWrap}>
                {DEFAULT_CHOICE_PILLS.map((pill) => {
                  const isSelected = selectedPill === pill;
                  return (
                    <Pressable
                      key={pill}
                      onPress={() => handleSelectPill(pill)}
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#FFC96F'
                              : '#111111'
                            : isDark
                            ? colors.surfaceRaised
                            : '#F0F0F0',
                          borderColor: isSelected ? 'transparent' : colors.borderSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          {
                            color: isSelected
                              ? isDark
                                ? '#111111'
                                : '#FFFFFF'
                              : colors.textSecondary,
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}
                      >
                        {pill}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* User Custom Clarification Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Your Instruction or Answer
              </Text>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type your clarification or additional context here..."
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  styles.clarifyTextInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: isDark ? colors.surfaceRaised : '#FAFAFA',
                    borderColor: isDark ? '#424242' : '#E0E0E0',
                    ...Platform.select({
                      web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                    }),
                  },
                ]}
              />
            </View>

            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <Pressable
              onPress={handleDiscard}
              disabled={isDiscarding}
              style={[
                styles.discardButton,
                { backgroundColor: isDark ? colors.surfaceRaised : '#F5F5F5' },
              ]}
            >
              {isDiscarding ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <>
                  <Trash2 size={15} color={colors.textMuted} />
                  <Text style={[styles.discardText, { color: colors.textSecondary }]}>
                    Discard Draft
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={(!answer.trim() && !selectedPill) || isSubmitting}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: colors.iconBg,
                  opacity: (!answer.trim() && !selectedPill) || isSubmitting ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.iconFg} />
              ) : (
                <>
                  <Text style={[styles.confirmText, { color: colors.iconFg }]}>
                    Confirm & Commit
                  </Text>
                  <ArrowRight size={16} color={colors.iconFg} />
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(0,0,0,0.25)' } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: 24,
    maxHeight: 480,
  },
  rawInputBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  rawInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rawInputText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  questionsSection: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  questionBullet: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  pillsSection: {
    marginBottom: 18,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  choicePillText: {
    fontSize: 12,
  },
  inputSection: {
    marginBottom: 16,
  },
  clarifyTextInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 80,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  discardText: {
    fontSize: 13,
    fontWeight: '500',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
