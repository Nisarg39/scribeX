import React, { useCallback } from 'react';
import { DBFolder, FolderNoteStats, DBSyncChangelog, FolderSyncResult } from '../../db/types';
import { foldersRepo } from '../../db/foldersRepo';
import { NoteItem } from '../../types/note';
import { NoteQueryRequest } from '../../core/noteQueryEngine';

export interface UseFolderStoreActionsProps {
  folders: DBFolder[];
  setFolders: React.Dispatch<React.SetStateAction<DBFolder[]>>;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
  queryRequest: NoteQueryRequest;
  setFolderFilter: (folderPath: string | null) => void;
  logWorkspaceActivity: (
    category: 'search' | 'note_lifecycle' | 'folder' | 'tag' | 'task' | 'sync',
    action: string,
    summary: string,
    targetId?: string
  ) => void;
  refreshFromDB: () => Promise<void>;
}

export function useFolderStoreActions({
  folders,
  setFolders,
  notes,
  setNotes,
  queryRequest,
  setFolderFilter,
  logWorkspaceActivity,
  refreshFromDB,
}: UseFolderStoreActionsProps) {
  const createFolder = useCallback(async (name: string, parentPath?: string): Promise<DBFolder> => {
    const cleanName = name.trim().replace(/^\/+|\/+$/g, '');
    const cleanParent = (parentPath || '').trim().replace(/^\/+|\/+$/g, '');
    const fullPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
    const segments = fullPath.split('/').map((s) => s.trim()).filter(Boolean);

    let currentPath = '';
    let parentId: string | undefined = undefined;
    let lastCreated: DBFolder | null = null;
    const newlyCreated: DBFolder[] = [];

    for (const seg of segments) {
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      const existing = [...folders, ...newlyCreated].find((f) => (f.path || f.name) === currentPath);
      if (existing) {
        parentId = existing.id;
        lastCreated = existing;
      } else {
        const created = await foldersRepo.createFolder({
          name: seg,
          path: currentPath,
          parentId,
          colorToken: 'cyan',
        });
        newlyCreated.push(created);
        parentId = created.id;
        lastCreated = created;
      }
    }

    if (newlyCreated.length > 0) {
      setFolders((prev) => [...prev, ...newlyCreated]);
    }
    return lastCreated!;
  }, [folders, setFolders]);

  const renameFolder = useCallback(async (id: string, newName: string) => {
    try {
      const { oldPath, newPath } = await foldersRepo.renameFolderCascade(id, newName);
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === id) {
            return { ...f, name: newName, path: newPath };
          }
          if (f.path.startsWith(`${oldPath}/`)) {
            return { ...f, path: `${newPath}${f.path.slice(oldPath.length)}` };
          }
          return f;
        })
      );
      setNotes((prev) =>
        prev.map((n) => {
          if (n.folderPath === oldPath) {
            return { ...n, folderPath: newPath };
          }
          if (n.folderPath?.startsWith(`${oldPath}/`)) {
            return { ...n, folderPath: `${newPath}${n.folderPath.slice(oldPath.length)}` };
          }
          return n;
        })
      );
      if (queryRequest.folderPath === oldPath) {
        setFolderFilter(newPath);
      } else if (queryRequest.folderPath?.startsWith(`${oldPath}/`)) {
        setFolderFilter(`${newPath}${queryRequest.folderPath.slice(oldPath.length)}`);
      }
      logWorkspaceActivity('folder', 'rename', `Renamed folder "${oldPath}" to "${newPath}"`, id);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to rename folder:', err);
      throw err;
    }
  }, [queryRequest.folderPath, refreshFromDB, setFolderFilter, setFolders, setNotes, logWorkspaceActivity]);

  const moveFolder = useCallback(async (id: string, newParentPath: string | null) => {
    try {
      const { oldPath, newPath } = await foldersRepo.moveFolderCascade(id, newParentPath);
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === id) {
            return { ...f, path: newPath };
          }
          if (f.path.startsWith(`${oldPath}/`)) {
            return { ...f, path: `${newPath}${f.path.slice(oldPath.length)}` };
          }
          return f;
        })
      );
      setNotes((prev) =>
        prev.map((n) => {
          if (n.folderPath === oldPath) {
            return { ...n, folderPath: newPath };
          }
          if (n.folderPath?.startsWith(`${oldPath}/`)) {
            return { ...n, folderPath: `${newPath}${n.folderPath.slice(oldPath.length)}` };
          }
          return n;
        })
      );
      if (queryRequest.folderPath === oldPath) {
        setFolderFilter(newPath);
      } else if (queryRequest.folderPath?.startsWith(`${oldPath}/`)) {
        setFolderFilter(`${newPath}${queryRequest.folderPath.slice(oldPath.length)}`);
      }
      logWorkspaceActivity('folder', 'move', `Moved folder "${oldPath}" to "${newPath}"`, id);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to move folder:', err);
      throw err;
    }
  }, [queryRequest.folderPath, refreshFromDB, setFolderFilter, setFolders, setNotes, logWorkspaceActivity]);

  const deleteFolderWithOptions = useCallback(async (
    id: string,
    folderPath: string,
    noteAction: 'moveToGeneral' | 'trash'
  ) => {
    try {
      const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
      const res = await foldersRepo.deleteFolderCascade(id, cleanPath, noteAction);

      setFolders((prev) =>
        prev.filter((f) => f.id !== id && f.path !== cleanPath && !f.path.startsWith(`${cleanPath}/`))
      );

      if (noteAction === 'moveToGeneral') {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.folderId === id || n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`)) {
              return { ...n, folderPath: 'General', folderId: undefined };
            }
            return n;
          })
        );
      } else {
        const nowIso = new Date().toISOString();
        setNotes((prev) =>
          prev.map((n) => {
            if (n.folderId === id || n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`)) {
              return { ...n, status: 'trashed', trashedAt: nowIso };
            }
            return n;
          })
        );
      }

      if (queryRequest.folderPath === cleanPath || queryRequest.folderPath?.startsWith(`${cleanPath}/`)) {
        setFolderFilter(null);
      }

      logWorkspaceActivity(
        'folder',
        'delete',
        `Deleted folder "${cleanPath}" (${res.affectedNotes} notes ${noteAction === 'moveToGeneral' ? 'moved to General' : 'trashed'})`,
        id
      );

      await refreshFromDB();
      return res;
    } catch (err) {
      console.warn('Failed to delete folder cascade:', err);
      throw err;
    }
  }, [queryRequest.folderPath, refreshFromDB, setFolderFilter, setFolders, setNotes, logWorkspaceActivity]);

  const deleteFolder = useCallback(async (id: string) => {
    const folder = folders.find((f) => f.id === id);
    const folderPath = folder?.path || folder?.name || '';
    await deleteFolderWithOptions(id, folderPath, 'moveToGeneral');
  }, [deleteFolderWithOptions, folders]);

  const duplicateFolder = useCallback(async (id: string, folderPath: string, newName?: string): Promise<DBFolder> => {
    try {
      const { newFolder, duplicatedNotesCount } = await foldersRepo.duplicateFolderCascade(id, folderPath, newName);
      logWorkspaceActivity(
        'folder',
        'duplicate',
        `Duplicated folder "${folderPath}" -> "${newFolder.path}" (${duplicatedNotesCount} notes copied)`,
        newFolder.id
      );
      await refreshFromDB();
      return newFolder;
    } catch (err) {
      console.warn('Failed to duplicate folder:', err);
      throw err;
    }
  }, [logWorkspaceActivity, refreshFromDB]);

  const updateFolderColor = useCallback(async (id: string, colorToken: string): Promise<void> => {
    try {
      await foldersRepo.updateFolderColor(id, colorToken);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, color_token: colorToken } : f)));
    } catch (err) {
      console.warn('Failed to update folder color:', err);
    }
  }, [setFolders]);

  const updateFolderIcon = useCallback(async (id: string, icon: string | null): Promise<void> => {
    try {
      await foldersRepo.updateFolderIcon(id, icon);
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, icon } : f)));
    } catch (err) {
      console.warn('Failed to update folder icon:', err);
    }
  }, [setFolders]);

  const toggleFolderFavorite = useCallback(async (folderId: string): Promise<boolean> => {
    try {
      const isFav = await foldersRepo.toggleFolderFavorite(folderId);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, is_favorite: isFav ? 1 : 0 } : f))
      );
      return isFav;
    } catch (err) {
      console.warn('Failed to toggle folder favorite:', err);
      return false;
    }
  }, [setFolders]);

  const toggleFolderPin = useCallback(async (folderId: string): Promise<boolean> => {
    try {
      const isPinned = await foldersRepo.toggleFolderPin(folderId);
      setFolders((prev) => {
        const updated = prev.map((f) => (f.id === folderId ? { ...f, is_pinned: isPinned ? 1 : 0 } : f));
        return updated.sort((a, b) => (b.is_pinned - a.is_pinned) || a.path.localeCompare(b.path));
      });
      return isPinned;
    } catch (err) {
      console.warn('Failed to toggle folder pin:', err);
      return false;
    }
  }, [setFolders]);

  const archiveFolder = useCallback(async (
    folderId: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> => {
    try {
      const folder = folders.find((f) => f.id === folderId);
      const res = await foldersRepo.archiveFolderContained(folderId);
      const cleanPath = folder ? (folder.path || folder.name).trim().replace(/^\/+|\/+$/g, '') : '';

      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === folderId || (cleanPath && f.path.startsWith(`${cleanPath}/`))) {
            return { ...f, is_archived: 1 };
          }
          return f;
        })
      );

      setNotes((prev) =>
        prev.map((n) => {
          if (
            n.status === 'active' &&
            (n.folderId === folderId ||
              (cleanPath && (n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`))))
          ) {
            return { ...n, status: 'archived', updatedAt: new Date().toISOString() };
          }
          return n;
        })
      );

      if (
        queryRequest.folderPath &&
        cleanPath &&
        (queryRequest.folderPath === cleanPath || queryRequest.folderPath.startsWith(`${cleanPath}/`))
      ) {
        if (queryRequest.statusScope !== 'archived') {
          setFolderFilter(null);
        }
      }

      return res;
    } catch (err) {
      console.warn('Failed to archive folder:', err);
      return { affectedNotes: 0, affectedFolders: 0 };
    }
  }, [folders, queryRequest.folderPath, queryRequest.statusScope, setFolderFilter, setFolders, setNotes]);

  const unarchiveFolder = useCallback(async (
    folderId: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> => {
    try {
      const folder = folders.find((f) => f.id === folderId);
      const res = await foldersRepo.unarchiveFolderContained(folderId);
      const cleanPath = folder ? (folder.path || folder.name).trim().replace(/^\/+|\/+$/g, '') : '';
      const segments = cleanPath.split('/').filter(Boolean);
      const ancestorPaths = new Set(segments.map((_, i) => segments.slice(0, i + 1).join('/')));

      setFolders((prev) =>
        prev.map((f) => {
          if (
            f.id === folderId ||
            (cleanPath && f.path.startsWith(`${cleanPath}/`)) ||
            ancestorPaths.has(f.path)
          ) {
            return { ...f, is_archived: 0 };
          }
          return f;
        })
      );

      setNotes((prev) =>
        prev.map((n) => {
          if (
            n.status === 'archived' &&
            (n.folderId === folderId ||
              (cleanPath && (n.folderPath === cleanPath || n.folderPath?.startsWith(`${cleanPath}/`))))
          ) {
            return { ...n, status: 'active', updatedAt: new Date().toISOString() };
          }
          return n;
        })
      );

      return res;
    } catch (err) {
      console.warn('Failed to unarchive folder:', err);
      return { affectedNotes: 0, affectedFolders: 0 };
    }
  }, [folders, setFolders, setNotes]);

  const getFolderStats = useCallback(async (folderPath: string, folderId?: string): Promise<FolderNoteStats> => {
    try {
      return await foldersRepo.getFolderNoteStats(folderPath, folderId);
    } catch (err) {
      const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
      const direct = notes.filter((n) => n.status !== 'trashed' && (n.folderPath === cleanPath || n.folderId === folderId)).length;
      const nested = notes.filter((n) => n.status !== 'trashed' && n.folderPath?.startsWith(`${cleanPath}/`)).length;
      const subfolders = folders.filter((f) => f.path.startsWith(`${cleanPath}/`)).length;
      return {
        directNotesCount: direct,
        nestedNotesCount: nested,
        totalNotesCount: direct + nested,
        subfoldersCount: subfolders,
      };
    }
  }, [folders, notes]);

  const getPendingFolderChangelogs = useCallback(async (sinceRev = 0): Promise<DBSyncChangelog[]> => {
    return foldersRepo.getPendingFolderChangelogs(sinceRev);
  }, []);

  const applyRemoteFolderDelta = useCallback(async (entry: DBSyncChangelog): Promise<FolderSyncResult> => {
    const res = await foldersRepo.applyRemoteFolderDelta(entry);
    await refreshFromDB();
    return res;
  }, [refreshFromDB]);

  return {
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolderWithOptions,
    deleteFolder,
    duplicateFolder,
    updateFolderColor,
    updateFolderIcon,
    toggleFolderFavorite,
    toggleFolderPin,
    archiveFolder,
    unarchiveFolder,
    getFolderStats,
    getPendingFolderChangelogs,
    applyRemoteFolderDelta,
  };
}
