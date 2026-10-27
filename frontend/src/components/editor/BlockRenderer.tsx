import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { ComposableBlock, BlockType } from '../../types/note';
import { useTheme, NoteColors } from '../../theme';
import { 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Code2, 
  Heading1, 
  Heading2, 
  ListTodo, 
  Quote, 
  Minus,
  AlignLeft,
  Table,
  AlertCircle,
  Sigma,
  PenTool,
  Volume2,
  Image as ImageIcon,
  Paperclip,
  Globe
} from 'lucide-react-native';
import { 
  TableBlock, 
  CodeBlock, 
  CalloutBlock, 
  EquationBlock,
  DrawingBlock,
  AudioBlock,
  ImageBlock,
  FileBlock,
  BookmarkBlock
} from './blocks';

interface BlockRendererProps {
  block: ComposableBlock;
  index: number;
  totalBlocks: number;
  onUpdateContent: (content: string) => void;
  onUpdateMetadata: (metadata: Record<string, any>) => void;
  onChangeType: (type: BlockType) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  totalBlocks,
  onUpdateContent,
  onUpdateMetadata,
  onChangeType,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const { isDark } = useTheme();

  // 1. Divider Block
  if (block.type === 'divider') {
    return (
      <View className="my-4 py-2 group flex-row items-center justify-between">
        <View className="flex-1 h-[1px] bg-light-border dark:bg-dark-border" />
        <Pressable
          onPress={onDelete}
          accessibilityLabel="Delete Divider"
          className="ml-2 w-7 h-7 rounded-full items-center justify-center opacity-40 hover:opacity-100 active:scale-90"
        >
          <Trash2 size={14} color={isDark ? '#B5B5B5' : '#626262'} />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mb-3 p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/60 dark:border-dark-border/60 hover:border-light-border dark:hover:border-dark-border transition-colors">
      
      {/* Top Block Control Bar */}
      <View className="flex-row items-center justify-between mb-2 pb-1.5 border-b border-light-border/40 dark:border-dark-border/40">
        
        {/* Type Selector Pills */}
        <View className="flex-row items-center flex-wrap gap-1">
          <Pressable
            onPress={() => onChangeType('paragraph')}
            className={`p-1.5 rounded-lg ${block.type === 'paragraph' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Text"
          >
            <AlignLeft size={13} color={block.type === 'paragraph' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('heading');
              onUpdateMetadata({ level: 1 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'heading' && block.metadata?.level === 1 ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Heading 1"
          >
            <Heading1 size={13} color={block.type === 'heading' && block.metadata?.level === 1 ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('heading');
              onUpdateMetadata({ level: 2 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'heading' && block.metadata?.level === 2 ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Heading 2"
          >
            <Heading2 size={13} color={block.type === 'heading' && block.metadata?.level === 2 ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('checklist');
              onUpdateMetadata({ checked: false });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'checklist' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Checklist"
          >
            <ListTodo size={13} color={block.type === 'checklist' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('code');
              if (!block.metadata?.language) onUpdateMetadata({ language: 'typescript' });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'code' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Code"
          >
            <Code2 size={13} color={block.type === 'code' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => onChangeType('quote')}
            className={`p-1.5 rounded-lg ${block.type === 'quote' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Quote"
          >
            <Quote size={13} color={block.type === 'quote' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('table');
              if (!block.metadata?.columns) {
                onUpdateMetadata({
                  columns: ['Header 1', 'Header 2'],
                  rows: [['', '']],
                });
              }
            }}
            className={`p-1.5 rounded-lg ${block.type === 'table' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Table"
          >
            <Table size={13} color={block.type === 'table' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('callout');
              if (!block.metadata?.variant) onUpdateMetadata({ variant: 'info' });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'callout' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Callout"
          >
            <AlertCircle size={13} color={block.type === 'callout' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('equation');
              if (block.metadata?.displayMode === undefined) onUpdateMetadata({ displayMode: true });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'equation' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Equation"
          >
            <Sigma size={13} color={block.type === 'equation' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('drawing');
              if (!block.metadata?.paths) onUpdateMetadata({ paths: [] });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'drawing' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Drawing"
          >
            <PenTool size={13} color={block.type === 'drawing' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('audio');
              if (!block.metadata?.durationSec) onUpdateMetadata({ durationSec: 94 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'audio' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Audio"
          >
            <Volume2 size={13} color={block.type === 'audio' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('image');
              if (!block.content) onUpdateContent('https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80');
            }}
            className={`p-1.5 rounded-lg ${block.type === 'image' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Image"
          >
            <ImageIcon size={13} color={block.type === 'image' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('file');
              if (!block.metadata?.fileName) onUpdateMetadata({ fileName: 'Attachment.pdf', sizeBytes: 1540000 });
            }}
            className={`p-1.5 rounded-lg ${block.type === 'file' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="File"
          >
            <Paperclip size={13} color={block.type === 'file' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>

          <Pressable
            onPress={() => {
              onChangeType('bookmark');
              if (!block.content) onUpdateContent('https://reactnative.dev');
            }}
            className={`p-1.5 rounded-lg ${block.type === 'bookmark' ? 'bg-light-iconBg dark:bg-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            accessibilityLabel="Bookmark"
          >
            <Globe size={13} color={block.type === 'bookmark' ? (isDark ? '#111111' : '#FFFFFF') : (isDark ? '#B5B5B5' : '#626262')} />
          </Pressable>
        </View>

        {/* Right Actions: Reorder & Delete */}
        <View className="flex-row items-center gap-1">
          {index > 0 && onMoveUp && (
            <Pressable
              onPress={onMoveUp}
              accessibilityLabel="Move Block Up"
              className="p-1 rounded-full opacity-50 hover:opacity-100"
            >
              <ChevronUp size={14} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}

          {index < totalBlocks - 1 && onMoveDown && (
            <Pressable
              onPress={onMoveDown}
              accessibilityLabel="Move Block Down"
              className="p-1 rounded-full opacity-50 hover:opacity-100"
            >
              <ChevronDown size={14} color={isDark ? '#B5B5B5' : '#626262'} />
            </Pressable>
          )}

          <Pressable
            onPress={onDelete}
            accessibilityLabel="Delete Block"
            className="p-1 rounded-full opacity-40 hover:opacity-100 active:scale-90"
          >
            <Trash2 size={14} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        </View>
      </View>

      {/* Block Main Editable Content */}
      {/* 2. Heading Block */}
      {block.type === 'heading' && (
        <TextInput
          multiline
          placeholder={`Heading ${block.metadata?.level || 1}...`}
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={block.content}
          onChangeText={onUpdateContent}
          className={`font-extrabold text-light-textPrimary dark:text-dark-textPrimary tracking-tight py-1 ${
            block.metadata?.level === 1 ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
          }`}
        />
      )}

      {/* 3. Checklist Block */}
      {block.type === 'checklist' && (
        <View className="flex-row items-start gap-3 py-1">
          <Pressable
            onPress={() => onUpdateMetadata({ checked: !block.metadata?.checked })}
            className="pt-1 active:scale-90"
          >
            {block.metadata?.checked ? (
              <CheckCircle2 size={19} color={NoteColors.lime} strokeWidth={2.4} />
            ) : (
              <Circle size={19} color={isDark ? '#858585' : '#929292'} strokeWidth={2} />
            )}
          </Pressable>

          <TextInput
            multiline
            placeholder="To-do item..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={block.content}
            onChangeText={onUpdateContent}
            className={`flex-1 text-base leading-relaxed py-0 text-light-textPrimary dark:text-dark-textPrimary ${
              block.metadata?.checked ? 'line-through text-light-textMuted dark:text-dark-textMuted' : ''
            }`}
          />
        </View>
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

      {/* 5. Blockquote Block */}
      {block.type === 'quote' && (
        <View className="pl-4 border-l-4 border-note-lavender py-1">
          <TextInput
            multiline
            placeholder="Quote or reference text..."
            placeholderTextColor={isDark ? '#858585' : '#929292'}
            value={block.content}
            onChangeText={onUpdateContent}
            className="text-base italic text-light-textSecondary dark:text-dark-textSecondary leading-relaxed py-0"
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

      {/* 11. Image Block */}
      {block.type === 'image' && (
        <ImageBlock
          url={block.content || block.metadata?.url}
          caption={block.metadata?.caption || ''}
          aspectRatio={block.metadata?.aspectRatio || 'natural'}
          onUpdateImage={(url, caption, aspectRatio) => {
            onUpdateContent(url);
            onUpdateMetadata({ ...block.metadata, url, caption, aspectRatio });
          }}
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

      {/* 14. Standard Paragraph Block */}
      {block.type === 'paragraph' && (
        <TextInput
          multiline
          placeholder="Write your thought..."
          placeholderTextColor={isDark ? '#858585' : '#929292'}
          value={block.content}
          onChangeText={onUpdateContent}
          className="text-base font-normal leading-relaxed text-light-textPrimary dark:text-dark-textPrimary py-1 min-h-[44px]"
        />
      )}
    </View>
  );
};
