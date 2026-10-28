import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, TextInput, Pressable, Text, Platform } from 'react-native';
import { ComposableBlock, BlockType } from '../../types/note';
import { useTheme } from '../../theme';
import { Trash2, MoveVertical } from 'lucide-react-native';
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
  ChecklistBlock
} from './blocks';
import { UniversalBlockWrapper } from './UniversalBlockWrapper';

interface BlockRendererProps {
  block: ComposableBlock;
  index: number;
  totalBlocks: number;
  isActive?: boolean;
  activePointId?: string | null;
  onFocusPoint?: (pointId: string) => void;
  isDragging?: boolean;
  dragOffsetY?: number;
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
  onDelete: () => void;
  onEnterPress?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  totalBlocks,
  isActive,
  activePointId,
  onFocusPoint,
  isDragging = false,
  dragOffsetY = 0,
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
  onDelete,
  onEnterPress,
}) => {
  const { isDark } = useTheme();

  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const onStartDragRef = useRef(onStartDrag);
  onStartDragRef.current = onStartDrag;
  const onDragMoveRef = useRef(onDragMove);
  onDragMoveRef.current = onDragMove;
  const onEndDragRef = useRef(onEndDrag);
  onEndDragRef.current = onEndDrag;

  const activeCleanupRef = useRef<(() => void) | null>(null);

  const localInputRef = useRef<any>(null);

  const adjustWebTextareaHeight = (el: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const domEl = (el && el.tagName === 'TEXTAREA') ? el : el?.querySelector?.('textarea') || el;
    if (!domEl || !domEl.style) return;

    const apply = () => {
      try {
        (domEl.style as any).fieldSizing = 'content';
        domEl.style.overflow = 'hidden';
        domEl.style.resize = 'none';
        if ('rows' in domEl) {
          domEl.rows = 1;
        }

        domEl.style.height = 'auto';
        const scrollH = domEl.scrollHeight;
        if (scrollH > 0) {
          domEl.style.height = `${scrollH}px`;
        }
      } catch (err) {
        // ignore
      }
    };

    apply();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(apply);
    }
  };

  const setInputRef = (el: any) => {
    localInputRef.current = el;
    inputRef?.(el);
    if (el) {
      adjustWebTextareaHeight(el);
    }
  };

  useEffect(() => {
    adjustWebTextareaHeight(localInputRef.current);
  }, [block.content]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleResize = () => {
      adjustWebTextareaHeight(localInputRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
        activeCleanupRef.current = null;
      }
    };
  }, []);

  // Direct element long-press drag handler for Web
  const handleBlockPointerDown = (e: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Only handle primary button (left mouse click)
    if (e.button !== undefined && e.button !== 0) return;

    // Do NOT drag if clicking directly on a text input or textarea
    const targetTag = e.target?.tagName?.toUpperCase?.() || '';
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
      return;
    }

    const startX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const startY = e.clientY ?? e.nativeEvent?.clientY ?? 0;

    let isDragActive = false;
    let longPressTimer: any = null;

    if (activeCleanupRef.current) {
      activeCleanupRef.current();
      activeCleanupRef.current = null;
    }

    // Start 240ms timer for long press
    longPressTimer = setTimeout(() => {
      isDragActive = true;
      onStartDragRef.current?.(startY);
    }, 240);

    const onPointerMove = (moveEvt: MouseEvent | PointerEvent) => {
      const currentX = moveEvt.clientX ?? (moveEvt as any).pageX ?? 0;
      const currentY = moveEvt.clientY ?? (moveEvt as any).pageY ?? 0;
      const dx = currentX - startX;
      const dy = currentY - startY;

      if (!isDragActive) {
        if (Math.hypot(dx, dy) > 6) {
          clearTimeout(longPressTimer);
        }
      } else {
        moveEvt.preventDefault();
        onDragMoveRef.current?.(dy, currentY);
      }
    };

    const cleanup = () => {
      clearTimeout(longPressTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      activeCleanupRef.current = null;
    };

    const onPointerUp = (upEvt: MouseEvent | PointerEvent) => {
      cleanup();
      if (isDragActive) {
        upEvt.preventDefault();
        onEndDragRef.current?.();
      } else {
        onFocus?.();
      }
    };

    activeCleanupRef.current = cleanup;

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp, { passive: false });
  };



  // 1. Divider Block (Continuous line, no enclosing card)
  if (block.type === 'divider') {
    return (
      <View 
        nativeID={`scribex-block-${block.id}`}
        id={`scribex-block-${block.id}`}
        dataSet={{ scribexBlockId: block.id }}
        {...({ 'data-scribex-block-id': block.id } as any)}
        className="my-6 py-2 flex-row items-center justify-between group"
      >
        <View className="flex-1 h-[1px] bg-light-border/80 dark:bg-dark-border/80" />
        <Pressable
          onPress={onDelete}
          accessibilityLabel="Delete Divider"
          style={({ pressed }) => pressed ? { transform: [{ scale: 0.9 }] } : undefined}
          className="ml-2 p-1 rounded-full opacity-40 hover:opacity-100"
        >
          <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
        </Pressable>
      </View>
    );
  }

  return (
    <View 
      nativeID={`scribex-block-${block.id}`}
      id={`scribex-block-${block.id}`}
      dataSet={{ scribexBlockId: block.id }}
      {...({ 'data-scribex-block-id': block.id } as any)}
      onLayout={(e) => onReportHeight?.(e.nativeEvent.layout.height)}
      style={isDragging ? { transform: [{ translateY: dragOffsetY }, { scale: 1.02 }], zIndex: 999 } : undefined}
      className={`my-0.5 group relative ${
        isDragging
          ? 'border-2 border-note-cyan bg-light-appBg/95 dark:bg-[#1E1E22]/95 shadow-2xl ring-4 ring-note-cyan/20 rounded-2xl p-2.5 opacity-95 my-2'
          : ''
      }`}
      {...(Platform.OS === 'web'
        ? ({
            onPointerDown: handleBlockPointerDown,
            onMouseDown: handleBlockPointerDown,
          } as any)
        : {})}
    >
      {/* Floating Dragging Badge */}
      {isDragging && (
        <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-note-cyan self-start mb-2 shadow-sm">
          <MoveVertical size={11} color="#000000" strokeWidth={2.5} />
          <Text className="text-[10px] font-black text-black tracking-wider uppercase">
            Dragging • Move to reorder
          </Text>
        </View>
      )}
      {/* 2. Heading Block (Pure Typography, No Border) */}
      {block.type === 'heading' && (
        <View className={`pl-2.5 border-l-2 ${isActive && !isDragging ? 'border-note-cyan/80' : 'border-transparent'}`}>
          <TextInput
            ref={setInputRef}
          multiline
          scrollEnabled={false}
          placeholder={`Heading ${block.metadata?.level || 1}...`}
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          value={block.content}
          onChangeText={(text) => {
            onUpdateContent(text);
            adjustWebTextareaHeight(localInputRef.current);
          }}
          onFocus={() => {
            onFocus?.();
            adjustWebTextareaHeight(localInputRef.current);
          }}
          selection={focusSelection}
          onSelectionChange={(e) => {
            selectionRef.current = e.nativeEvent.selection;
            if (focusSelection) onClearFocusTarget?.();
          }}
          onKeyPress={(e: any) => {
            const key = e.nativeEvent.key;
            if (key === 'Enter' && !e.shiftKey) {
              e.preventDefault?.();
              onSplitBlock?.(selectionRef.current.start);
            } else if (key === 'Backspace') {
              if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
                e.preventDefault?.();
                onBackspaceAtStart?.();
              }
            }
          }}
          onSubmitEditing={() => onSplitBlock?.(selectionRef.current.start)}
          className={`font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight py-1 outline-none ${
            block.metadata?.level === 1 
              ? 'text-2xl md:text-3xl mt-4 mb-1' 
              : block.metadata?.level === 2 
              ? 'text-xl md:text-2xl mt-3 mb-1' 
              : 'text-lg md:text-xl mt-2 mb-0.5'
          }`}
        />
        </View>
      )}

      {/* 3. Checklist Container Block (Multi-point checklist unit) */}
      {block.type === 'checklist' && (
        <ChecklistBlock
          items={
            Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
              ? block.metadata.items
              : block.content
              ? [{ id: block.metadata?.taskId || block.id, text: block.content, checked: !!block.metadata?.checked, priority: block.metadata?.priority || 'none', dueDate: block.metadata?.dueDate || 'Today', style: 'paragraph' }]
              : [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today', style: 'paragraph' }]
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
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          onBackspaceAtStart={onBackspaceAtStart}
          onDelete={onDelete}
        />
      )}

      {/* 4. Code Block */}
      {block.type === 'code' && (
        <UniversalBlockWrapper
          blockType="code"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          noPadding
        >
          <CodeBlock
            code={block.content}
            language={block.metadata?.language || 'typescript'}
            fileName={block.metadata?.fileName || ''}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateCode={onUpdateContent}
            onUpdateLanguage={(language) => onUpdateMetadata({ ...block.metadata, language })}
            onUpdateFileName={(fileName) => onUpdateMetadata({ ...block.metadata, fileName })}
          />
        </UniversalBlockWrapper>
      )}

      {/* 5. Blockquote (Editorial Quote, Lavender accent bar) */}
      {block.type === 'quote' && (
        <View className={`pl-4 border-l-4 ${isActive && !isDragging ? 'border-note-cyan shadow-sm' : 'border-note-lavender'} py-1 my-1`}>
          <TextInput
            ref={setInputRef}
            multiline
            scrollEnabled={false}
            placeholder="Quote or reference text..."
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            value={block.content}
            onChangeText={(text) => {
              onUpdateContent(text);
              adjustWebTextareaHeight(localInputRef.current);
            }}
            onFocus={() => {
              onFocus?.();
              adjustWebTextareaHeight(localInputRef.current);
            }}
            selection={focusSelection}
            onSelectionChange={(e) => {
              selectionRef.current = e.nativeEvent.selection;
              if (focusSelection) onClearFocusTarget?.();
            }}
            onKeyPress={(e: any) => {
              const key = e.nativeEvent.key;
              if (key === 'Backspace') {
                if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
                  e.preventDefault?.();
                  onBackspaceAtStart?.();
                }
              } else if (key === 'Enter') {
                const curPos = selectionRef.current.start;
                const textBefore = block.content.slice(0, curPos);
                if (textBefore.endsWith('\n') || (block.content === '' && curPos === 0)) {
                  e.preventDefault?.();
                  const cleanedBefore = textBefore.endsWith('\n') ? textBefore.slice(0, -1) : textBefore;
                  onUpdateContent(cleanedBefore + block.content.slice(curPos));
                  onSplitBlock?.(cleanedBefore.length);
                }
              }
            }}
            className="text-base md:text-lg italic text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0 outline-none"
          />
        </View>
      )}

      {/* 6. Table Block */}
      {block.type === 'table' && (
        <UniversalBlockWrapper
          blockType="table"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
        >
          <TableBlock
            columns={block.metadata?.columns || ['Header 1', 'Header 2']}
            rows={block.metadata?.rows || [['', '']]}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateTable={(columns, rows) => {
              onUpdateMetadata({ ...block.metadata, columns, rows });
              const header = `| ${columns.join(' | ')} |`;
              const sep = `| ${columns.map(() => '---').join(' | ')} |`;
              const rowLines = rows.map(r => `| ${r.join(' | ')} |`);
              onUpdateContent([header, sep, ...rowLines].join('\n'));
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* 7. Callout Block */}
      {block.type === 'callout' && (
        <UniversalBlockWrapper
          blockType="callout"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
        >
          <CalloutBlock
            content={block.content}
            variant={block.metadata?.variant || 'info'}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateContent={onUpdateContent}
            onUpdateVariant={(variant) => onUpdateMetadata({ ...block.metadata, variant })}
          />
        </UniversalBlockWrapper>
      )}

      {/* 8. Equation Block */}
      {block.type === 'equation' && (
        <UniversalBlockWrapper
          blockType="equation"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          noPadding
        >
          <EquationBlock
            latex={block.content}
            displayMode={block.metadata?.displayMode ?? true}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateLatex={onUpdateContent}
            onUpdateDisplayMode={(displayMode) => onUpdateMetadata({ ...block.metadata, displayMode })}
          />
        </UniversalBlockWrapper>
      )}

      {/* 9. Drawing Block */}
      {block.type === 'drawing' && (
        <UniversalBlockWrapper
          blockType="drawing"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          noPadding
        >
          <DrawingBlock
            initialPaths={block.metadata?.paths || []}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateDrawing={(paths) => {
              onUpdateMetadata({ ...block.metadata, paths });
              onUpdateContent(JSON.stringify(paths));
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* 10. Audio Block */}
      {block.type === 'audio' && (
        <UniversalBlockWrapper
          blockType="audio"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
        >
          <AudioBlock
            assetId={block.metadata?.assetId}
            durationSec={block.metadata?.durationSec || 94}
            transcription={block.metadata?.transcription || ''}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateMetadata={(meta) => {
              onUpdateMetadata({ ...block.metadata, ...meta });
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* 11. Image / Video Resizable Embed Block */}
      {block.type === 'image' && (
        <ImageBlock
          url={block.content || block.metadata?.url}
          caption={block.metadata?.caption || ''}
          width={block.metadata?.width || '100%'}
          align={block.metadata?.align || 'center'}
          aspectRatio={block.metadata?.aspectRatio || 'natural'}
          isSelected={isActive}
          onUpdateImage={(url, caption, width, align, aspectRatio) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, caption, width, align, aspectRatio });
          }}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          onDelete={onDelete}
        />
      )}

      {/* 12. File Attachment Block */}
      {block.type === 'file' && (
        <UniversalBlockWrapper
          blockType="file"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
        >
          <FileBlock
            fileName={block.metadata?.fileName || 'Attachment.pdf'}
            sizeBytes={block.metadata?.sizeBytes || 1845600}
            url={block.content || block.metadata?.url || '#'}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateFile={(fileName, sizeBytes, url) => {
              if (url) onUpdateContent(url);
              onUpdateMetadata({ ...block.metadata, fileName, sizeBytes, url });
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* 13. Bookmark Block */}
      {block.type === 'bookmark' && (
        <UniversalBlockWrapper
          blockType="bookmark"
          isSelected={isActive}
          onFocus={onFocus}
          onLongPress={onStartDrag}
          onEndDrag={onEndDrag}
          noPadding
        >
          <BookmarkBlock
            url={block.content || block.metadata?.url || 'https://reactnative.dev'}
            title={block.metadata?.title}
            description={block.metadata?.description}
            previewUrl={block.metadata?.previewUrl}
            onFocus={onFocus}
            onDelete={onDelete}
            onUpdateBookmark={(url, title, description, previewUrl) => {
              onUpdateContent(url);
              onUpdateMetadata({ ...block.metadata, url, title, description, previewUrl });
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* 14. Standard Continuous Paragraph (Pure Text Sheet) */}
      {block.type === 'paragraph' && (
        <View className={`pl-2.5 border-l-2 ${isActive && !isDragging ? 'border-note-cyan/80' : 'border-transparent'}`}>
          <TextInput
            ref={setInputRef}
          multiline
          scrollEnabled={false}
          placeholder="Start typing your story or use floating dock below..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          value={block.content}
          onChangeText={(text) => {
            onUpdateContent(text);
            adjustWebTextareaHeight(localInputRef.current);
          }}
          onFocus={() => {
            onFocus?.();
            adjustWebTextareaHeight(localInputRef.current);
          }}
          selection={focusSelection}
          onSelectionChange={(e) => {
            selectionRef.current = e.nativeEvent.selection;
            if (focusSelection) onClearFocusTarget?.();
          }}
          onKeyPress={(e: any) => {
            const key = e.nativeEvent.key;
            if (key === 'Backspace') {
              if (selectionRef.current.start === 0 && selectionRef.current.end === 0) {
                e.preventDefault?.();
                onBackspaceAtStart?.();
              }
            } else if (key === 'Enter') {
              // Pressing Enter on an empty line (Double Enter) splits into a new block.
              // A single Enter naturally inserts a cohesive newline (\n) within the same paragraph!
              const curPos = selectionRef.current.start;
              const textBefore = block.content.slice(0, curPos);
              if (textBefore.endsWith('\n') || (block.content === '' && curPos === 0)) {
                e.preventDefault?.();
                const cleanedBefore = textBefore.endsWith('\n') ? textBefore.slice(0, -1) : textBefore;
                onUpdateContent(cleanedBefore + block.content.slice(curPos));
                onSplitBlock?.(cleanedBefore.length);
              }
            }
          }}
          className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-0.5 outline-none"
        />
        </View>
      )}
    </View>
  );
};
