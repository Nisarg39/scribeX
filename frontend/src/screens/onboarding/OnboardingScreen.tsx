/**
 * ScribeX Conversational Onboarding Flow.
 *
 * Implements the 6-pillar interview with Friday:
 * 1. Personal Identity & Mindset
 * 2. Career Journey & Milestones
 * 3. Long-Term Life Vision
 * 4. Short-Term Active Goals
 * 5. Current Active Projects & Obligations
 * 6. Daily Checklists & Habits
 *
 * Synthesizes into _core/identity.md (Layer 1) and seeds starter notes.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  Zap,
  SkipForward,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { apiClient } from '../../services/apiClient';
import { syncEngine } from '../../sync/syncEngine';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const PILLAR_SUGGESTIONS: Record<number, string[]> = {
  0: [
    'Software Engineer • Deep focus & craftsmanship',
    'Founder & Builder • Speed, clarity & extreme ownership',
    'Researcher & Writer • Curiosity & systematic synthesis',
    'Product Designer • Simplicity, elegance & precision',
  ],
  1: [
    '8+ years architecting web applications and distributed systems',
    'Founder transitioning to venture building and deep tech',
    'Engineering lead focused on high-performance infrastructure',
    'Creative technologist building cross-platform products',
  ],
  2: [
    'Build enduring independent software products used by millions',
    'Lead transformative AI systems research with high leverage',
    'Attain complete creative autonomy and location independence',
    'Operate a high-standard engineering studio with small teams',
  ],
  3: [
    'Ship ScribeX Phase 2 with robust offline-first delta sync',
    'Protect 3-hour morning deep-work blocks 5 days a week',
    'Publish technical architecture specs and system design docs',
    'Optimize physical energy, fitness, and nightly sleep quality',
  ],
  4: [
    'ScribeX universal app development and backend synchronization',
    'AST parser & composable block editor engine optimization',
    'Quarterly engineering milestone delivery and user testing',
    'Personal knowledge base curation and second brain migration',
  ],
  5: [
    'Morning meditation • 90m deep work block • Daily commit review',
    'Zero inbox before noon • Evening retrospective and plan',
    'Workout at 7am • Focused reading • Digital shutdown ritual',
    'Weekly milestone review • Daily priority triaging at start of day',
  ],
};

const PILLAR_PALETTES = [
  '#FFC96F', // Apricot
  '#B18AF3', // Lavender
  '#8EDCEB', // Sky
  '#E5F28B', // Lime
  '#FF9277', // Coral
  '#F5A4C6', // Pink
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pillarIndex, setPillarIndex] = useState(0);
  const [pillarName, setPillarName] = useState('Personal Identity & Mindset');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { pillar: string; q: string; a: string }[]
  >([]);

  const inputRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Start onboarding interview session on mount
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.post<any>('/api/v1/onboarding/start', {});
        if (isMounted) {
          setSessionId(res.session_id);
          setPillarIndex(res.current_pillar_index || 0);
          setPillarName(res.current_pillar_name || 'Personal Identity & Mindset');
          setQuestion(res.question);
          animateTransition();
        }
      } catch (err) {
        console.warn('Fallback: Failed to start remote onboarding session:', err);
        if (isMounted) {
          // Fallback initial question if backend is offline
          setSessionId(`sess_${Date.now()}`);
          setPillarIndex(0);
          setPillarName('Personal Identity & Mindset');
          setQuestion(
            `Welcome to ScribeX, ${user?.name || 'there'}. I'm Friday, your cognitive assistant. What is your primary craft or focus, and what mindset drives your work?`
          );
          animateTransition();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const animateTransition = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const markOnboardingDoneAndExit = async () => {
    try {
      const key = `scribex_onboarding_completed_${user?.id || 'guest'}`;
      await AsyncStorage.setItem(key, 'true');
      syncEngine.syncNow().catch(() => {});
    } catch (e) {
      console.warn('Storage save error:', e);
    }
    onComplete();
  };

  const handleSkip = async () => {
    await markOnboardingDoneAndExit();
  };

  const handleSelectSuggestion = (text: string) => {
    setAnswer((prev) => (prev ? `${prev} • ${text}` : text));
  };

  const handleSubmitTurn = async () => {
    const trimmed = answer.trim();
    if (!trimmed || isSubmitting || !sessionId) return;

    setIsSubmitting(true);
    const currPillarName = pillarName;
    const currQuestion = question;

    try {
      // Record answer in local conversation history
      setConversationHistory((prev) => [
        ...prev,
        { pillar: currPillarName, q: currQuestion, a: trimmed },
      ]);
      setAnswer('');

      // Send to backend
      const res = await apiClient.post<any>('/api/v1/onboarding/message', {
        session_id: sessionId,
        message: trimmed,
      });

      if (res.is_complete || res.current_pillar_index >= 6) {
        // Finalize
        await finalizeInterview(sessionId);
      } else {
        setPillarIndex(res.current_pillar_index);
        setPillarName(res.current_pillar_name);
        setQuestion(res.question);
        animateTransition();
      }
    } catch (err) {
      console.warn('Onboarding message error:', err);
      // Advance locally if remote error
      const nextIdx = pillarIndex + 1;
      if (nextIdx >= 6) {
        await finalizeInterview(sessionId);
      } else {
        setPillarIndex(nextIdx);
        setPillarName(`Pillar ${nextIdx + 1}`);
        setQuestion(`Understood. Moving forward: what are your key priorities and focus areas for this pillar?`);
        animateTransition();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizeInterview = async (activeSessionId: string) => {
    setIsFinalizing(true);
    try {
      await apiClient.post('/api/v1/onboarding/finalize', {
        session_id: activeSessionId,
      });
    } catch (err) {
      console.warn('Finalize call handled:', err);
    } finally {
      setIsFinalizing(false);
      await markOnboardingDoneAndExit();
    }
  };

  const currentAccent = PILLAR_PALETTES[pillarIndex % PILLAR_PALETTES.length];
  const suggestions = PILLAR_SUGGESTIONS[pillarIndex] || [];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.appBg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Connecting to Friday...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.appBg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { maxWidth: 760, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Minimalist Header */}
        <View style={styles.topBar}>
          <View style={styles.brandingRow}>
            <View
              style={[
                styles.brandDot,
                { backgroundColor: currentAccent },
              ]}
            />
            <Text style={[styles.brandingTitle, { color: colors.textPrimary }]}>
              Friday Cognitive Alignment
            </Text>
          </View>

          <Pressable
            onPress={handleSkip}
            hitSlop={8}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>
              Skip for now
            </Text>
            <SkipForward size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* 6-Step Minimalist Progress Ribbon */}
        <View style={styles.progressContainer}>
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isPassed = idx < pillarIndex;
            const isCurrent = idx === pillarIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor: isCurrent
                      ? currentAccent
                      : isPassed
                      ? isDark
                        ? '#4A4A4A'
                        : '#C4C4C4'
                      : isDark
                      ? '#303030'
                      : '#E0E0E0',
                    height: isCurrent ? 5 : 3,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Current Pillar Badge */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.pillarMetaRow}>
            <View
              style={[
                styles.pillarBadge,
                {
                  backgroundColor: isDark ? '#303030' : '#FFFFFF',
                  borderColor: currentAccent,
                },
              ]}
            >
              <View
                style={[
                  styles.pillarIndicatorDot,
                  { backgroundColor: currentAccent },
                ]}
              />
              <Text
                style={[
                  styles.pillarBadgeText,
                  { color: colors.textPrimary },
                ]}
              >
                Pillar {pillarIndex + 1} of 6 • {pillarName}
              </Text>
            </View>
          </View>

          {/* Friday's Editorial Prompt */}
          <View style={styles.promptBlock}>
            <Text style={[styles.questionHeadline, { color: colors.textPrimary }]}>
              {question}
            </Text>
          </View>

          {/* Suggested Answer Chips (Non-generic, subtle pill aesthetics) */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>
                RECOMMENDED STARTERS (TAP TO ADD)
              </Text>
              <View style={styles.chipsWrap}>
                {suggestions.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleSelectSuggestion(sug)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      {
                        backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                        borderColor: colors.borderSubtle,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {sug}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Response Text Input Area */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={answer}
              onChangeText={setAnswer}
              placeholder="Reflect and type your response..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              style={[
                styles.inputField,
                {
                  color: colors.textPrimary,
                  ...Platform.select({
                    web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
                  }),
                },
              ]}
            />

            <View style={styles.inputBottomRow}>
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                {Platform.OS === 'web' ? 'Press Enter or click Continue' : 'Be as candid as you wish'}
              </Text>

              <Pressable
                onPress={handleSubmitTurn}
                disabled={!answer.trim() || isSubmitting || isFinalizing}
                style={({ pressed }) => [
                  styles.continueButton,
                  {
                    backgroundColor: colors.iconBg,
                    opacity: !answer.trim() || isSubmitting ? 0.45 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {isSubmitting || isFinalizing ? (
                  <ActivityIndicator size="small" color={colors.iconFg} />
                ) : (
                  <>
                    <Text style={[styles.continueText, { color: colors.iconFg }]}>
                      {pillarIndex === 5 ? 'Finalize Profile' : 'Continue'}
                    </Text>
                    <ArrowRight size={16} color={colors.iconFg} />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Previous Answer History (Compact Accordion/Summary) */}
        {conversationHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyLabel, { color: colors.textMuted }]}>
              ESTABLISHED PILLARS
            </Text>
            {conversationHistory.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.historyItem,
                  { borderLeftColor: PILLAR_PALETTES[idx % PILLAR_PALETTES.length] },
                ]}
              >
                <Text style={[styles.historyPillarName, { color: colors.textSecondary }]}>
                  {item.pillar}
                </Text>
                <Text style={[styles.historyAnswer, { color: colors.textPrimary }]}>
                  {item.a}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 64,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandingTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 36,
  },
  progressSegment: {
    flex: 1,
    borderRadius: 3,
  },
  pillarMetaRow: {
    marginBottom: 16,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pillarIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillarBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  promptBlock: {
    marginBottom: 28,
  },
  questionHeadline: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputContainer: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    minHeight: 160,
    marginBottom: 36,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 80,
    padding: 0,
    textAlignVertical: 'top',
  },
  inputBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
  },
  inputHint: {
    fontSize: 12,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
  },
  continueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    marginTop: 12,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  historyItem: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    marginBottom: 16,
  },
  historyPillarName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
