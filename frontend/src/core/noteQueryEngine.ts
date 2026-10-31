/**
 * ScribeX Unified Note Query, Filter, Multi-Token Ranking & Pagination Engine
 * Phase 2 of docs/Search_Implementation_Plan.md
 *
 * Pure, deterministic pipeline that powers:
 * - Default Home feed (`All Notes`, `Favorites`, `Archive`, `Trash`)
 * - Nested Folder & Multi-Tag Filtering
 * - Multi-Token Ranked Search + Matched-Block Snippet Badge Extraction
 * - Future Friday AI Assistant Query Orchestration (`NoteQueryRequest`)
 * - Dynamic 10-Note Cursor Pagination (`pageSize: 10`)
 */

import { NoteItem, BlockType } from '../types/note';
import {
  NoteSearchDocument,
  IndexedBlockEntry,
  buildNoteSearchDocument,
} from './searchIndexer';

export type NoteStatusScope =
  | 'active'
  | 'favorites'
  | 'archived'
  | 'trashed'
  | 'all_non_trashed';

export type NoteSortBy =
  | 'relevance'
  | 'updated_desc'
  | 'created_desc'
  | 'title_asc';

export interface NoteQueryRequest {
  searchQuery: string;                  // Typed text or Voice-to-Text transcript
  statusScope: NoteStatusScope;         // Active tab / status partition
  folderPath?: string | null;           // e.g. "Work/Projects/ScribeX"
  includeSubfolders?: boolean;          // Default false for exact folder pill, true when AI/tree requests subtree
  tags?: string[];                      // e.g. ["urgent", "sprint"]
  hasBlockTypes?: BlockType[];          // Allows AI or user to filter notes containing specific block types
  sortBy: NoteSortBy;
  pageSize: number;                     // Default: 10 notes per page
  page: number;                         // 1-indexed page counter for infinite scroll
}

export interface NoteMatchBadge {
  iconType: BlockType | 'title' | 'tag' | 'folder';
  label: string;                        // e.g. "Sketch", "Audio", "Task", "Scan", "Folder", "Tag"
  snippet: string;                      // Highlighted human-readable snippet showing WHY the note matched
}

export interface NoteCardViewModel {
  note: NoteItem;
  cleanPreviewText: string;             // Pre-cleaned 2-line preview (free of <!-- scribex:block --> comments)
  matchBadge?: NoteMatchBadge;          // Populated when `searchQuery` or `hasBlockTypes` matches a block
  score?: number;                       // Relevance score when `searchQuery` is active
}

export interface NotePartitionCounts {
  allActive: number;
  favorites: number;
  archived: number;
  trashed: number;
  byFolder: Record<string, number>;
  byTag: Record<string, number>;
}

export interface UnifiedFeedResult {
  pinnedCards: NoteCardViewModel[];     // Top-shelf pinned notes (shown separately when browsing normally)
  feedCards: NoteCardViewModel[];       // Paginated main feed (sliced to `page * pageSize`)
  allMatchedCards: NoteCardViewModel[]; // Full unpaginated matched list (for count/inspection)
  totalMatches: number;                 // Total matching notes across the active query/filter
  mainFeedTotal: number;                // Total notes in the paginated main feed (excluding top-shelf pinned notes when separated)
  visibleCount: number;                 // Number of feedCards currently visible
  hasMore: boolean;                     // True if more notes can be loaded by scrolling to bottom
  currentPage: number;
  pageSize: number;
  isSearchActive: boolean;
  counts: NotePartitionCounts;
}

export const DEFAULT_NOTE_QUERY_REQUEST: NoteQueryRequest = {
  searchQuery: '',
  statusScope: 'active',
  folderPath: null,
  includeSubfolders: false,
  tags: [],
  hasBlockTypes: [],
  sortBy: 'updated_desc',
  pageSize: 10,
  page: 1,
};

/**
 * Helper: Maps legacy `activeFilter` string (`'all'`, `'favorites'`, `'archive'`, `'trash'`, `'folder:X'`, `'tag:Y'`)
 * into a canonical partial `NoteQueryRequest`.
 */
export function mapLegacyFilterToQuery(activeFilter: string): Partial<NoteQueryRequest> {
  if (!activeFilter || activeFilter === 'all') {
    return { statusScope: 'active', folderPath: null, tags: [] };
  }
  if (activeFilter === 'favorites') {
    return { statusScope: 'favorites', folderPath: null, tags: [] };
  }
  if (activeFilter === 'archive') {
    return { statusScope: 'archived', folderPath: null, tags: [] };
  }
  if (activeFilter === 'trash') {
    return { statusScope: 'trashed', folderPath: null, tags: [] };
  }
  if (activeFilter.startsWith('folder:')) {
    const folderPath = activeFilter.slice(7).trim() || 'General';
    return { statusScope: 'active', folderPath, tags: [] };
  }
  if (activeFilter.startsWith('tag:')) {
    const tag = activeFilter.slice(4).trim();
    return { statusScope: 'active', folderPath: null, tags: tag ? [tag] : [] };
  }
  return { statusScope: 'active', folderPath: null, tags: [] };
}

/**
 * Helper: Maps a canonical `NoteQueryRequest` back to the legacy `activeFilter` string
 * so that UI pills stay 100% synchronized when `setQueryRequest` is called directly
 * by either the UI or the Friday AI Assistant.
 */
export function deriveLegacyFilterFromQuery(request: NoteQueryRequest): string {
  if (request.statusScope === 'favorites') return 'favorites';
  if (request.statusScope === 'archived') return 'archive';
  if (request.statusScope === 'trashed') return 'trash';
  if (request.folderPath) return `folder:${request.folderPath}`;
  if (request.tags && request.tags.length > 0) return `tag:${request.tags[0]}`;
  return 'all';
}

/**
 * Normalizes a partial AI or UI `NoteQueryRequest` into a clean, canonical `NoteQueryRequest`.
 */
export function buildCanonicalNoteQueryRequest(
  current: NoteQueryRequest,
  partial: Partial<NoteQueryRequest>
): NoteQueryRequest {
  const shouldResetPage =
    partial.page === undefined &&
    (partial.searchQuery !== undefined ||
      partial.statusScope !== undefined ||
      partial.folderPath !== undefined ||
      partial.includeSubfolders !== undefined ||
      partial.tags !== undefined ||
      partial.hasBlockTypes !== undefined ||
      partial.sortBy !== undefined);

  const nextSearch =
    partial.searchQuery !== undefined ? partial.searchQuery : current.searchQuery;

  const nextSortBy =
    partial.sortBy !== undefined
      ? partial.sortBy
      : partial.searchQuery !== undefined
      ? nextSearch.trim()
        ? 'relevance'
        : 'updated_desc'
      : current.sortBy;

  return {
    ...current,
    ...partial,
    searchQuery: nextSearch,
    sortBy: nextSortBy,
    pageSize: partial.pageSize && partial.pageSize > 0 ? partial.pageSize : current.pageSize || 10,
    page: shouldResetPage ? 1 : partial.page ?? current.page,
  };
}
export function tokenizeSearchQuery(rawQuery: string): string[] {
  if (!rawQuery) return [];
  return rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_#@.-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Extracts a compact snippet (~75 chars) centered around the first matched token.
 */
function buildCenteredSnippet(text: string, token: string, maxLen: number = 76): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;

  const lower = clean.toLowerCase();
  const idx = lower.indexOf(token.toLowerCase());
  if (idx === -1) return `${clean.slice(0, maxLen)}...`;

  const start = Math.max(0, idx - 20);
  const end = Math.min(clean.length, start + maxLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

/**
 * Stage A: Computes global partition counts and filters `notes` according to `NoteQueryRequest`.
 */
export function filterNotesPartition(
  notes: NoteItem[],
  searchIndexMap: Map<string, NoteSearchDocument>,
  request: NoteQueryRequest
): { filteredNotes: NoteItem[]; counts: NotePartitionCounts } {
  const counts: NotePartitionCounts = {
    allActive: 0,
    favorites: 0,
    archived: 0,
    trashed: 0,
    byFolder: {},
    byTag: {},
  };

  for (const n of notes) {
    if (n.status === 'trashed') {
      counts.trashed++;
    } else if (n.status === 'archived') {
      counts.archived++;
    } else {
      counts.allActive++;
      if (n.isFavorite) counts.favorites++;
      const folder = n.folderPath || 'General';
      counts.byFolder[folder] = (counts.byFolder[folder] || 0) + 1;
      if (Array.isArray(n.tags)) {
        for (const t of n.tags) {
          counts.byTag[t] = (counts.byTag[t] || 0) + 1;
        }
      }
    }
  }

  const requiredTags = (request.tags || []).map((t) => t.toLowerCase().replace(/^#/, ''));
  const requiredBlockTypes = request.hasBlockTypes || [];

  const filteredNotes = notes.filter((n) => {
    // 1. Status Scope Check
    if (request.statusScope === 'trashed') {
      if (n.status !== 'trashed') return false;
    } else if (request.statusScope === 'archived') {
      if (n.status !== 'archived') return false;
    } else if (request.statusScope === 'favorites') {
      if (n.status === 'trashed' || n.status === 'archived' || !n.isFavorite) return false;
    } else if (request.statusScope === 'all_non_trashed') {
      if (n.status === 'trashed') return false;
    } else {
      // 'active' default
      if (n.status === 'trashed' || n.status === 'archived') return false;
    }

    // 2. Folder Scope Check
    if (request.folderPath) {
      const noteFolder = n.folderPath || 'General';
      if (request.includeSubfolders) {
        if (noteFolder !== request.folderPath && !noteFolder.startsWith(`${request.folderPath}/`)) {
          return false;
        }
      } else if (noteFolder !== request.folderPath) {
        return false;
      }
    }

    // 3. Tags Filter Check
    if (requiredTags.length > 0) {
      const noteTagsLower = (n.tags || []).map((t) => t.toLowerCase());
      const hasAllTags = requiredTags.every((rt) => noteTagsLower.some((nt) => nt.includes(rt)));
      if (!hasAllTags) return false;
    }

    // 4. Block Type Filter Check (for AI / media filter queries)
    if (requiredBlockTypes.length > 0) {
      const doc = searchIndexMap.get(n.id) || buildNoteSearchDocument(n);
      const hasMatchingBlock = requiredBlockTypes.some((bt) => doc.presentBlockTypes.includes(bt));
      if (!hasMatchingBlock) return false;
    }

    return true;
  });

  return { filteredNotes, counts };
}

/**
 * Stage B: Scores a single `NoteItem` against tokenized query terms and extracts the best `NoteMatchBadge`.
 */
export function scoreNoteAgainstQuery(
  note: NoteItem,
  doc: NoteSearchDocument,
  tokens: string[],
  fullQueryLower: string
): { score: number; matchBadge?: NoteMatchBadge } {
  if (tokens.length === 0) {
    return { score: 0 };
  }

  let totalScore = 0;
  let matchedTokensCount = 0;
  let bestBadge: NoteMatchBadge | undefined;
  let bestBadgePriority = 0; // Higher priority badge wins (e.g. Media/Block Title > Body > Tag/Folder)

  // Bonus for exact phrase match in Note Title
  if (doc.titleLower === fullQueryLower) {
    totalScore += 140;
  } else if (doc.titleLower.startsWith(fullQueryLower)) {
    totalScore += 110;
  } else if (doc.titleLower.includes(fullQueryLower)) {
    totalScore += 85;
  }

  for (const token of tokens) {
    let tokenMatched = false;

    // Tier 1: Note Title (+100 prefix, +75 substring)
    if (doc.titleLower.startsWith(token) || doc.titleLower.includes(` ${token}`)) {
      totalScore += 100;
      tokenMatched = true;
    } else if (doc.titleLower.includes(token)) {
      totalScore += 75;
      tokenMatched = true;
    }

    // Tier 2: Organization — Tags & Folder Path (+60)
    const matchedTag = (note.tags || []).find((t) => t.toLowerCase().includes(token));
    if (matchedTag) {
      totalScore += 60;
      tokenMatched = true;
      if (bestBadgePriority < 2) {
        bestBadgePriority = 2;
        bestBadge = {
          iconType: 'tag',
          label: 'Tag',
          snippet: `#${matchedTag}`,
        };
      }
    }

    if (doc.folderLower.includes(token)) {
      totalScore += 60;
      tokenMatched = true;
      if (bestBadgePriority < 1) {
        bestBadgePriority = 1;
        bestBadge = {
          iconType: 'folder',
          label: 'Folder',
          snippet: note.folderPath || 'General',
        };
      }
    }

    // Tier 3 & Tier 4: Inspect granular `blockEntries` to score and extract exact Match Badge
    for (const entry of doc.blockEntries) {
      const primaryLower = entry.primaryTitle.toLowerCase();
      const bodyLower = entry.bodyText.toLowerCase();

      // Tier 3: Media Caption / Block Title / Filename (+45)
      if (primaryLower && primaryLower.includes(token)) {
        totalScore += 45;
        tokenMatched = true;
        if (bestBadgePriority < 4) {
          bestBadgePriority = 4;
          bestBadge = {
            iconType: entry.blockType,
            label: entry.label,
            snippet: buildCenteredSnippet(entry.primaryTitle, token),
          };
        }
      }

      // Tier 4: Block Body / Transcript / OCR / Checklist (+20)
      if (bodyLower && bodyLower.includes(token)) {
        totalScore += 20;
        tokenMatched = true;
        if (bestBadgePriority < 3) {
          bestBadgePriority = 3;
          bestBadge = {
            iconType: entry.blockType,
            label: entry.label,
            snippet: buildCenteredSnippet(entry.bodyText, token),
          };
        }
      }
    }

    if (tokenMatched) {
      matchedTokensCount++;
    }
  }

  if (matchedTokensCount === 0) {
    return { score: 0 };
  }

  // Multi-Token Completeness Multiplier (×1.5 when ALL query tokens match)
  if (tokens.length > 1 && matchedTokensCount === tokens.length) {
    totalScore = Math.round(totalScore * 1.5);
  }

  // Slight boost for pinned/favorite notes on tie-breakers
  if (note.isPinned) totalScore += 5;
  if (note.isFavorite) totalScore += 3;

  return {
    score: totalScore,
    matchBadge: bestBadge,
  };
}

/**
 * Executes the complete 3-stage Note Query Pipeline:
 * Stage A (Filter Partition) -> Stage B (Ranked Search / Default Sort) -> Stage C (10-Note Pagination)
 */
export function executeNoteQuery(
  notes: NoteItem[],
  searchIndexMap: Map<string, NoteSearchDocument>,
  rawRequest: Partial<NoteQueryRequest> = {}
): UnifiedFeedResult {
  const request: NoteQueryRequest = {
    ...DEFAULT_NOTE_QUERY_REQUEST,
    ...rawRequest,
    pageSize: rawRequest.pageSize && rawRequest.pageSize > 0 ? rawRequest.pageSize : 10,
    page: rawRequest.page && rawRequest.page > 0 ? rawRequest.page : 1,
  };

  // Stage A: Partition & Filter
  const { filteredNotes, counts } = filterNotesPartition(notes, searchIndexMap, request);

  const trimmedQuery = (request.searchQuery || '').trim();
  const tokens = tokenizeSearchQuery(trimmedQuery);
  const isSearchActive = tokens.length > 0;

  // Stage B: Search Scoring OR Standard Feed Resolution
  if (isSearchActive) {
    const fullQueryLower = trimmedQuery.toLowerCase();
    const scoredCards: NoteCardViewModel[] = [];

    for (const note of filteredNotes) {
      const doc = searchIndexMap.get(note.id) || buildNoteSearchDocument(note);
      const { score, matchBadge } = scoreNoteAgainstQuery(note, doc, tokens, fullQueryLower);
      if (score > 0) {
        scoredCards.push({
          note,
          cleanPreviewText: doc.cleanPreviewText,
          matchBadge,
          score,
        });
      }
    }

    // Sort by relevance descending
    scoredCards.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Stage C: Paginate (10 notes per page)
    const maxVisible = request.page * request.pageSize;
    const paginatedFeed = scoredCards.slice(0, maxVisible);

    return {
      pinnedCards: [], // During active search, all matching notes appear in a single relevance-ranked list (no duplicate cards)
      feedCards: paginatedFeed,
      allMatchedCards: scoredCards,
      totalMatches: scoredCards.length,
      mainFeedTotal: scoredCards.length,
      visibleCount: paginatedFeed.length,
      hasMore: scoredCards.length > maxVisible,
      currentPage: request.page,
      pageSize: request.pageSize,
      isSearchActive: true,
      counts,
    };
  }

  // Standard Browsing Mode (No active search query)
  const buildViewModel = (note: NoteItem): NoteCardViewModel => {
    const doc = searchIndexMap.get(note.id) || buildNoteSearchDocument(note);
    let blockFilterBadge: NoteMatchBadge | undefined;

    if (request.hasBlockTypes && request.hasBlockTypes.length > 0) {
      const matchedEntry: IndexedBlockEntry | undefined = doc.blockEntries.find((e) =>
        request.hasBlockTypes!.includes(e.blockType)
      );
      if (matchedEntry) {
        blockFilterBadge = {
          iconType: matchedEntry.blockType,
          label: matchedEntry.label,
          snippet: matchedEntry.primaryTitle || matchedEntry.bodyText || `${matchedEntry.label} block`,
        };
      }
    }

    return {
      note,
      cleanPreviewText: doc.cleanPreviewText,
      matchBadge: blockFilterBadge,
    };
  };

  const allViewModels = filteredNotes.map(buildViewModel);

  if (request.sortBy === 'title_asc') {
    allViewModels.sort((a, b) => (a.note.title || '').localeCompare(b.note.title || ''));
  } else if (request.sortBy === 'created_desc') {
    allViewModels.sort((a, b) =>
      String(b.note.createdAt || '').localeCompare(String(a.note.createdAt || ''))
    );
  } else {
    // Default 'updated_desc'
    allViewModels.sort((a, b) =>
      String(b.note.updatedAt || '').localeCompare(String(a.note.updatedAt || ''))
    );
  }

  // Top-shelf Pinned Notes are shown separately in default 'active' All Notes view
  const showPinnedShelf =
    request.statusScope === 'active' &&
    !request.folderPath &&
    (!request.tags || request.tags.length === 0) &&
    (!request.hasBlockTypes || request.hasBlockTypes.length === 0);

  const pinnedCards = showPinnedShelf
    ? allViewModels.filter((vm) => vm.note.isPinned)
    : [];

  const mainFeedCandidates = showPinnedShelf
    ? allViewModels.filter((vm) => !vm.note.isPinned)
    : allViewModels;

  // Stage C: Paginate main feed (10 notes per page)
  const maxVisible = request.page * request.pageSize;
  const paginatedFeed = mainFeedCandidates.slice(0, maxVisible);

  return {
    pinnedCards,
    feedCards: paginatedFeed,
    allMatchedCards: allViewModels,
    totalMatches: allViewModels.length,
    mainFeedTotal: mainFeedCandidates.length,
    visibleCount: paginatedFeed.length,
    hasMore: mainFeedCandidates.length > maxVisible,
    currentPage: request.page,
    pageSize: request.pageSize,
    isSearchActive: false,
    counts,
  };
}

