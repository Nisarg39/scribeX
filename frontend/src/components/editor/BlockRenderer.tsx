import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { ComposableBlock, BlockType } from '../../types/note';
import { useTheme } from '../../theme';
import { Trash2 } from 'lucide-react-native';
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

interface BlockRendererProps {
  block: ComposableBlock;
  index: number;
  totalBlocks: number;
  isActive?: boolean;
  onFocus?: () => void;
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
  onFocus,
  onUpdateContent,
  onUpdateMetadata,
  onChangeType,
  onDelete,
  onEnterPress,
}) => {
  const { isDark } = useTheme();

  // 1. Divider Block (Continuous line, no enclosing card)
  if (block.type === 'divider') {
    return (
      <View className="my-6 py-2 flex-row items-center justify-between group">
        <View className="flex-1 h-[1px] bg-light-border/80 dark:bg-dark-border/80" />
        <Pressable
          onPress={onDelete}
          accessibilityLabel="Delete Divider"
          className="ml-2 p-1 rounded-full opacity-30 hover:opacity-100 active:scale-90"
        >
          <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="my-1 group relative">
      {/* 2. Heading Block (Pure Typography, No Border) */}
      {block.type === 'heading' && (
        <TextInput
          multiline
          placeholder={`Heading ${block.metadata?.level || 1}...`}
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          value={block.content}
          onChangeText={onUpdateContent}
          onFocus={onFocus}
          onSubmitEditing={onEnterPress}
          className={`font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight py-1 outline-none ${
            block.metadata?.level === 1 
              ? 'text-2xl md:text-3xl mt-4 mb-1' 
              : block.metadata?.level === 2 
              ? 'text-xl md:text-2xl mt-3 mb-1' 
              : 'text-lg md:text-xl mt-2 mb-0.5'
          }`}
        />
      )}

      {/* 3. Checklist Container Block (Multi-point checklist unit) */}
      {block.type === 'checklist' && (
        <ChecklistBlock
          items={
            Array.isArray(block.metadata?.items) && block.metadata.items.length > 0
              ? block.metadata.items
              : block.content
              ? [{ id: block.metadata?.taskId || block.id, text: block.content, checked: !!block.metadata?.checked, priority: block.metadata?.priority || 'none', dueDate: block.metadata?.dueDate || 'Today' }]
              : [{ id: `task-${Date.now()}-1`, text: '', checked: false, priority: 'none', dueDate: 'Today' }]
          }
          onUpdateItems={(items) => {
            onUpdateMetadata({ ...block.metadata, items });
            onUpdateContent(items.map((i) => i.text).join('\n'));
          }}
          onFocus={onFocus}
          onDelete={onDelete}
        />
      )}

      {/* 4. Code Block */}
      {block.type === 'code' && (
        <CodeBlock
          code={block.content}
          language={block.metadata?.language || 'typescript'}
          fileName={block.metadata?.fileName || ''}
          onUpdateCode={onUpdateContent}
          onUpdateLanguage={(language) => onUpdateMetadata({ ...block.metadata, language })}
          onUpdateFileName={(fileName) => onUpdateMetadata({ ...block.metadata, fileName })}
        />
      )}

      {/* 5. Blockquote (Editorial Quote, Lavender accent bar) */}
      {block.type === 'quote' && (
        <View className="pl-4 border-l-4 border-note-lavender py-1 my-1">
          <TextInput
            multiline
            placeholder="Quote or reference text..."
            placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
            value={block.content}
            onChangeText={onUpdateContent}
            onFocus={onFocus}
            className="text-base md:text-lg italic text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0 outline-none"
          />
        </View>
      )}

      {/* 6. Table Block */}
      {block.type === 'table' && (
        <TableBlock
          columns={block.metadata?.columns || ['Header 1', 'Header 2']}
          rows={block.metadata?.rows || [['', '']]}
          onUpdateTable={(columns, rows) => {
            onUpdateMetadata({ ...block.metadata, columns, rows });
            const header = `| ${columns.join(' | ')} |`;
            const sep = `| ${columns.map(() => '---').join(' | ')} |`;
            const rowLines = rows.map(r => `| ${r.join(' | ')} |`);
            onUpdateContent([header, sep, ...rowLines].join('\n'));
          }}
        />
      )}

      {/* 7. Callout Block */}
      {block.type === 'callout' && (
        <CalloutBlock
          content={block.content}
          variant={block.metadata?.variant || 'info'}
          onUpdateContent={onUpdateContent}
          onUpdateVariant={(variant) => onUpdateMetadata({ ...block.metadata, variant })}
        />
      )}

      {/* 8. Equation Block */}
      {block.type === 'equation' && (
        <EquationBlock
          latex={block.content}
          displayMode={block.metadata?.displayMode ?? true}
          onUpdateLatex={onUpdateContent}
          onUpdateDisplayMode={(displayMode) => onUpdateMetadata({ ...block.metadata, displayMode })}
        />
      )}

      {/* 9. Drawing Block */}
      {block.type === 'drawing' && (
        <DrawingBlock
          initialPaths={block.metadata?.paths || []}
          onUpdateDrawing={(paths) => {
            onUpdateMetadata({ ...block.metadata, paths });
            onUpdateContent(JSON.stringify(paths));
          }}
        />
      )}

      {/* 10. Audio Block */}
      {block.type === 'audio' && (
        <AudioBlock
          assetId={block.metadata?.assetId}
          durationSec={block.metadata?.durationSec || 94}
          transcription={block.metadata?.transcription || ''}
          onUpdateMetadata={(meta) => {
            onUpdateMetadata({ ...block.metadata, ...meta });
          }}
        />
      )}

      {/* 11. Image / Video Resizable Embed Block */}
      {block.type === 'image' && (
        <ImageBlock
          url={block.content || block.metadata?.url}
          caption={block.metadata?.caption || ''}
          width={block.metadata?.width || '100%'}
          align={block.metadata?.align || 'center'}
          aspectRatio={block.metadata?.aspectRatio || 'natural'}
          onUpdateImage={(url, caption, width, align, aspectRatio) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, caption, width, align, aspectRatio });
          }}
          onDelete={onDelete}
        />
      )}

      {/* 12. File Attachment Block */}
      {block.type === 'file' && (
        <FileBlock
          fileName={block.metadata?.fileName || 'Attachment.pdf'}
          sizeBytes={block.metadata?.sizeBytes || 1845600}
          url={block.content || block.metadata?.url || '#'}
          onUpdateFile={(fileName, sizeBytes, url) => {
            if (url) onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, fileName, sizeBytes, url });
          }}
        />
      )}

      {/* 13. Bookmark Block */}
      {block.type === 'bookmark' && (
        <BookmarkBlock
          url={block.content || block.metadata?.url || 'https://reactnative.dev'}
          title={block.metadata?.title}
          description={block.metadata?.description}
          previewUrl={block.metadata?.previewUrl}
          onUpdateBookmark={(url, title, description, previewUrl) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, title, description, previewUrl });
          }}
        />
      )}

      {/* 14. Standard Continuous Paragraph (Pure Text Sheet) */}
      {block.type === 'paragraph' && (
        <TextInput
          multiline
          placeholder="Start typing your story or use floating dock below..."
          placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
          value={block.content}
          onChangeText={onUpdateContent}
          onFocus={onFocus}
          onSubmitEditing={onEnterPress}
          className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-1 min-h-[36px] outline-none"
        />
      )}
    </View>
  );
};
