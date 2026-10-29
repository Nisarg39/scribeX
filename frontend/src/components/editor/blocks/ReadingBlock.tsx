import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { BookOpen, Star, CheckCircle, Clock, Trash2 } from 'lucide-react-native';

export type ReadingStatus = 'unread' | 'reading' | 'finished';

export interface ReadingBlockMetadata {
  title?: string;
  author?: string;
  status?: ReadingStatus;
  currentPage?: number;
  totalPages?: number;
  rating?: number; // 0 to 5
  notes?: string;
}

interface ReadingBlockProps {
  metadata?: ReadingBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateReading?: (updates: ReadingBlockMetadata) => void;
}

const STATUS_CONFIG: Record<ReadingStatus, { label: string; color: string }> = {
  unread: { label: 'Want to Read', color: '#9CA3AF' },
  reading: { label: 'Reading', color: '#38BDF8' },
  finished: { label: 'Finished', color: '#10B981' },
};

const STATUS_ORDER: ReadingStatus[] = ['unread', 'reading', 'finished'];

export const ReadingBlock: React.FC<ReadingBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateReading,
}) => {
  const { isDark } = useTheme();

  const title = metadata?.title || content || 'Designing Data-Intensive Applications';
  const author = metadata?.author || 'Martin Kleppmann';
  const status = metadata?.status || 'reading';
  const currentPage = metadata?.currentPage ?? 240;
  const totalPages = metadata?.totalPages ?? 560;
  const rating = metadata?.rating ?? 5;
  const notes = metadata?.notes || '';

  const [localTitle, setLocalTitle] = useState(title);
  const [localAuthor, setLocalAuthor] = useState(author);
  const [localCurrentPage, setLocalCurrentPage] = useState(String(currentPage));
  const [localTotalPages, setLocalTotalPages] = useState(String(totalPages));

  const commitUpdates = (partial: Partial<ReadingBlockMetadata>) => {
    onUpdateReading?.({
      title: localTitle,
      author: localAuthor,
      status,
      currentPage: parseInt(localCurrentPage, 10) || 0,
      totalPages: parseInt(localTotalPages, 10) || 1,
      rating,
      notes,
      ...partial,
    });
  };

  const handleCycleStatus = () => {
    onFocus?.();
    const curIdx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[(curIdx + 1) % STATUS_ORDER.length];
    commitUpdates({ status: next });
  };

  const handleSetRating = (newRating: number) => {
    onFocus?.();
    commitUpdates({ rating: newRating === rating ? 0 : newRating });
  };

  const parsedCur = parseInt(localCurrentPage, 10) || 0;
  const parsedTotal = parseInt(localTotalPages, 10) || 1;
  const percent = Math.min(100, Math.max(0, Math.round((parsedCur / parsedTotal) * 100)));

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(56, 189, 248, 0.7)'
          : 'rgba(56, 189, 248, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(56, 189, 248, 0.05)'
          : 'rgba(240, 249, 255, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3.5 my-2 rounded-2xl border-2 transition-all cursor-default"
    >
      {/* Top Header: Book Icon + Title + Status Pill */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2.5 flex-1">
          <View className="w-8 h-8 rounded-full bg-sky-500/15 dark:bg-sky-400/20 border border-sky-500/30 items-center justify-center shadow-xs">
            <BookOpen size={15} color="#0284C7" strokeWidth={2.4} />
          </View>

          <View className="flex-1">
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Book or article title..."
              placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
              className="text-base md:text-lg font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0.5"
            />
          </View>
        </View>

        {/* Right: Status Pill & Delete */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleCycleStatus}
            className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
            accessibilityLabel="Cycle reading status"
          >
            <View
              style={{ backgroundColor: STATUS_CONFIG[status]?.color || '#9CA3AF' }}
              className="w-1.5 h-1.5 rounded-full"
            />
            <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
              {STATUS_CONFIG[status]?.label || 'Reading'}
            </Text>
          </Pressable>

          {onDelete && (
            <Pressable
              onPress={onDelete}
              className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 ml-0.5"
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
              accessibilityLabel="Delete reading block"
            >
              <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Author & Star Rating Row */}
      <View className="flex-row items-center justify-between flex-wrap gap-2 pl-10 mb-2.5">
        {/* Author Input */}
        <View className="flex-row items-center gap-1.5 flex-1 min-w-[150px]">
          <Text className="text-xs text-light-textMuted dark:text-dark-textMuted font-medium">by</Text>
          <TextInput
            value={localAuthor}
            onChangeText={(a) => {
              setLocalAuthor(a);
              commitUpdates({ author: a });
            }}
            onFocus={onFocus}
            placeholder="Author name..."
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            className="flex-1 text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary outline-none py-0"
          />
        </View>

        {/* Star Rating (1 to 5) */}
        <View className="flex-row items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((starVal) => (
            <Pressable
              key={`star-${starVal}`}
              onPress={() => handleSetRating(starVal)}
              className="p-0.5"
              accessibilityLabel={`Rate ${starVal} stars`}
            >
              <Star
                size={13}
                color={starVal <= rating ? '#F59E0B' : isDark ? '#4B5563' : '#D1D5DB'}
                fill={starVal <= rating ? '#F59E0B' : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Page Progress Bar & Inputs */}
      <View className="pl-10">
        <View className="w-full h-1.5 rounded-full bg-light-border/60 dark:bg-white/10 overflow-hidden mb-1.5">
          <View
            style={{ width: `${percent}%` }}
            className={`h-full rounded-full ${
              percent >= 100
                ? 'bg-emerald-500'
                : percent >= 50
                ? 'bg-sky-500'
                : 'bg-note-cyan'
            }`}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">Page</Text>
            <TextInput
              value={localCurrentPage}
              onChangeText={(c) => {
                setLocalCurrentPage(c);
                commitUpdates({ currentPage: parseInt(c, 10) || 0 });
              }}
              onFocus={onFocus}
              keyboardType="number-pad"
              className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0 w-10 text-center bg-light-appBg dark:bg-dark-raised rounded border border-light-border/50 dark:border-white/10"
            />
            <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">of</Text>
            <TextInput
              value={localTotalPages}
              onChangeText={(tp) => {
                setLocalTotalPages(tp);
                commitUpdates({ totalPages: parseInt(tp, 10) || 1 });
              }}
              onFocus={onFocus}
              keyboardType="number-pad"
              className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary outline-none py-0 w-12 text-center bg-light-appBg dark:bg-dark-raised rounded border border-light-border/50 dark:border-white/10"
            />
          </View>

          <Text className="text-[11px] font-bold text-light-textMuted dark:text-dark-textMuted">
            {percent}% completed
          </Text>
        </View>
      </View>
    </View>
  );
};

