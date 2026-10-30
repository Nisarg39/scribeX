import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NoteItem, ComposableBlock, BlockType } from '../../../types/note';
import { NoteColorToken } from '../../../theme';
import { serializeBlocksToMarkdown, parseMarkdownToBlocks } from '../../../core/astSerializer';

interface UseEditorCaptureProps {
  note: NoteItem;
  title: string;
  colorToken: NoteColorToken;
  blocks: ComposableBlock[];
  blocksRef: React.MutableRefObject<ComposableBlock[]>;
  activeBlockIdRef: React.MutableRefObject<string | null>;
  handleInsertBlock: (type: BlockType, metadata?: Record<string, any>, initialContent?: string) => void;
  handleInsertMultipleBlocks: (
    newBlocks: { type: BlockType; content?: string; metadata?: Record<string, any> }[],
    targetBlockId?: string | null
  ) => void;
  handleImportBlocks: (
    importedBlocks: ComposableBlock[],
    importedTitle?: string,
    importedColor?: NoteColorToken
  ) => void;
}

// Promise helpers for asynchronous file reading
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as Data URL'));
    reader.readAsDataURL(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as text'));
    reader.readAsText(file);
  });
};

export const useEditorCapture = ({
  note,
  title,
  colorToken,
  blocks,
  blocksRef,
  activeBlockIdRef,
  handleInsertBlock,
  handleInsertMultipleBlocks,
  handleImportBlocks,
}: UseEditorCaptureProps) => {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  // Keep references to latest mutation handlers so closures in global event listeners never go stale
  const handleInsertBlockRef = useRef(handleInsertBlock);
  handleInsertBlockRef.current = handleInsertBlock;

  const handleInsertMultipleBlocksRef = useRef(handleInsertMultipleBlocks);
  handleInsertMultipleBlocksRef.current = handleInsertMultipleBlocks;

  const handleImportBlocksRef = useRef(handleImportBlocks);
  handleImportBlocksRef.current = handleImportBlocks;

  const titleRef = useRef(title);
  titleRef.current = title;

  const colorTokenRef = useRef(colorToken);
  colorTokenRef.current = colorToken;

  const noteRef = useRef(note);
  noteRef.current = note;

  // Helper to parse CSV into spreadsheet rows
  const parseCSVToRows = (
    csvText: string
  ): { columns: { id: string; name: string; type: string }[]; rows: string[][] } => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return {
        columns: [
          { id: 'c1', name: 'Column 1', type: 'text' },
          { id: 'c2', name: 'Column 2', type: 'text' },
        ],
        rows: [['Data 1', 'Data 2']],
      };
    }

    const parseLine = (line: string) => {
      const separator = line.includes('\t') ? '\t' : ',';
      return line.split(separator).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
    };

    const headerCells = parseLine(lines[0]);
    const columns = headerCells.map((name, i) => ({
      id: `c${i + 1}`,
      name: name || `Column ${i + 1}`,
      type: 'text',
    }));

    const rows = lines.slice(1).map((line) => {
      const cells = parseLine(line);
      while (cells.length < columns.length) cells.push('');
      return cells.slice(0, columns.length);
    });

    return { columns, rows: rows.length > 0 ? rows : [columns.map(() => '')] };
  };

  // Process dropped or selected files sequentially so each block is appended cleanly without race conditions
  const processFiles = async (files: File[]) => {
    for (const file of files) {
      const fileName = file.name;
      const fileType = file.type.toLowerCase();
      const lowerName = fileName.toLowerCase();

      // 1. Image Files (PNG, JPG, WebP, SVG, GIF)
      if (fileType.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(lowerName)) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          handleInsertBlockRef.current(
            'image',
            {
              url: dataUrl,
              caption: fileName,
              width: '100%',
              align: 'center',
              aspectRatio: 'natural',
            },
            dataUrl
          );
        } catch (err) {
          console.warn('Failed to load dropped image:', err);
        }
        continue;
      }

      // 2. Audio Files (MP3, WAV, WebM, OGG, M4A)
      if (fileType.startsWith('audio/') || /\.(mp3|wav|webm|ogg|m4a|aac)$/i.test(lowerName)) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          handleInsertBlockRef.current(
            'audio',
            {
              durationSec: 0,
              transcription: `Audio file: ${fileName}`,
              url: dataUrl,
            },
            dataUrl
          );
        } catch (err) {
          console.warn('Failed to load dropped audio:', err);
        }
        continue;
      }

      // 3. Video Files (MP4, WebM, MOV)
      if (fileType.startsWith('video/') || /\.(mp4|webm|mov|quicktime)$/i.test(lowerName)) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          handleInsertBlockRef.current(
            'video',
            {
              url: dataUrl,
              title: fileName,
              provider: 'custom',
            },
            dataUrl
          );
        } catch (err) {
          console.warn('Failed to load dropped video:', err);
        }
        continue;
      }

      // 4. Markdown & Plain Text Files (.md, .markdown, .txt)
      if (
        /\.(md|markdown|txt)$/i.test(lowerName) ||
        fileType.includes('markdown') ||
        fileType.includes('text/plain')
      ) {
        try {
          const text = await readFileAsText(file);
          if (text) {
            const parsedBlocks = parseMarkdownToBlocks(text);
            if (parsedBlocks.length > 0) {
              handleInsertMultipleBlocksRef.current(parsedBlocks, activeBlockIdRef.current);
            }
          }
        } catch (err) {
          console.warn('Failed to load dropped markdown:', err);
        }
        continue;
      }

      // 5. CSV / Spreadsheet Files (.csv, .tsv)
      if (/\.(csv|tsv)$/i.test(lowerName) || fileType.includes('csv')) {
        try {
          const text = await readFileAsText(file);
          if (text) {
            const { columns, rows } = parseCSVToRows(text);
            handleInsertBlockRef.current('sheet', {
              title: fileName.replace(/\.[^/.]+$/, ''),
              activeTabId: 'tab-1',
              tabs: [
                {
                  id: 'tab-1',
                  name: 'Imported Data',
                  columns,
                  rows,
                  summaryFunction: 'none',
                },
              ],
            });
          }
        } catch (err) {
          console.warn('Failed to load dropped spreadsheet:', err);
        }
        continue;
      }

      // 6. Generic Document / Other Files (PDF, DOCX, ZIP, etc.)
      try {
        const dataUrl = await readFileAsDataUrl(file);
        handleInsertBlockRef.current(
          'file',
          {
            fileName,
            sizeBytes: file.size,
            fileType: file.type || 'application/octet-stream',
            url: dataUrl,
          },
          dataUrl
        );
      } catch (err) {
        console.warn('Failed to load dropped document:', err);
      }
    }
  };

  // Web HTML5 Drag and Drop Events
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        dragCounterRef.current += 1;
        setIsDraggingFiles(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDraggingFiles(false);
        }
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingFiles(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Web Smart Clipboard / Paste Handler
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;

      // Check for image buffer in clipboard (e.g. screenshot via Cmd+Shift+4)
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const dataUrl = await readFileAsDataUrl(file);
            handleInsertBlockRef.current(
              'image',
              {
                url: dataUrl,
                caption: `Screenshot ${new Date().toLocaleTimeString()}`,
                width: '100%',
                align: 'center',
                aspectRatio: 'natural',
              },
              dataUrl
            );
          } catch (err) {
            console.warn('Failed to parse pasted image:', err);
          }
          return;
        }
      }

      // Check if user is typing inside an existing text input/textarea
      const activeEl = document.activeElement;
      const isTyping =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as any)?.isContentEditable;

      const text = e.clipboardData.getData('text/plain')?.trim();
      if (!text) return;

      // If user pasted when not focused on an input, handle rich auto-conversion
      if (!isTyping) {
        // Video URL detection (YouTube, Vimeo, Loom)
        if (
          /^(https?:\/\/)?(www\.)?(youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|loom\.com\/share\/)/i.test(
            text
          )
        ) {
          e.preventDefault();
          const isYouTube = /youtube|youtu\.be/i.test(text);
          const isVimeo = /vimeo/i.test(text);
          const provider = isYouTube ? 'youtube' : isVimeo ? 'vimeo' : 'custom';
          handleInsertBlockRef.current(
            'video',
            {
              url: text,
              provider,
              title: isYouTube ? 'YouTube Video' : 'Video Player',
            },
            text
          );
          return;
        }

        // Web Link detection
        if (/^https?:\/\/[^\s]+$/i.test(text)) {
          e.preventDefault();
          try {
            const urlObj = new URL(text);
            handleInsertBlockRef.current('bookmark', {
              url: text,
              title: urlObj.hostname,
              domain: urlObj.hostname,
            });
            return;
          } catch (_) {}
        }

        // CSV / Multi-line Tabular data detection
        if (text.includes('\n') && (text.includes('\t') || text.includes(','))) {
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          if (lines.length >= 2) {
            e.preventDefault();
            const { columns, rows } = parseCSVToRows(text);
            handleInsertBlockRef.current('sheet', {
              title: 'Pasted Data',
              activeTabId: 'tab-1',
              tabs: [
                {
                  id: 'tab-1',
                  name: 'Pasted Grid',
                  columns,
                  rows,
                  summaryFunction: 'none',
                },
              ],
            });
            return;
          }
        }

        // Multiline markdown blocks
        if (
          text.includes('```') ||
          text.startsWith('# ') ||
          text.startsWith('## ') ||
          text.startsWith('- [ ] ') ||
          text.startsWith('- ')
        ) {
          e.preventDefault();
          const parsed = parseMarkdownToBlocks(text);
          if (parsed.length > 0) {
            handleInsertMultipleBlocksRef.current(parsed, activeBlockIdRef.current);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Export note to Markdown (.md)
  const handleExportMarkdown = () => {
    const currentBlocks = blocksRef.current;
    const bodyMarkdown = serializeBlocksToMarkdown(currentBlocks);
    const cleanTitle = titleRef.current.trim() || 'Untitled Note';

    const frontmatter = [
      '---',
      `title: "${cleanTitle.replace(/"/g, '\\"')}"`,
      `folder: "${(noteRef.current.folderPath || 'General').replace(/"/g, '\\"')}"`,
      `color: "${colorTokenRef.current}"`,
      `updatedAt: "${new Date().toISOString()}"`,
      '---',
      '',
      bodyMarkdown,
    ].join('\n');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeFilename = cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      link.href = url;
      link.download = `${safeFilename || 'note'}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Export note to JSON (.json)
  const handleExportJSON = () => {
    const currentBlocks = blocksRef.current;
    const cleanTitle = titleRef.current.trim() || 'Untitled Note';

    const exportData = {
      id: noteRef.current.id,
      title: cleanTitle,
      folderPath: noteRef.current.folderPath || 'General',
      colorToken: colorTokenRef.current,
      isPinned: noteRef.current.isPinned,
      isFavorite: noteRef.current.isFavorite,
      blocks: currentBlocks,
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeFilename = cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      link.href = url;
      link.download = `${safeFilename || 'note'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Trigger file import dialog
  const handleTriggerImport = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt,.json,.csv';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        const lowerName = file.name.toLowerCase();

        // 1. JSON Note Import
        if (lowerName.endsWith('.json')) {
          try {
            const text = await readFileAsText(file);
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.blocks)) {
              handleImportBlocksRef.current(
                parsed.blocks,
                parsed.title || file.name.replace(/\.json$/i, ''),
                parsed.colorToken || colorTokenRef.current
              );
            }
          } catch (err) {
            console.error('Failed to parse note JSON:', err);
          }
          return;
        }

        // 2. CSV Import
        if (lowerName.endsWith('.csv')) {
          try {
            const csvText = await readFileAsText(file);
            const { columns, rows } = parseCSVToRows(csvText);
            const sheetBlock: ComposableBlock = {
              id: `b-${Date.now()}-1`,
              type: 'sheet',
              content: file.name.replace(/\.csv$/i, ''),
              metadata: {
                title: file.name.replace(/\.csv$/i, ''),
                activeTabId: 'tab-1',
                tabs: [
                  {
                    id: 'tab-1',
                    name: 'Sheet 1',
                    columns,
                    rows,
                    summaryFunction: 'none',
                  },
                ],
              },
            };
            handleImportBlocksRef.current([sheetBlock], file.name.replace(/\.csv$/i, ''));
          } catch (err) {
            console.error('Failed to read CSV:', err);
          }
          return;
        }

        // 3. Markdown / Plain Text Import
        try {
          const rawText = await readFileAsText(file);
          let parsedTitle = file.name.replace(/\.(md|markdown|txt)$/i, '');
          let parsedColor: NoteColorToken | undefined = undefined;
          let bodyText = rawText;

          // Extract YAML frontmatter if present
          if (rawText.startsWith('---')) {
            const endIdx = rawText.indexOf('---', 3);
            if (endIdx !== -1) {
              const frontmatterBlock = rawText.slice(3, endIdx);
              bodyText = rawText.slice(endIdx + 3).trim();

              const titleMatch = frontmatterBlock.match(/title:\s*["']?([^"'\n]+)["']?/i);
              if (titleMatch && titleMatch[1].trim()) {
                parsedTitle = titleMatch[1].trim();
              }
              const colorMatch = frontmatterBlock.match(/color:\s*["']?([a-z]+)["']?/i);
              if (colorMatch && colorMatch[1].trim()) {
                parsedColor = colorMatch[1].trim() as NoteColorToken;
              }
            }
          }

          const parsedBlocks = parseMarkdownToBlocks(bodyText);
          if (parsedBlocks.length > 0) {
            handleImportBlocksRef.current(parsedBlocks, parsedTitle, parsedColor);
          }
        } catch (err) {
          console.error('Failed to read markdown file:', err);
        }
      };

      input.click();
    }
  };

  return {
    isDraggingFiles,
    handleExportMarkdown,
    handleExportJSON,
    handleTriggerImport,
    processFiles,
  };
};
