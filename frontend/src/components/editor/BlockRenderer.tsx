import React from 'react';
import { View, Text, Animated } from 'react-native';
import { ComposableBlock, BlockType } from '../../types/note';
import { MoveVertical } from 'lucide-react-native';
import {
  TableBlock,
  CodeBlock,
  CalloutBlock,
  EquationBlock,
  DrawingBlock,
  AudioBlock,
  ImageBlock,
  FileBlock,
  BookmarkBlock,
  ChecklistBlock,
  HabitBlock,
  KanbanBlock,
  BulletedListBlock,
  NumberedListBlock,
  ToggleBlock,
  VideoBlock,
  NoteLinkBlock,
  LocationBlock,
  EventBlock,
  ContactBlock,
  ExpenseBlock,
  ReadingBlock,
  LectureNoteBlock,
  MessageThreadBlock,
  MeetingNotesBlock,
  SpreadsheetBlock,
  DiagramBlock,
  WebClipBlock,
  VoiceDictationBlock,
  ScanBlock,
} from './blocks';
import {
  DividerBlock,
  HeadingBlock,
  QuoteBlock,
  ParagraphBlock,
} from './components/typography';
import { useBlockTouchDrag } from './hooks/useBlockTouchDrag';

export interface BlockRendererProps {
  block: ComposableBlock;
  index: number;
  totalBlocks: number;
  isActive?: boolean;
  activePointId?: string | null;
  onFocusPoint?: (pointId: string) => void;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  dragOffsetY?: number;
  dragAnimY?: Animated.Value;
  shiftOffset?: number;
  inputRef?: (el: any) => void;
  focusSelection?: { start: number; end: number };
  onClearFocusTarget?: () => void;
  onSplitBlock?: (splitPosition: number) => void;
  onBackspaceAtStart?: () => void;
  onFocus?: () => void;
  onStartDrag?: (initialClientY?: number) => void;
  onDragMove?: (dy: number, clientY?: number) => void;
  onEndDrag?: () => void;
  onReportHeight?: (height: number) => void;
  onUpdateBlock?: (updates: Partial<ComposableBlock>) => void;
  onUpdateContent: (content: string) => void;
  onUpdateMetadata: (metadata: Record<string, any>) => void;
  onChangeType: (type: BlockType) => void;
  onConvertBlock?: (type: BlockType, content: string, metadata?: Record<string, any>) => void;
  onInsertAfter?: (type: BlockType, content: string, metadata?: Record<string, any>) => void;
  onReplaceBlockWithBlocks?: (blocks: { type: BlockType; content: string; metadata?: Record<string, any> }[]) => void;
  onDelete: () => void;
  onEnterPress?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isActive,
  activePointId,
  onFocusPoint,
  isDragging = false,
  isAnyDragging = false,
  dragOffsetY = 0,
  dragAnimY,
  shiftOffset = 0,
  inputRef,
  focusSelection,
  onClearFocusTarget,
  onSplitBlock,
  onBackspaceAtStart,
  onFocus,
  onStartDrag,
  onDragMove,
  onEndDrag,
  onReportHeight,
  onUpdateBlock,
  onUpdateContent,
  onUpdateMetadata,
  onChangeType,
  onConvertBlock,
  onInsertAfter,
  onReplaceBlockWithBlocks,
  onDelete,
}) => {
  // 1. Divider Block (Continuous line, no enclosing card or drag container)
  if (block.type === 'divider') {
    return (
      <DividerBlock
        blockId={block.id}
        isAnyDragging={isAnyDragging}
        onDelete={onDelete}
      />
    );
  }

  // 2. Gesture and Drag State Hook (Mobile PanResponder + Web Pointer tracking)
  const {
    dragContainerStyle,
    touchHandlers,
    gestureHandlers,
    handleStartDragFromChild,
  } = useBlockTouchDrag({
    blockType: block.type,
    isActive,
    isDragging,
    isAnyDragging,
    dragOffsetY,
    dragAnimY,
    shiftOffset,
    onStartDrag,
    onDragMove,
    onEndDrag,
    onFocus,
  });

  return (
    <Animated.View
      pointerEvents={isAnyDragging ? (isDragging ? 'auto' : 'none') : 'auto'}
      nativeID={`scribex-block-${block.id}`}
      id={`scribex-block-${block.id}`}
      dataSet={{ scribexBlockId: block.id }}
      {...({ 'data-scribex-block-id': block.id } as any)}
      onLayout={(e) => onReportHeight?.(e.nativeEvent.layout.height)}
      style={dragContainerStyle}
      className="my-0.5 group relative rounded-2xl"
      {...touchHandlers}
      {...gestureHandlers}
    >
      {/* Floating Dragging Indicator Badge */}
      {isDragging && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -14, left: 12, zIndex: 1000 }}
          className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-note-cyan shadow-md"
        >
          <MoveVertical size={11} color="#000000" strokeWidth={2.5} />
          <Text className="text-[10px] font-black text-black tracking-wider uppercase">
            Dragging • Move to reorder
          </Text>
        </View>
      )}

      {/* Typography: Heading Block */}
      {block.type === 'heading' && (
        <HeadingBlock
          block={block}
          isActive={isActive}
          isDragging={isDragging}
          inputRef={inputRef}
          focusSelection={focusSelection}
          onClearFocusTarget={onClearFocusTarget}
          onSplitBlock={onSplitBlock}
          onBackspaceAtStart={onBackspaceAtStart}
          onFocus={onFocus}
          onUpdateContent={onUpdateContent}
          onConvertBlock={onConvertBlock}
        />
      )}

      {/* Checklist Container Block */}
      {block.type === 'checklist' && (
        <ChecklistBlock
          items={
            Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
              ? block.metadata.items
              : block.content
              ? [
                  {
                    id: block.metadata?.taskId || block.id,
                    text: block.content,
                    checked: !!block.metadata?.checked,
                    priority: block.metadata?.priority || 'none',
                    dueDate: block.metadata?.dueDate || 'Today',
                    style: 'paragraph',
                  },
                ]
              : [
                  {
                    id: `task-${Date.now()}-1`,
                    text: '',
                    checked: false,
                    priority: 'none',
                    dueDate: 'Today',
                    style: 'paragraph',
                  },
                ]
          }
          isSelected={isActive}
          activeItemId={activePointId}
          onFocusItem={onFocusPoint}
          onUpdateItems={(items) => {
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: { ...block.metadata, items },
                content: items.map((i) => i.text).join('\n'),
              });
            } else {
              onUpdateMetadata({ ...block.metadata, items });
              onUpdateContent(items.map((i) => i.text).join('\n'));
            }
          }}
          onFocus={onFocus}
          isDragging={isDragging}
          onStartDrag={handleStartDragFromChild}
          onBackspaceAtStart={onBackspaceAtStart}
          onDelete={onDelete}
        />
      )}

      {/* Bulleted List Block */}
      {block.type === 'bulleted_list' && (
        <BulletedListBlock
          items={block.metadata?.items}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateItems={(items) => {
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: { ...block.metadata, items },
                content: items.map((i) => i.text).join('\n'),
              });
            } else {
              onUpdateMetadata({ ...block.metadata, items });
              onUpdateContent(items.map((i) => i.text).join('\n'));
            }
          }}
          onUpdateContent={onUpdateContent}
        />
      )}

      {/* Habit Tracker Block */}
      {block.type === 'habit' && (
        <HabitBlock
          title={block.metadata?.title || block.content || ''}
          frequency={block.metadata?.frequency || 'daily'}
          streak={block.metadata?.streak ?? 0}
          targetDays={block.metadata?.targetDays ?? 7}
          history={block.metadata?.history || {}}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateHabit={(updates) => {
            const nextMeta = { ...block.metadata, ...updates };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: updates.title !== undefined ? updates.title : block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (updates.title !== undefined) {
                onUpdateContent(updates.title);
              }
            }
          }}
        />
      )}

      {/* In-Note Kanban Board Block */}
      {block.type === 'kanban' && (
        <KanbanBlock
          metadata={block.metadata as any}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateKanban={(kanbanData) => {
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: kanbanData as any,
                content: 'Kanban Board',
              });
            } else {
              onUpdateMetadata(kanbanData as any);
              onUpdateContent('Kanban Board');
            }
          }}
        />
      )}

      {/* Numbered List Block */}
      {block.type === 'numbered_list' && (
        <NumberedListBlock
          items={block.metadata?.items}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateItems={(items) => {
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: { ...block.metadata, items },
                content: items.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n'),
              });
            } else {
              onUpdateMetadata({ ...block.metadata, items });
              onUpdateContent(items.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n'));
            }
          }}
          onUpdateContent={onUpdateContent}
        />
      )}

      {/* Toggle Block */}
      {block.type === 'toggle' && (
        <ToggleBlock
          title={block.metadata?.title || 'Toggle Section'}
          content={block.content}
          isOpen={block.metadata?.isOpen ?? false}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateTitle={(title) => onUpdateMetadata({ ...block.metadata, title })}
          onUpdateContent={onUpdateContent}
          onUpdateIsOpen={(isOpen) => onUpdateMetadata({ ...block.metadata, isOpen })}
        />
      )}

      {/* Code Block */}
      {block.type === 'code' && (
        <CodeBlock
          code={block.content}
          language={block.metadata?.language || 'typescript'}
          fileName={block.metadata?.fileName || ''}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateCode={onUpdateContent}
          onUpdateLanguage={(language) => onUpdateMetadata({ ...block.metadata, language })}
          onUpdateFileName={(fileName) => onUpdateMetadata({ ...block.metadata, fileName })}
        />
      )}

      {/* Typography: Blockquote */}
      {block.type === 'quote' && (
        <QuoteBlock
          block={block}
          isActive={isActive}
          isDragging={isDragging}
          inputRef={inputRef}
          focusSelection={focusSelection}
          onClearFocusTarget={onClearFocusTarget}
          onSplitBlock={onSplitBlock}
          onBackspaceAtStart={onBackspaceAtStart}
          onFocus={onFocus}
          onUpdateContent={onUpdateContent}
          onConvertBlock={onConvertBlock}
        />
      )}

      {/* Table Block */}
      {block.type === 'table' && (
        <TableBlock
          columns={block.metadata?.columns || ['Header 1', 'Header 2']}
          rows={block.metadata?.rows || [['', '']]}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateTable={(columns, rows) => {
            const header = `| ${columns.join(' | ')} |`;
            const sep = `| ${columns.map(() => '---').join(' | ')} |`;
            const rowLines = rows.map((r) => `| ${r.join(' | ')} |`);
            const content = [header, sep, ...rowLines].join('\n');
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: { ...block.metadata, columns, rows },
                content,
              });
            } else {
              onUpdateMetadata({ ...block.metadata, columns, rows });
              onUpdateContent(content);
            }
          }}
        />
      )}

      {/* Callout Block */}
      {block.type === 'callout' && (
        <CalloutBlock
          content={block.content}
          variant={block.metadata?.variant || 'info'}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateContent={onUpdateContent}
          onUpdateVariant={(variant) => onUpdateMetadata({ ...block.metadata, variant })}
        />
      )}

      {/* Equation Block */}
      {block.type === 'equation' && (
        <EquationBlock
          latex={block.content}
          displayMode={block.metadata?.displayMode ?? true}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateLatex={onUpdateContent}
          onUpdateDisplayMode={(displayMode) => onUpdateMetadata({ ...block.metadata, displayMode })}
        />
      )}

      {/* Drawing Block */}
      {block.type === 'drawing' && (
        <DrawingBlock
          initialPaths={block.metadata?.paths || []}
          caption={block.metadata?.caption || block.metadata?.title || ''}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateDrawing={(paths, caption) => {
            const nextCaption = caption !== undefined ? caption : (block.metadata?.caption || block.metadata?.title || '');
            onUpdateMetadata({ ...block.metadata, paths, caption: nextCaption, title: nextCaption || 'Sketch' });
            onUpdateContent(JSON.stringify(paths));
          }}
          onUpdateCaption={(caption) => {
            onUpdateMetadata({ ...block.metadata, caption, title: caption || 'Sketch' });
          }}
        />
      )}

      {/* Audio Block */}
      {block.type === 'audio' && (
        <AudioBlock
          audioUrl={block.content || block.metadata?.url}
          assetId={block.metadata?.assetId}
          title={block.metadata?.title || ''}
          caption={block.metadata?.caption || block.metadata?.title || ''}
          durationSec={block.metadata?.durationSec ?? 0}
          transcription={block.metadata?.transcription || ''}
          waveform={block.metadata?.waveform}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateContent={onUpdateContent}
          onUpdateMetadata={(meta) => {
            onUpdateMetadata({ ...block.metadata, ...meta });
          }}
          onInsertAfter={onInsertAfter}
        />
      )}

      {/* Image Embed Block */}
      {block.type === 'image' && (
        <ImageBlock
          url={block.content || block.metadata?.url}
          caption={block.metadata?.caption || ''}
          width={block.metadata?.width || '100%'}
          align={block.metadata?.align || 'center'}
          aspectRatio={block.metadata?.aspectRatio || 'natural'}
          isSelected={isActive}
          isDragging={isDragging}
          onUpdateImage={(url, caption, width, align, aspectRatio) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, caption, width, align, aspectRatio });
          }}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
          onDelete={onDelete}
        />
      )}

      {/* File Attachment Block */}
      {block.type === 'file' && (
        <FileBlock
          fileName={block.metadata?.fileName || 'Attachment.pdf'}
          sizeBytes={block.metadata?.sizeBytes || 1845600}
          url={block.content || block.metadata?.url || '#'}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateFile={(fileName, sizeBytes, url) => {
            if (url) onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, fileName, sizeBytes, url });
          }}
        />
      )}

      {/* Video Embed Block */}
      {block.type === 'video' && (
        <VideoBlock
          url={block.content || block.metadata?.url}
          caption={block.metadata?.caption || ''}
          width={block.metadata?.width || '100%'}
          align={block.metadata?.align || 'center'}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateVideo={(url, caption, width, align) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, caption, width, align });
          }}
        />
      )}

      {/* Note Link Block */}
      {block.type === 'note_link' && (
        <NoteLinkBlock
          targetNoteId={block.metadata?.targetNoteId || block.content}
          targetNoteTitle={block.metadata?.targetNoteTitle}
          targetColorToken={block.metadata?.targetColorToken}
          targetFolder={block.metadata?.targetFolder}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateLink={(targetNoteId, targetNoteTitle, targetColorToken, targetFolder) => {
            onUpdateContent(targetNoteId);
            onUpdateMetadata({
              ...block.metadata,
              targetNoteId,
              targetNoteTitle,
              targetColorToken,
              targetFolder,
            });
          }}
        />
      )}

      {/* Location Block */}
      {block.type === 'location' && (
        <LocationBlock
          placeName={block.metadata?.placeName || block.content}
          address={block.metadata?.address}
          lat={block.metadata?.lat}
          lng={block.metadata?.lng}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateLocation={(placeName, address, lat, lng) => {
            onUpdateContent(placeName);
            onUpdateMetadata({
              ...block.metadata,
              placeName,
              address,
              lat,
              lng,
            });
          }}
        />
      )}

      {/* Date & Event Block */}
      {block.type === 'event' && (
        <EventBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateEvent={(eventData) => {
            const nextMeta = { ...block.metadata, ...eventData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: eventData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (eventData.title) onUpdateContent(eventData.title);
            }
          }}
        />
      )}

      {/* Contact / Person Profile Block */}
      {block.type === 'contact' && (
        <ContactBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateContact={(contactData) => {
            const nextMeta = { ...block.metadata, ...contactData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: contactData.name || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (contactData.name) onUpdateContent(contactData.name);
            }
          }}
        />
      )}

      {/* Expense / Financial Record Block */}
      {block.type === 'expense' && (
        <ExpenseBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateExpense={(expenseData) => {
            const nextMeta = { ...block.metadata, ...expenseData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: expenseData.merchant || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (expenseData.merchant) onUpdateContent(expenseData.merchant);
            }
          }}
        />
      )}

      {/* Reading List / Book Progress Block */}
      {block.type === 'reading' && (
        <ReadingBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateReading={(readingData) => {
            const nextMeta = { ...block.metadata, ...readingData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: readingData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (readingData.title) onUpdateContent(readingData.title);
            }
          }}
        />
      )}

      {/* Video / Lecture Notes Block */}
      {block.type === 'lecture_note' && (
        <LectureNoteBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateLecture={(lectureData) => {
            const nextMeta = { ...block.metadata, ...lectureData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: lectureData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (lectureData.title) onUpdateContent(lectureData.title);
            }
          }}
        />
      )}

      {/* Email & Message Thread Block */}
      {block.type === 'message_thread' && (
        <MessageThreadBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateThread={(threadData) => {
            const nextMeta = { ...block.metadata, ...threadData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: threadData.subject || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (threadData.subject) onUpdateContent(threadData.subject);
            }
          }}
        />
      )}

      {/* Meeting Notes & Diarized Minutes Block */}
      {block.type === 'meeting_notes' && (
        <MeetingNotesBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateMeeting={(meetingData) => {
            const nextMeta = { ...block.metadata, ...meetingData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: meetingData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (meetingData.title) onUpdateContent(meetingData.title);
            }
          }}
        />
      )}

      {/* Multi-Sheet Spreadsheet Block */}
      {block.type === 'sheet' && (
        <SpreadsheetBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateSheet={(sheetData) => {
            const nextMeta = { ...block.metadata, ...sheetData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: sheetData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (sheetData.title) onUpdateContent(sheetData.title);
            }
          }}
        />
      )}

      {/* Diagram & Whiteboard Block */}
      {block.type === 'diagram' && (
        <DiagramBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateDiagram={(diagramData) => {
            const nextMeta = { ...block.metadata, ...diagramData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: diagramData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (diagramData.title) onUpdateContent(diagramData.title);
            }
          }}
        />
      )}

      {/* Web Article Clip & Reader Block */}
      {block.type === 'web_clip' && (
        <WebClipBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateWebClip={(clipData) => {
            const nextMeta = { ...block.metadata, ...clipData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: clipData.title || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (clipData.title) onUpdateContent(clipData.title);
            }
          }}
        />
      )}

      {/* Voice-to-Text Dictation Block */}
      {block.type === 'voice_dictation' && (
        <VoiceDictationBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateDictation={(dictationData) => {
            const nextMeta = { ...block.metadata, ...dictationData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: dictationData.transcript || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (dictationData.transcript) onUpdateContent(dictationData.transcript);
            }
          }}
          onConvertToText={(text) => {
            if (onConvertBlock) {
              onConvertBlock('paragraph', text);
            }
          }}
        />
      )}

      {/* Document Scan & OCR Block */}
      {block.type === 'scan' && (
        <ScanBlock
          metadata={block.metadata}
          content={block.content}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateScan={(scanData) => {
            const nextMeta = { ...block.metadata, ...scanData };
            if (onUpdateBlock) {
              onUpdateBlock({
                metadata: nextMeta,
                content: scanData.ocrText || block.content,
              });
            } else {
              onUpdateMetadata(nextMeta);
              if (scanData.ocrText) onUpdateContent(scanData.ocrText);
            }
          }}
          onConvertToText={(text) => {
            if (onConvertBlock) {
              onConvertBlock('paragraph', text);
            }
          }}
        />
      )}

      {/* Bookmark Block */}
      {block.type === 'bookmark' && (
        <BookmarkBlock
          url={block.content || block.metadata?.url || 'https://reactnative.dev'}
          title={block.metadata?.title}
          description={block.metadata?.description}
          previewUrl={block.metadata?.previewUrl}
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onDelete={onDelete}
          onStartDrag={handleStartDragFromChild}
          onUpdateBookmark={(url, title, description, previewUrl) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, title, description, previewUrl });
          }}
        />
      )}

      {/* Typography: Standard Paragraph */}
      {block.type === 'paragraph' && (
        <ParagraphBlock
          block={block}
          isActive={isActive}
          isDragging={isDragging}
          inputRef={inputRef}
          focusSelection={focusSelection}
          onClearFocusTarget={onClearFocusTarget}
          onSplitBlock={onSplitBlock}
          onBackspaceAtStart={onBackspaceAtStart}
          onFocus={onFocus}
          onUpdateContent={onUpdateContent}
          onConvertBlock={onConvertBlock}
          onInsertAfter={onInsertAfter}
          onReplaceBlockWithBlocks={onReplaceBlockWithBlocks}
        />
      )}
    </Animated.View>
  );
};
