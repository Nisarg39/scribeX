/**
 * ScribeX Layer 1 Profile Screen.
 *
 * Provides a dynamic, living cognitive profile viewer and editor for the user's
 * Layer 1 Core Identity stored in the Git Vault (_core/identity.md).
 *
 * Adheres strictly to the ScribeX Pastel Tile Design System:
 * - Soft minimalism, generous whitespace, neutral canvas frame.
 * - Non-generic layout rhythms: editorial typographic structure without generic cards.
 * - Displays Core Identity, Active Goals, Daily Routines, Evolution Timeline,
 *   and compiled Layer 1 RAM prompt preview.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  Edit3,
  Check,
  X,
  Clock,
  Compass,
  Target,
  Terminal,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAuth } from '../../auth';
import { apiClient } from '../../services/apiClient';

interface ProfileScreenProps {
  onBack: () => void;
}

interface CoreProfileData {
  full_name: string;
  role_and_mindset: string;
  career_journey: string;
  long_term_vision: string;
  short_term_goals: string[];
  core_values: string[];
  daily_routines: string[];
}

interface TimelineEvent {
  id: string;
  attribute: string;
  old_value?: string;
  new_value: string;
  change_reason?: string;
  valid_from: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [profile, setProfile] = useState<CoreProfileData | null>(null);
  const [layer1Prompt, setLayer1Prompt] = useState<string>('');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editVision, setEditVision] = useState('');
  const [editGoals, setEditGoals] = useState('');
  const [editValues, setEditValues] = useState('');
  const [editRoutines, setEditRoutines] = useState('');

  const loadProfileData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<any>('/api/v1/profile');
      if (res?.profile) {
        setProfile(res.profile);
        setLayer1Prompt(res.layer1_prompt || '');
        setEditName(res.profile.full_name || '');
        setEditRole(res.profile.role_and_mindset || '');
        setEditVision(res.profile.long_term_vision || '');
        setEditGoals((res.profile.short_term_goals || []).join('\n'));
        setEditValues((res.profile.core_values || []).join(', '));
        setEditRoutines((res.profile.daily_routines || []).join('\n'));
      }

      // Fetch timeline
      try {
        const tRes = await apiClient.get<TimelineEvent[]>('/api/v1/profile/timeline');
        if (Array.isArray(tRes)) {
          setTimeline(tRes);
        }
      } catch (tErr) {
        console.warn('Timeline fetch warning:', tErr);
      }
    } catch (err) {
      console.warn('Profile fetch warning (using local fallback):', err);
      // Fallback display
      const fallback: CoreProfileData = {
        full_name: user?.name || 'Knowledge Worker',
        role_and_mindset: 'Systems Builder & Creative Technologist',
        career_journey: 'Engineering cross-platform distributed systems and tools for thought.',
        long_term_vision: 'Construct high-leverage software architectures that empower human cognition.',
        short_term_goals: [
          'Deliver ScribeX Phase 2 with full offline-first resilience',
          'Maintain 3-hour deep work focus blocks',
          'Refine personal knowledge graph and cognitive models',
        ],
        core_values: ['Extreme Ownership', 'First Principles', 'Craftsmanship'],
        daily_routines: [
          'Morning synthesis and planning',
          'Afternoon deep work code blocks',
          'Evening commit sync and reflection',
        ],
      };
      setProfile(fallback);
      setEditName(fallback.full_name);
      setEditRole(fallback.role_and_mindset);
      setEditVision(fallback.long_term_vision);
      setEditGoals(fallback.short_term_goals.join('\n'));
      setEditValues(fallback.core_values.join(', '));
      setEditRoutines(fallback.daily_routines.join('\n'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const goalsList = editGoals
        .split('\n')
        .map((g) => g.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);

      const valuesList = editValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const routinesList = editRoutines
        .split('\n')
        .map((r) => r.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);

      const updatePayload = {
        full_name: editName.trim(),
        role_and_mindset: editRole.trim(),
        long_term_vision: editVision.trim(),
        short_term_goals: goalsList,
        core_values: valuesList,
        daily_routines: routinesList,
      };

      const res = await apiClient.put<any>('/api/v1/profile', updatePayload);
      if (res?.profile) {
        setProfile(res.profile);
        setLayer1Prompt(res.layer1_prompt || '');
      }
      setIsEditing(false);
      // Refresh timeline
      try {
        const tRes = await apiClient.get<TimelineEvent[]>('/api/v1/profile/timeline');
        if (Array.isArray(tRes)) setTimeline(tRes);
      } catch (e) {}
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditRole(profile.role_and_mindset || '');
      setEditVision(profile.long_term_vision || '');
      setEditGoals((profile.short_term_goals || []).join('\n'));
      setEditValues((profile.core_values || []).join(', '));
      setEditRoutines((profile.daily_routines || []).join('\n'));
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.appBg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.appBg }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
              borderColor: colors.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          accessibilityLabel="Back to notes"
        >
          <ArrowLeft size={17} color={colors.textPrimary} />
          <Text style={[styles.backText, { color: colors.textPrimary }]}>
            Notes
          </Text>
        </Pressable>

        <View style={styles.topRightActions}>
          {!isEditing ? (
            <Pressable
              onPress={() => setIsEditing(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionPill,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Edit3 size={15} color={colors.textPrimary} />
              <Text style={[styles.actionPillText, { color: colors.textPrimary }]}>
                Edit Profile
              </Text>
            </Pressable>
          ) : (
            <View style={styles.editControlsRow}>
              <Pressable
                onPress={handleCancel}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.cancelPill,
                  {
                    backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                    borderColor: colors.borderSubtle,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <X size={15} color={colors.textMuted} />
                <Text style={[styles.actionPillText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.savePill,
                  {
                    backgroundColor: colors.iconBg,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.iconFg} />
                ) : (
                  <>
                    <Check size={15} color={colors.iconFg} />
                    <Text style={[styles.savePillText, { color: colors.iconFg }]}>
                      Save
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={toggleTheme}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {isDark ? (
              <Sun size={17} color={colors.textPrimary} />
            ) : (
              <Moon size={17} color={colors.textPrimary} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Main Editorial Body */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollBody,
          { maxWidth: 920, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Profile Header */}
        <View style={styles.headerBlock}>
          <View style={styles.headerBadgeRow}>
            <View
              style={[
                styles.identityPill,
                { backgroundColor: isDark ? '#3D2F1D' : '#FFF3D6' },
              ]}
            >
              <Sparkles size={13} color="#D97706" />
              <Text style={styles.identityPillText}>
                LAYER 1 CORE IDENTITY
              </Text>
            </View>
            <Text style={[styles.gitPathText, { color: colors.textMuted }]}>
              vault/_core/identity.md
            </Text>
          </View>

          {isEditing ? (
            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                FULL NAME
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.editInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                ROLE & MINDSET
              </Text>
              <TextInput
                value={editRole}
                onChangeText={setEditRole}
                placeholder="Role and driving mindset"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.editInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />
            </View>
          ) : (
            <View>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                {profile?.full_name || 'Knowledge Worker'}
              </Text>
              <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
                {profile?.role_and_mindset || 'Builder & Thinker'}
              </Text>
            </View>
          )}
        </View>

        {/* Core Values Section */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Core Principles & Values
          </Text>
          {isEditing ? (
            <TextInput
              value={editValues}
              onChangeText={setEditValues}
              placeholder="Extreme Ownership, Craftsmanship, First Principles..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.editInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            />
          ) : (
            <View style={styles.valuesWrap}>
              {(profile?.core_values || []).map((val, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.valueChip,
                    {
                      backgroundColor: isDark ? '#363636' : '#F0F0F0',
                      borderLeftColor: ['#FFC96F', '#B18AF3', '#8EDCEB', '#FF9277'][idx % 4],
                    },
                  ]}
                >
                  <Text style={[styles.valueChipText, { color: colors.textPrimary }]}>
                    {val}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Long-Term Vision Section */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Long-Term Life Vision
          </Text>
          {isEditing ? (
            <TextInput
              value={editVision}
              onChangeText={setEditVision}
              multiline
              placeholder="Your 5-10 year life vision and legacy..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.editTextArea,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.visionQuoteBlock,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : '#FBFBFB',
                  borderLeftColor: '#B18AF3',
                },
              ]}
            >
              <Text style={[styles.visionText, { color: colors.textPrimary }]}>
                "{profile?.long_term_vision || 'No long-term vision articulated yet.'}"
              </Text>
            </View>
          )}
        </View>

        {/* Active Short-Term Goals Section */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              Active Goals (Next 3–6 Months)
            </Text>
            <View
              style={[
                styles.goalsCountBadge,
                { backgroundColor: isDark ? '#3D2F1D' : '#FFF3D6' },
              ]}
            >
              <Text style={styles.goalsCountText}>
                {profile?.short_term_goals?.length || 0} active
              </Text>
            </View>
          </View>

          {isEditing ? (
            <TextInput
              value={editGoals}
              onChangeText={setEditGoals}
              multiline
              placeholder="One goal per line..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.editTextArea,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            />
          ) : (
            <View style={styles.goalsList}>
              {(profile?.short_term_goals || []).map((goal, idx) => (
                <View key={idx} style={styles.goalRow}>
                  <View style={[styles.goalIndicator, { backgroundColor: '#FFC96F' }]} />
                  <Text style={[styles.goalText, { color: colors.textPrimary }]}>
                    {goal}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Daily Habits & Routines */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Daily Habits & Deep Work Routines
          </Text>
          {isEditing ? (
            <TextInput
              value={editRoutines}
              onChangeText={setEditRoutines}
              multiline
              placeholder="One routine per line..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.editTextArea,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            />
          ) : (
            <View style={styles.routinesList}>
              {(profile?.daily_routines || []).map((routine, idx) => (
                <View key={idx} style={styles.routineRow}>
                  <Clock size={14} color={colors.textMuted} />
                  <Text style={[styles.routineText, { color: colors.textSecondary }]}>
                    {routine}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Identity Evolution Timeline (Layer 3 "Versions of Me") */}
        {timeline.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              Identity Evolution Timeline
            </Text>
            <View style={styles.timelineList}>
              {timeline.map((event, idx) => (
                <View key={event.id || idx} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#8EDCEB' }]} />
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Text style={[styles.timelineAttr, { color: colors.textPrimary }]}>
                        {event.attribute.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={[styles.timelineTime, { color: colors.textMuted }]}>
                        {event.valid_from ? new Date(event.valid_from).toLocaleDateString() : ''}
                      </Text>
                    </View>
                    <Text style={[styles.timelineValue, { color: colors.textSecondary }]}>
                      {event.new_value}
                    </Text>
                    {event.change_reason && (
                      <Text style={[styles.timelineReason, { color: colors.textMuted }]}>
                        Reason: {event.change_reason}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RAM Prompt Preview Collapsible */}
        {layer1Prompt ? (
          <View style={styles.promptAccordionSection}>
            <Pressable
              onPress={() => setShowPromptPreview((prev) => !prev)}
              style={[
                styles.accordionHeader,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={styles.accordionHeaderLeft}>
                <Terminal size={16} color={colors.textSecondary} />
                <Text style={[styles.accordionTitle, { color: colors.textPrimary }]}>
                  Inspect Active Layer 1 RAM Prompt (~1,500 Tokens)
                </Text>
              </View>
              {showPromptPreview ? (
                <ChevronUp size={16} color={colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={colors.textMuted} />
              )}
            </Pressable>

            {showPromptPreview && (
              <View
                style={[
                  styles.promptTerminalBox,
                  {
                    backgroundColor: isDark ? '#1A1A1A' : '#2D3748',
                  },
                ]}
              >
                <Text style={styles.promptCodeText}>{layer1Prompt}</Text>
              </View>
            )}
          </View>
        ) : null}
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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  editControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  savePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollBody: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 80,
  },
  headerBlock: {
    marginBottom: 36,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  identityPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#D97706',
  },
  gitPathText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  profileName: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  profileRole: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
  },
  editSection: {
    gap: 10,
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  editInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editTextArea: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sectionRow: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalsCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  goalsCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  valuesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  valueChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  valueChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  visionQuoteBlock: {
    padding: 18,
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  visionText: {
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  goalsList: {
    gap: 10,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  routinesList: {
    gap: 10,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routineText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timelineList: {
    gap: 14,
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineAttr: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  timelineTime: {
    fontSize: 11,
  },
  timelineValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  timelineReason: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  promptAccordionSection: {
    marginTop: 16,
    marginBottom: 40,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accordionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  promptTerminalBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    maxHeight: 260,
  },
  promptCodeText: {
    color: '#A0AEC0',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
