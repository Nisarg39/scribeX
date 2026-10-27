/**
 * ScribeX Ask-Before-Write Ambiguity Gate Clarification Modal.
 *
 * Intercepts ambiguous inputs (clarity_score < 0.85 or ambiguity_detected),
 * presenting Friday's clarifying questions with actionable choice pills
 * and free-form resolution input before writing to the Git Vault.
 */

import React, { useState } from 'react';
import {
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
      <Pressable className="flex-1 bg-black/65 justify-center items-center p-5" onPress={onDismiss}>
        <Pressable
          className="w-full max-w-[620px] max-h-[85%] rounded-[24px] border overflow-hidden bg-surface border-borderSubtle"
          style={Platform.select({ web: { boxShadow: '0 20px 40px rgba(0,0,0,0.25)' } as any })}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 pt-6 pb-4">
            <View className="flex-row items-center gap-3">
              <View className="w-[38px] h-[38px] rounded-full justify-center items-center bg-[#FFF3D6] dark:bg-[#3D2F1D]">
                <HelpCircle size={18} color="#D97706" />
              </View>
              <View>
                <Text className="text-[17px] font-bold leading-[22px] text-textPrimary">
                  Ambiguity Gate
                </Text>
                <Text className="text-xs font-normal text-textSecondary">
                  Friday wants to align before committing to your vault
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              className="w-8 h-8 rounded-full justify-center items-center bg-[#F5F5F5] dark:bg-surfaceRaised"
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView className="px-6 max-h-[480px]" showsVerticalScrollIndicator={false}>
            {/* Raw Input Preview Quote */}
            <View className="p-3.5 rounded-[14px] border border-borderSubtle mb-4 bg-[#F8FAFC] dark:bg-surfaceRaised">
              <Text className="text-[10px] font-bold tracking-wider mb-1 text-textMuted">
                ORIGINAL CAPTURE
              </Text>
              <Text className="text-sm leading-5 italic text-textPrimary" numberOfLines={3}>
                "{data.rawInput}"
              </Text>
            </View>

            {/* Friday's Clarifying Questions */}
            <View className="mb-[18px]">
              <Text className="text-[13px] font-semibold mb-2 text-textPrimary">
                Clarifying Questions
              </Text>
              {data.clarifyingQuestions.map((q, idx) => (
                <View key={idx} className="flex-row items-start gap-2 mb-1.5">
                  <Text className="text-[15px] font-bold leading-5 text-[#D97706]">?</Text>
                  <Text className="text-sm leading-5 flex-1 text-textPrimary">
                    {q}
                  </Text>
                </View>
              ))}
            </View>

            {/* Quick Action Choice Pills */}
            <View className="mb-[18px]">
              <Text className="text-[13px] font-semibold mb-2 text-textPrimary">
                Suggested Resolutions
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DEFAULT_CHOICE_PILLS.map((pill) => {
                  const isSelected = selectedPill === pill;
                  return (
                    <Pressable
                      key={pill}
                      onPress={() => handleSelectPill(pill)}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSelected
                          ? 'bg-[#111111] dark:bg-[#FFC96F] border-transparent'
                          : 'bg-[#F0F0F0] dark:bg-surfaceRaised border-borderSubtle'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          isSelected
                            ? 'text-white dark:text-[#111111] font-semibold'
                            : 'text-textSecondary font-normal'
                        }`}
                      >
                        {pill}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* User Custom Clarification Input */}
            <View className="mb-4">
              <Text className="text-[13px] font-semibold mb-2 text-textPrimary">
                Your Instruction or Answer
              </Text>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder="Type your clarification or additional context here..."
                placeholderTextColor={colors.textMuted}
                multiline
                className="rounded-[14px] border border-inputBorder p-3.5 text-sm leading-[21px] min-h-[80px] text-textPrimary bg-[#FAFAFA] dark:bg-surfaceRaised"
                style={Platform.select({
                  web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                })}
              />
            </View>

            {errorMessage && (
              <Text className="text-[13px] text-red-500 mb-3">{errorMessage}</Text>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View className="flex-row justify-between items-center px-6 py-4 border-t border-borderSubtle">
            <Pressable
              onPress={handleDiscard}
              disabled={isDiscarding}
              className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] bg-[#F5F5F5] dark:bg-surfaceRaised active:opacity-75"
            >
              {isDiscarding ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <>
                  <Trash2 size={15} color={colors.textMuted} />
                  <Text className="text-[13px] font-medium text-textSecondary">
                    Discard Draft
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={(!answer.trim() && !selectedPill) || isSubmitting}
              className={`flex-row items-center gap-2 px-[18px] py-2.5 rounded-2xl bg-iconBg ${
                (!answer.trim() && !selectedPill) || isSubmitting
                  ? 'opacity-50'
                  : 'active:opacity-85'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.iconFg} />
              ) : (
                <>
                  <Text className="text-[13px] font-semibold text-iconFg">
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
