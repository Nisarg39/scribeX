/**
 * Pure Domain Helpers for Folder Cascade Locking, Redaction, & Strict Custom Credential Verification
 * Note: Intentionally free of React / React Native imports so it runs identically in app runtime & headless Node tests.
 */

import { DBFolder, LockType, WorkspaceSecurityConfig } from '../../db/types';
import { NoteItem } from '../../types/note';
import { verifyCredential } from './pinCrypto';

export const LOCKED_MASK_LABEL = 'Locked Note/Task';

export function normalizeFolderPath(folderPath?: string | null): string {
  if (!folderPath) return '';
  return folderPath.trim().replace(/^\/+|\/+$/g, '');
}

/**
 * Returns ancestor paths ordered from outermost root down to exact normalized path.
 * Example: 'Work/Clients/Acme' -> ['Work', 'Work/Clients', 'Work/Clients/Acme']
 */
export function getAncestorFolderPaths(folderPath?: string | null): string[] {
  const clean = normalizeFolderPath(folderPath);
  if (!clean) return [];
  const parts = clean.split('/').filter(Boolean);
  const paths: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    paths.push(parts.slice(0, i + 1).join('/'));
  }
  return paths;
}

export function buildFolderMapByPath(folders: DBFolder[]): Map<string, DBFolder> {
  const map = new Map<string, DBFolder>();
  for (const folder of folders) {
    const clean = normalizeFolderPath(folder.path);
    if (clean) {
      map.set(clean, folder);
    }
  }
  return map;
}

/**
 * Returns every explicitly locked ancestor folder (including self) along folderPath
 * that has NOT been unlocked in the current session.
 * Ordered outer-to-inner so unlocking flows naturally from parent -> child.
 */
export function getBlockingLockedFoldersForPath(
  folderPath: string | null | undefined,
  foldersByPath: Map<string, DBFolder> | DBFolder[],
  unlockedFolderPaths: ReadonlySet<string>
): DBFolder[] {
  const map = Array.isArray(foldersByPath) ? buildFolderMapByPath(foldersByPath) : foldersByPath;
  const ancestors = getAncestorFolderPaths(folderPath);
  const blockers: DBFolder[] = [];

  for (const ancestorPath of ancestors) {
    const folder = map.get(ancestorPath);
    if (folder && folder.is_locked === 1 && !unlockedFolderPaths.has(ancestorPath)) {
      blockers.push(folder);
    }
  }

  return blockers;
}

export function isFolderEffectivelyLocked(
  folderPath: string | null | undefined,
  foldersByPath: Map<string, DBFolder> | DBFolder[],
  unlockedFolderPaths: ReadonlySet<string>
): boolean {
  return getBlockingLockedFoldersForPath(folderPath, foldersByPath, unlockedFolderPaths).length > 0;
}

export interface NoteLockInspection {
  blockingFolders: DBFolder[];
  isNoteDirectlyLocked: boolean;
  isEffectivelyLocked: boolean;
  lockReason: 'folder' | 'note' | 'both' | null;
}

export function inspectNoteLockState(
  note: Pick<NoteItem, 'id' | 'folderPath' | 'isLocked'>,
  foldersByPath: Map<string, DBFolder> | DBFolder[],
  unlockedNoteIds: ReadonlySet<string>,
  unlockedFolderPaths: ReadonlySet<string>
): NoteLockInspection {
  const blockingFolders = getBlockingLockedFoldersForPath(
    note.folderPath,
    foldersByPath,
    unlockedFolderPaths
  );
  const isNoteDirectlyLocked = Boolean(note.isLocked) && !unlockedNoteIds.has(note.id);
  const isFolderBlocked = blockingFolders.length > 0;

  let lockReason: 'folder' | 'note' | 'both' | null = null;
  if (isFolderBlocked && isNoteDirectlyLocked) {
    lockReason = 'both';
  } else if (isFolderBlocked) {
    lockReason = 'folder';
  } else if (isNoteDirectlyLocked) {
    lockReason = 'note';
  }

  return {
    blockingFolders,
    isNoteDirectlyLocked,
    isEffectivelyLocked: isFolderBlocked || isNoteDirectlyLocked,
    lockReason,
  };
}

export function isNoteEffectivelyLocked(
  note: Pick<NoteItem, 'id' | 'folderPath' | 'isLocked'>,
  foldersByPath: Map<string, DBFolder> | DBFolder[],
  unlockedNoteIds: ReadonlySet<string>,
  unlockedFolderPaths: ReadonlySet<string>
): boolean {
  return inspectNoteLockState(note, foldersByPath, unlockedNoteIds, unlockedFolderPaths)
    .isEffectivelyLocked;
}

export function computeLockedNoteIdSet(
  notes: Array<Pick<NoteItem, 'id' | 'folderPath' | 'isLocked'>>,
  folders: DBFolder[],
  unlockedNoteIds: ReadonlySet<string>,
  unlockedFolderPaths: ReadonlySet<string>
): Set<string> {
  const foldersByPath = buildFolderMapByPath(folders);
  const lockedIds = new Set<string>();

  for (const note of notes) {
    if (isNoteEffectivelyLocked(note, foldersByPath, unlockedNoteIds, unlockedFolderPaths)) {
      lockedIds.add(note.id);
    }
  }

  return lockedIds;
}

export function shouldRedactTaskForNote(
  noteId: string | null | undefined,
  lockedNoteIds: ReadonlySet<string>
): boolean {
  if (!noteId) return false;
  return lockedNoteIds.has(noteId);
}

export function shouldRedactNotification(
  notification: { noteId?: string | null; targetType?: string; targetId?: string | null },
  lockedNoteIds: ReadonlySet<string>
): boolean {
  if (notification.noteId && lockedNoteIds.has(notification.noteId)) {
    return true;
  }
  if (
    notification.targetType === 'note' &&
    notification.targetId &&
    lockedNoteIds.has(notification.targetId)
  ) {
    return true;
  }
  return false;
}

export function countNotesUnderFolder(
  folderPath: string,
  notes: Array<Pick<NoteItem, 'folderPath' | 'status'>>
): number {
  const clean = normalizeFolderPath(folderPath);
  if (!clean) return 0;
  let count = 0;
  for (const n of notes) {
    if (n.status === 'trashed') continue;
    const np = normalizeFolderPath(n.folderPath || 'General');
    if (np === clean || np.startsWith(`${clean}/`)) {
      count += 1;
    }
  }
  return count;
}

export interface CredentialVerificationInput {
  candidate: string;
  lockType: LockType | null | undefined;
  customHash?: string | null;
  customSalt?: string | null;
  securityConfig?: Pick<WorkspaceSecurityConfig, 'masterHash' | 'masterSalt'> | null;
}

/**
 * Enforces STRICT credential isolation:
 * - 'custom' items verify ONLY against item's customHash/customSalt (Master CANNOT unlock Custom items).
 * - 'master' items verify ONLY against workspace masterHash/masterSalt.
 */
export function verifyTargetCredential(input: CredentialVerificationInput): boolean {
  const { candidate, lockType, customHash, customSalt, securityConfig } = input;
  if (!candidate) return false;

  if (lockType === 'custom') {
    return verifyCredential(candidate, customHash, customSalt);
  }

  if (lockType === 'master') {
    if (!securityConfig) return false;
    return verifyCredential(candidate, securityConfig.masterHash, securityConfig.masterSalt);
  }

  return false;
}
