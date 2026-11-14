import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { NoteColors } from '../../theme';
import { NoteCardViewModel } from '../../core/noteQueryEngine';
import { NoteItem } from '../../types/note';
import { formatNoteCardDate, formatReminderChip } from '../../types/reminder';
import {
  Star,
  Pencil,
  Pin,
  RotateCcw,
  Trash2,
  Sparkles,
  Volume2,
  Image as ImageIcon,
  Video,
  FileText,
  PenTool,
  CheckSquare,
  Check,
  Code,
  Bookmark,
  MapPin,
  Calendar,
  Folder,
  Tag,
  BellRing,
  Lock,
  LockOpen,
  Shield,
} from 'lucide-react-native';

export interface NoteCardProps {
  viewModel: NoteCardViewModel;
  isPinnedShelfCard?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  isEffectivelyLocked?: boolean;
  onOpenNote: (note: NoteItem) => void;
  onTogglePin: (noteId: string) => void;
  onToggleFavorite: (noteId: string) => void;
  onToggleLock?: (note: NoteItem) => void;
  onRestoreNote: (noteId: string) => void;
  onPermanentlyDeleteNote: (noteId: string) => void;
  onUnarchiveNote: (noteId: string) => void;
  onToggleSelect?: (noteId: string) => void;
  onLongPressNote?: (noteId: string) => void;
}

const renderMatchBadgeIcon = (iconType: string) => {
  const color = '#FFFFFF';
  const size = 11;
  switch (iconType) {
    case 'audio':
    case 'voice_dictation':
      return <Volume2 size={size} color={color} />;
    case 'image':
    case 'scan':
      return <ImageIcon size={size} color={color} />;
    case 'video':
    case 'lecture_note':
      return <Video size={size} color={color} />;
    case 'drawing':
    case 'diagram':
      return <PenTool size={size} color={color} />;
    case 'file':
      return <FileText size={size} color={color} />;
    case 'checklist':
    case 'habit':
    case 'kanban':
      return <CheckSquare size={size} color={color} />;
    case 'code':
      return <Code size={size} color={color} />;
    case 'bookmark':
    case 'web_clip':
      return <Bookmark size={size} color={color} />;
    case 'location':
      return <MapPin size={size} color={color} />;
    case 'event':
    case 'meeting_notes':
      return <Calendar size={size} color={color} />;
    case 'folder':
      return <Folder size={size} color={color} />;
    case 'tag':
      return <Tag size={size} color={color} />;
    default:
      return <Sparkles size={size} color={color} />;
  }
};

export const NoteCard: React.FC<NoteCardProps> = ({
  viewModel,
  isPinnedShelfCard = false,
  isSelectionMode = false,
  isSelected = false,
  isEffectivelyLocked = false,
  onOpenNote,
  onTogglePin,
  onToggleFavorite,
  onToggleLock,
  onRestoreNote,
  onPermanentlyDeleteNote,
  onUnarchiveNote,
  onToggleSelect,
  onLongPressNote,
}) => {
  const { note, cleanPreviewText, matchBadge } = viewModel;
  const pastelHex = NoteColors[note.colorToken] || '#FFC96F';
  const isTrashed = note.status === 'trashed';
  const isArchived = note.status === 'archived';
  const isDirectlyLocked = Boolean(note.isLocked);
  const isMasked = isEffectivelyLocked;

  return (
    <View className="w-full sm:w-1/2 lg:w-1/3 p-2.5">
      <Pressable
        onPress={() => {
          if (isSelectionMode) {
            onToggleSelect?.(note.id);
          } else if (!isTrashed) {
            onOpenNote(note);
          }
        }}
        onLongPress={() => {
          if (onLongPressNote) {
            onLongPressNote(note.id);
          } else if (onToggleSelect) {
            onToggleSelect(note.id);
          }
        }}
        {...(Platform.OS === 'web'
          ? ({
              onContextMenu: (e: any) => {
                if (e && typeof e.preventDefault === 'function') {
                  e.preventDefault();
                }
                if (isSelectionMode) {
                  onToggleSelect?.(note.id);
                } else if (onLongPressNote) {
                  onLongPressNote(note.id);
                } else if (onToggleSelect) {
                  onToggleSelect(note.id);
                }
              },
            } as any)
          : {})}
        delayLongPress={180}
        accessibilityLabel={
          isSelectionMode
            ? `${isSelected ? 'Deselect' : 'Select'} note ${note.title}`
            : isPinnedShelfCard
            ? `Open pinned note ${note.title}`
            : `Open note ${note.title}`
        }
        style={{
          backgroundColor: pastelHex,
          minHeight: 130,
          borderWidth: isSelected ? 3 : isSelectionMode ? 1.5 : 0,
          borderColor: isSelected ? '#06B6D4' : isSelectionMode ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
          transform: [{ scale: isSelected ? 0.985 : 1 }],
        }}
        className="p-4 rounded-[18px] justify-between shadow-sm active:scale-[0.99] relative overflow-hidden"
      >
        {/* Top Row: Folder Badge, Status/Pin Chips & Action Buttons / Selection Indicator */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5 flex-shrink">
            <View className="px-2.5 py-1 rounded-full bg-black/10">
              <Text
                numberOfLines={1}
                className="text-[11px] font-semibold text-[#191919] tracking-tight"
              >
                {note.folderPath || 'General'}
              </Text>
            </View>
            {(isPinnedShelfCard || note.isPinned) && !isTrashed && (
              <View className="w-6 h-6 rounded-full bg-black/10 items-center justify-center">
                <Pin size={11} color="#191919" fill="#191919" />
              </View>
            )}
            {isArchived && (
              <View className="px-2 py-0.5 rounded-full bg-cyan-700/20">
                <Text className="text-[10px] font-bold text-[#191919]">Archived</Text>
              </View>
            )}
            {isTrashed && (
              <View className="px-2 py-0.5 rounded-full bg-red-700/20">
                <Text className="text-[10px] font-bold text-[#191919]">Trash</Text>
              </View>
            )}
          </View>

          {isSelectionMode ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onToggleSelect?.(note.id);
              }}
              hitSlop={8}
              accessibilityLabel={isSelected ? 'Deselect Note' : 'Select Note'}
              className={`w-6 h-6 rounded-full items-center justify-center ${
                isSelected
                  ? 'bg-[#06B6D4] shadow-sm'
                  : 'border-2 border-black/30 bg-black/5'
              }`}
            >
              {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </Pressable>
          ) : (
            !isTrashed && (
              <View className="flex-row items-center gap-1">
                {onToggleLock && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onToggleLock(note);
                    }}
                    hitSlop={8}
                    accessibilityLabel={isDirectlyLocked ? 'Manage Note Lock' : 'Lock Note'}
                    className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                    style={{
                      backgroundColor:
                        isMasked || isDirectlyLocked ? 'rgba(25, 25, 25, 0.14)' : 'transparent',
                    }}
                  >
                    {isMasked ? (
                      <Lock size={14} color="#191919" strokeWidth={2.3} />
                    ) : isDirectlyLocked ? (
                      <LockOpen size={14} color="#191919" strokeWidth={2.2} />
                    ) : (
                      <Lock size={14} color="rgba(25, 25, 25, 0.4)" strokeWidth={2} />
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onTogglePin(note.id);
                  }}
                  hitSlop={8}
                  accessibilityLabel={isPinnedShelfCard ? 'Unpin note' : 'Toggle Pin'}
                  className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                >
                  <Pin
                    size={15}
                    color={note.isPinned ? '#191919' : 'rgba(25, 25, 25, 0.4)'}
                    fill={note.isPinned ? '#191919' : 'transparent'}
                  />
                </Pressable>

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(note.id);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Toggle Favorite"
                  className="w-7 h-7 rounded-full items-center justify-center active:scale-90"
                >
                  <Star
                    size={16}
                    color={note.isFavorite ? '#FFD43B' : 'rgba(25, 25, 25, 0.4)'}
                    fill={note.isFavorite ? '#FFD43B' : 'transparent'}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            )
          )}
        </View>

        {/* Note Title & Clean Human-Readable Preview (or Redacted Lock Shield) */}
        <View style={{ flexGrow: 1, flexShrink: 0 }} className="mb-3">
          <Text className="text-xl font-bold text-[#191919] tracking-tight mb-1.5 leading-tight">
            {note.title}
          </Text>
          {isMasked ? (
            <View className="flex-row items-center gap-2 self-start px-3 py-2 rounded-2xl bg-black/10 mt-1">
              <Shield size={15} color="#191919" strokeWidth={2.3} />
              <Text className="text-xs font-extrabold text-[#191919] tracking-tight">
                Locked
              </Text>
              <Text className="text-[11px] font-medium text-[#191919]/75">
                {note.lockType === 'custom'
                  ? 'Custom PIN/Password'
                  : 'Protected Content'}
              </Text>
            </View>
          ) : (
            <Text
              numberOfLines={3}
              className="text-sm text-[#191919]/80 leading-relaxed font-normal"
            >
              {cleanPreviewText}
            </Text>
          )}
        </View>

        {/* Contextual Match Badge (Hidden when locked so snippets cannot leak) */}
        {!isMasked && matchBadge && (
          <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111]/85 mb-3">
            {renderMatchBadgeIcon(matchBadge.iconType)}
            <Text
              numberOfLines={1}
              className="text-[11px] font-semibold text-white flex-1"
            >
              {matchBadge.label}: {matchBadge.snippet}
            </Text>
          </View>
        )}

        {/* Tag Chips (Hidden while locked) */}
        {!isMasked && note.tags && note.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-3">
            {note.tags.map((t) => (
              <View key={t} className="px-2 py-0.5 rounded-full bg-black/10">
                <Text className="text-[10px] font-bold text-[#191919]">#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bottom Row Actions */}
        <View className="flex-row items-center justify-between pt-2">
          <View className="flex-row items-center gap-2 flex-wrap flex-1 pr-2">
            <Text className="text-xs font-medium text-[#191919]/60">
              {formatNoteCardDate(note.createdAt)}
            </Text>
            {!isMasked && note.reminderAt && (
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-black/10">
                <BellRing size={10} color="#191919" />
                <Text className="text-[10px] font-bold text-[#191919]">
                  {formatReminderChip(note.reminderAt)}
                </Text>
              </View>
            )}
          </View>

          {isTrashed ? (
            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onRestoreNote(note.id);
                }}
                hitSlop={8}
                accessibilityLabel="Restore Note"
                className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-[#111111] active:scale-95 shadow-sm"
              >
                <RotateCcw size={11} color="#FFFFFF" />
                <Text className="text-[11px] font-bold text-white">Restore</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onPermanentlyDeleteNote(note.id);
                }}
                hitSlop={8}
                accessibilityLabel="Delete Permanently"
                className="p-1.5 rounded-full bg-red-600 active:scale-95"
              >
                <Trash2 size={13} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : isArchived ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onUnarchiveNote(note.id);
              }}
              hitSlop={8}
              accessibilityLabel="Unarchive Note"
              className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-[#111111] active:scale-95 shadow-sm"
            >
              <RotateCcw size={11} color="#FFFFFF" />
              <Text className="text-[11px] font-bold text-white">Unarchive</Text>
            </Pressable>
          ) : isSelectionMode ? (
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                isSelected ? 'bg-[#06B6D4]' : 'bg-black/10'
              }`}
            >
              <Check
                size={14}
                color={isSelected ? '#FFFFFF' : '#191919'}
                strokeWidth={2.5}
              />
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onOpenNote(note);
              }}
              hitSlop={8}
              accessibilityLabel="Edit Note"
              className="w-8 h-8 rounded-full bg-[#111111] items-center justify-center active:scale-95 shadow-sm"
            >
              <Pencil size={14} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
};

