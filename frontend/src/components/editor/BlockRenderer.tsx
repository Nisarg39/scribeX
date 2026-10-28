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
} from './blocks';
import { UniversalBlockWrapper } from './UniversalBlockWrapper';
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

      {/* Code Block */}
      {block.type === 'code' && (
        <UniversalBlockWrapper
          blockType="code"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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
        />
      )}

      {/* Table Block */}
      {block.type === 'table' && (
        <UniversalBlockWrapper
          blockType="table"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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
              const rowLines = rows.map((r) => `| ${r.join(' | ')} |`);
              onUpdateContent([header, sep, ...rowLines].join('\n'));
            }}
          />
        </UniversalBlockWrapper>
      )}

      {/* Callout Block */}
      {block.type === 'callout' && (
        <UniversalBlockWrapper
          blockType="callout"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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

      {/* Equation Block */}
      {block.type === 'equation' && (
        <UniversalBlockWrapper
          blockType="equation"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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

      {/* Drawing Block */}
      {block.type === 'drawing' && (
        <UniversalBlockWrapper
          blockType="drawing"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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

      {/* Audio Block */}
      {block.type === 'audio' && (
        <UniversalBlockWrapper
          blockType="audio"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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
        <UniversalBlockWrapper
          blockType="file"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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

      {/* Bookmark Block */}
      {block.type === 'bookmark' && (
        <UniversalBlockWrapper
          blockType="bookmark"
          isSelected={isActive}
          isDragging={isDragging}
          onFocus={onFocus}
          onStartDrag={handleStartDragFromChild}
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
        />
      )}
    </Animated.View>
  );
};
