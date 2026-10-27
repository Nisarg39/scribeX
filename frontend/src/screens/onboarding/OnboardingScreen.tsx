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
      <View className="flex-1 justify-center items-center gap-4 bg-appBg">
        <ActivityIndicator size="large" color={colors.textPrimary} />
        <Text className="text-sm font-medium text-textSecondary">
          Connecting to Friday...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-appBg">
      <ScrollView
        contentContainerClassName="px-6 pt-12 pb-16 max-w-[760px] self-center w-full"
        contentContainerStyle={{ maxWidth: 760, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Minimalist Header */}
        <View className="flex-row justify-between items-center mb-5">
          <View className="flex-row items-center gap-2.5">
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentAccent }}
            />
            <Text className="text-sm font-semibold tracking-wide text-textPrimary">
              Friday Cognitive Alignment
            </Text>
          </View>

          <Pressable
            onPress={handleSkip}
            hitSlop={8}
            className="flex-row items-center gap-1.5 py-1.5 px-2.5 rounded-xl active:opacity-70"
          >
            <Text className="text-[13px] font-medium text-textMuted">
              Skip for now
            </Text>
            <SkipForward size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* 6-Step Minimalist Progress Ribbon */}
        <View className="flex-row items-center gap-1.5 mb-9">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isPassed = idx < pillarIndex;
            const isCurrent = idx === pillarIndex;
            return (
              <View
                key={idx}
                className="flex-1 rounded-[3px]"
                style={{
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
                }}
              />
            );
          })}
        </View>

        {/* Current Pillar Badge */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View className="mb-4">
            <View
              className="flex-row items-center gap-2 self-start px-3 py-1.5 rounded-2xl border-[1.5px] bg-white dark:bg-[#303030]"
              style={{ borderColor: currentAccent }}
            >
              <View
                className="w-[7px] h-[7px] rounded-full"
                style={{ backgroundColor: currentAccent }}
              />
              <Text className="text-xs font-semibold tracking-wide text-textPrimary">
                Pillar {pillarIndex + 1} of 6 • {pillarName}
              </Text>
            </View>
          </View>

          {/* Friday's Editorial Prompt */}
          <View className="mb-7">
            <Text className="text-2xl leading-[34px] font-bold tracking-tight text-textPrimary">
              {question}
            </Text>
          </View>

          {/* Suggested Answer Chips (Non-generic, subtle pill aesthetics) */}
          {suggestions.length > 0 && (
            <View className="mb-6">
              <Text className="text-[11px] font-bold tracking-wider mb-2.5 text-textMuted">
                RECOMMENDED STARTERS (TAP TO ADD)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleSelectSuggestion(sug)}
                    className="px-3.5 py-2 rounded-2xl border border-borderSubtle bg-surface dark:bg-surfaceRaised active:opacity-75"
                  >
                    <Text className="text-[13px] leading-[18px] text-textSecondary">
                      {sug}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Response Text Input Area */}
          <View className="rounded-[20px] border-[1.5px] border-borderSubtle p-[18px] min-h-[160px] mb-9 bg-surface dark:bg-surfaceRaised">
            <TextInput
              ref={inputRef}
              value={answer}
              onChangeText={setAnswer}
              placeholder="Reflect and type your response..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              className="flex-1 text-base leading-6 min-h-[80px] p-0 text-textPrimary"
              style={Platform.select({
                web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
              })}
            />

            <View className="flex-row justify-between items-center mt-3.5 pt-2.5">
              <Text className="text-xs text-textMuted">
                {Platform.OS === 'web' ? 'Press Enter or click Continue' : 'Be as candid as you wish'}
              </Text>

              <Pressable
                onPress={handleSubmitTurn}
                disabled={!answer.trim() || isSubmitting || isFinalizing}
                className={`flex-row items-center gap-2 px-5 py-2.5 rounded-[18px] bg-iconBg ${
                  !answer.trim() || isSubmitting ? 'opacity-45' : 'active:opacity-80'
                }`}
              >
                {isSubmitting || isFinalizing ? (
                  <ActivityIndicator size="small" color={colors.iconFg} />
                ) : (
                  <>
                    <Text className="text-sm font-semibold text-iconFg">
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
          <View className="mt-3 pt-6 border-t border-[rgba(150,150,150,0.15)]">
            <Text className="text-[11px] font-bold tracking-wider mb-3.5 text-textMuted">
              ESTABLISHED PILLARS
            </Text>
            {conversationHistory.map((item, idx) => (
              <View
                key={idx}
                className="border-l-[3px] pl-3.5 mb-4"
                style={{ borderLeftColor: PILLAR_PALETTES[idx % PILLAR_PALETTES.length] }}
              >
                <Text className="text-xs font-semibold mb-1 text-textSecondary">
                  {item.pillar}
                </Text>
                <Text className="text-sm leading-5 text-textPrimary">
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
