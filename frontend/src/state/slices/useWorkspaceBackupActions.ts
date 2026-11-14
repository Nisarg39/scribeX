import React, { useCallback } from 'react';
import { NoteItem, TaskItem } from '../../types/note';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';

export interface UseWorkspaceBackupActionsProps {
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  refreshFromDB: () => Promise<void>;
}

export function useWorkspaceBackupActions({
  setNotes,
  setTasks,
  refreshFromDB,
}: UseWorkspaceBackupActionsProps) {
  const emptyTrash = useCallback(async () => {
    setNotes((prev) => prev.filter((n) => n.status !== 'trashed'));
    try {
      await notesRepo.emptyTrashCascade();
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to empty trash via notesRepo:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchDeleteNotes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: 'trashed' } : n))
    );
    try {
      await notesRepo.batchSoftDeleteNotes(ids);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch soft-delete notes:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchMoveNotesToFolder = useCallback(async (ids: string[], folderPath: string, folderId?: string) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, folderPath, folderId } : n))
    );
    try {
      await notesRepo.batchMoveNotesToFolder(ids, folderPath, folderId);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch move notes to folder:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchTogglePin = useCallback(async (ids: string[], pin: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, isPinned: pin } : n))
    );
    try {
      await notesRepo.batchTogglePinNotes(ids, pin);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch toggle pin:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchArchiveNotes = useCallback(async (ids: string[], archive: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const newStatus = archive ? 'archived' : 'active';
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: newStatus } : n))
    );
    try {
      await notesRepo.batchArchiveNotes(ids, archive);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch archive notes:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchRestoreNotes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, status: 'active' } : n))
    );
    try {
      await notesRepo.batchRestoreNotes(ids);
      await refreshFromDB();
    } catch (err) {
      console.warn('Failed to batch restore notes:', err);
    }
  }, [refreshFromDB, setNotes]);

  const batchPermanentlyDeleteNotes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setNotes((prev) => prev.filter((n) => !idSet.has(n.id)));
    setTasks((prev) => prev.filter((t) => !t.noteId || !idSet.has(t.noteId)));
    try {
      await notesRepo.batchPermanentlyDeleteNotes(ids);
      for (const id of ids) {
        await tasksRepo.syncNoteChecklists(id, '', 'apricot', []);
      }
    } catch (err) {
      console.warn('Failed to batch permanently delete notes:', err);
    }
  }, [setNotes, setTasks]);

  return {
    emptyTrash,
    batchDeleteNotes,
    batchMoveNotesToFolder,
    batchTogglePin,
    batchArchiveNotes,
    batchRestoreNotes,
    batchPermanentlyDeleteNotes,
  };
}
