/**
 * ScribeX Folders Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import {
  DBFolder,
  CreateFolderDTO,
  FolderTreeNode,
  FolderNoteStats,
  DBSyncChangelog,
  FolderSyncResult,
} from './types';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class FoldersRepository {
  public async createFolder(dto: CreateFolderDTO): Promise<DBFolder> {
    const id = dto.id || `folder-${Date.now()}`;
    const userId = dto.userId || 'user-default';
    const colorToken = dto.colorToken || 'cyan';
    const isFavorite = dto.isFavorite ? 1 : 0;
    const isPinned = dto.isPinned ? 1 : 0;
    const isArchived = dto.isArchived ? 1 : 0;

    const insertSql = `
      INSERT INTO folders (id, user_id, name, parent_id, path, color_token, icon, is_favorite, is_pinned, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await dbClient.run(insertSql, [
      id,
      userId,
      dto.name,
      dto.parentId || null,
      dto.path,
      colorToken,
      dto.icon || null,
      isFavorite,
      isPinned,
      isArchived,
    ]);

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'folder', ?, 'insert', ?);`,
      [createLogId(), userId, id, JSON.stringify(dto)]
    );

    const created = await this.getFolderById(id);
    return created!;
  }

  public async getFolderById(id: string): Promise<DBFolder | null> {
    return dbClient.queryFirst<DBFolder>(`SELECT * FROM folders WHERE id = ?;`, [id]);
  }

  public async getFolderByPath(path: string): Promise<DBFolder | null> {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, '');
    return dbClient.queryFirst<DBFolder>(`SELECT * FROM folders WHERE path = ?;`, [cleanPath]);
  }

  public async listFolders(includeArchived: boolean = false): Promise<DBFolder[]> {
    if (includeArchived) {
      return dbClient.query<DBFolder>(`SELECT * FROM folders ORDER BY is_pinned DESC, path ASC;`);
    }
    return dbClient.query<DBFolder>(`SELECT * FROM folders WHERE is_archived = 0 ORDER BY is_pinned DESC, path ASC;`);
  }

  public async getFolderHierarchy(includeArchived: boolean = false): Promise<FolderTreeNode[]> {
    const folders = await this.listFolders(includeArchived);
    const map = new Map<string, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    // Initialize map
    for (const f of folders) {
      map.set(f.id, {
        id: f.id,
        name: f.name,
        path: f.path,
        colorToken: f.color_token,
        icon: f.icon || undefined,
        isFavorite: Boolean(f.is_favorite),
        isPinned: Boolean(f.is_pinned),
        isArchived: Boolean(f.is_archived),
        children: [],
      });
    }

    // Build tree
    for (const f of folders) {
      const node = map.get(f.id)!;
      if (f.parent_id && map.has(f.parent_id)) {
        map.get(f.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  public async getFolderNoteStats(folderPath: string, folderId?: string): Promise<FolderNoteStats> {
    const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');

    // Direct notes in folder (excluding trashed)
    const directNotesRow = await dbClient.queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes 
       WHERE status != 'trashed' 
       AND (folder_path = ? OR (folder_id IS NOT NULL AND folder_id = ?));`,
      [cleanPath, folderId || '']
    );
    const directNotesCount = directNotesRow?.count || 0;

    // Nested notes in subfolders (folder_path starts with cleanPath + '/')
    const nestedNotesRow = await dbClient.queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes 
       WHERE status != 'trashed' 
       AND folder_path LIKE ?;`,
      [`${cleanPath}/%`]
    );
    const nestedNotesCount = nestedNotesRow?.count || 0;

    // Subfolders count in folders table
    const subfoldersRow = await dbClient.queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM folders 
       WHERE path LIKE ?;`,
      [`${cleanPath}/%`]
    );
    const subfoldersCount = subfoldersRow?.count || 0;

    return {
      directNotesCount,
      nestedNotesCount,
      totalNotesCount: directNotesCount + nestedNotesCount,
      subfoldersCount,
    };
  }

  public async renameFolderCascade(id: string, newName: string): Promise<{ oldPath: string; newPath: string }> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const cleanNewName = newName.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanNewName || cleanNewName.includes('/')) {
      throw new Error('Folder name cannot be empty or contain slash characters.');
    }

    const oldPath = folder.path;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = cleanNewName;
    const newPath = parts.join('/');

    if (oldPath === newPath) {
      return { oldPath, newPath };
    }

    // 1. Update target folder record
    await dbClient.run(
      `UPDATE folders SET name = ?, path = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [cleanNewName, newPath, id]
    );

    const updatedFolder = await this.getFolderById(id);
    const targetRev = updatedFolder?.sync_rev || 1;

    // 2. Update all descendant subfolders in folders table
    const descendantFolders = await dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE path LIKE ?;`,
      [`${oldPath}/%`]
    );

    for (const child of descendantFolders) {
      const childRemainder = child.path.slice(oldPath.length);
      const updatedChildPath = `${newPath}${childRemainder}`;
      await dbClient.run(
        `UPDATE folders SET path = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [updatedChildPath, child.id]
      );
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          child.user_id,
          child.sync_rev + 1,
          child.id,
          JSON.stringify({ action: 'rename_child', oldPath: child.path, newPath: updatedChildPath, timestamp: new Date().toISOString() })
        ]
      );
    }

    // 3. Update notes directly in this folder
    await dbClient.run(
      `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_path = ? OR folder_id = ?;`,
      [newPath, oldPath, id]
    );

    // 4. Update descendant notes whose folder_path starts with oldPath + '/'
    const descendantNotes = await dbClient.query<{ id: string; folder_path: string }>(
      `SELECT id, folder_path FROM notes WHERE folder_path LIKE ?;`,
      [`${oldPath}/%`]
    );

    for (const n of descendantNotes) {
      if (n.folder_path) {
        const remainder = n.folder_path.slice(oldPath.length);
        const updatedNotePath = `${newPath}${remainder}`;
        await dbClient.run(
          `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [updatedNotePath, n.id]
        );
      }
    }

    // Sync changelog for primary renamed folder
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
      [createLogId(), folder.user_id, targetRev, id, JSON.stringify({ action: 'rename', oldPath, newPath, name: cleanNewName, timestamp: new Date().toISOString() })]
    );

    return { oldPath, newPath };
  }

  public async renameFolder(id: string, newName: string): Promise<void> {
    await this.renameFolderCascade(id, newName);
  }

  public async moveFolderCascade(id: string, newParentPath: string | null): Promise<{ oldPath: string; newPath: string }> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const oldPath = folder.path;
    const cleanParent = (newParentPath || '').trim().replace(/^\/+|\/+$/g, '');

    // Cycle prevention: Cannot move into itself or a subfolder of itself
    if (cleanParent === oldPath || cleanParent.startsWith(`${oldPath}/`)) {
      throw new Error('Cannot move a folder into itself or one of its subfolders.');
    }

    const newPath = cleanParent ? `${cleanParent}/${folder.name}` : folder.name;
    if (oldPath === newPath) {
      return { oldPath, newPath };
    }

    // Resolve new parentId if cleanParent exists
    let newParentId: string | null = null;
    if (cleanParent) {
      const parentFolder = await dbClient.queryFirst<DBFolder>(
        `SELECT id FROM folders WHERE path = ?;`,
        [cleanParent]
      );
      newParentId = parentFolder?.id || null;
    }

    // 1. Update target folder record
    await dbClient.run(
      `UPDATE folders SET parent_id = ?, path = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [newParentId, newPath, id]
    );

    const updatedFolder = await this.getFolderById(id);
    const targetRev = updatedFolder?.sync_rev || 1;

    // 2. Update descendant subfolders in folders table
    const descendantFolders = await dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE path LIKE ?;`,
      [`${oldPath}/%`]
    );

    for (const child of descendantFolders) {
      const childRemainder = child.path.slice(oldPath.length);
      const updatedChildPath = `${newPath}${childRemainder}`;
      await dbClient.run(
        `UPDATE folders SET path = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
        [updatedChildPath, child.id]
      );
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          child.user_id,
          child.sync_rev + 1,
          child.id,
          JSON.stringify({ action: 'move_child', oldPath: child.path, newPath: updatedChildPath, timestamp: new Date().toISOString() })
        ]
      );
    }

    // 3. Update notes directly in this folder
    await dbClient.run(
      `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_path = ? OR folder_id = ?;`,
      [newPath, oldPath, id]
    );

    // 4. Update descendant notes
    const descendantNotes = await dbClient.query<{ id: string; folder_path: string }>(
      `SELECT id, folder_path FROM notes WHERE folder_path LIKE ?;`,
      [`${oldPath}/%`]
    );

    for (const n of descendantNotes) {
      if (n.folder_path) {
        const remainder = n.folder_path.slice(oldPath.length);
        const updatedNotePath = `${newPath}${remainder}`;
        await dbClient.run(
          `UPDATE notes SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [updatedNotePath, n.id]
        );
      }
    }

    // Sync changelog entry for moved folder
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
      [
        createLogId(),
        folder.user_id,
        targetRev,
        id,
        JSON.stringify({ action: 'move', oldPath, newPath, newParentId, timestamp: new Date().toISOString() })
      ]
    );

    return { oldPath, newPath };
  }

  public async deleteFolderCascade(
    id: string,
    folderPath: string,
    noteAction: 'moveToGeneral' | 'trash'
  ): Promise<{ affectedNotes: number; deletedFolders: number }> {
    const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
    if (cleanPath.toLowerCase() === 'general') {
      throw new Error('The default "General" folder cannot be deleted.');
    }

    // Find notes to update (both direct and nested)
    const affectedNotesList = await dbClient.query<{ id: string }>(
      `SELECT id FROM notes 
       WHERE folder_path = ? OR folder_path LIKE ? OR folder_id = ?;`,
      [cleanPath, `${cleanPath}/%`, id]
    );

    if (affectedNotesList.length > 0) {
      const noteIds = affectedNotesList.map((n) => n.id);
      const placeholders = noteIds.map(() => '?').join(',');

      if (noteAction === 'moveToGeneral') {
        await dbClient.run(
          `UPDATE notes 
           SET folder_path = 'General', folder_id = NULL, updated_at = CURRENT_TIMESTAMP 
           WHERE id IN (${placeholders});`,
          noteIds
        );
      } else {
        // Move to Trash
        await dbClient.run(
          `UPDATE notes 
           SET status = 'trashed', trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
           WHERE id IN (${placeholders});`,
          noteIds
        );
      }
    }

    // Delete folder and all its descendant subfolders
    const foldersToDelete = await dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE id = ? OR path = ? OR path LIKE ?;`,
      [id, cleanPath, `${cleanPath}/%`]
    );

    // Record tombstone delete entries in sync_changelog for each folder before deletion
    for (const f of foldersToDelete) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'delete', ?);`,
        [
          createLogId(),
          f.user_id,
          f.sync_rev + 1,
          f.id,
          JSON.stringify({
            deletedPath: f.path,
            noteAction,
            isTombstone: true,
            deletedAt: new Date().toISOString(),
          }),
        ]
      );
    }

    const folderIds = Array.from(new Set([id, ...foldersToDelete.map((f) => f.id)]));
    if (folderIds.length > 0) {
      const folderPlaceholders = folderIds.map(() => '?').join(',');
      await dbClient.run(`DELETE FROM folders WHERE id IN (${folderPlaceholders});`, folderIds);
    }

    return {
      affectedNotes: affectedNotesList.length,
      deletedFolders: folderIds.length,
    };
  }

  public async deleteFolder(id: string): Promise<void> {
    const folder = await this.getFolderById(id);
    if (folder) {
      await this.deleteFolderCascade(id, folder.path, 'moveToGeneral');
    } else {
      await dbClient.run(`DELETE FROM folders WHERE id = ?;`, [id]);
    }
  }

  public async duplicateFolderCascade(
    id: string,
    sourcePath: string,
    newName?: string
  ): Promise<{ newFolder: DBFolder; duplicatedNotesCount: number }> {
    const cleanSourcePath = sourcePath.trim().replace(/^\/+|\/+$/g, '');
    const folder = await this.getFolderById(id);
    const originalName = folder?.name || cleanSourcePath.split('/').pop() || 'Folder';
    const finalName = (newName || `${originalName} (Copy)`).trim();

    // Destination parent path
    const parentSegments = cleanSourcePath.split('/').slice(0, -1);
    const parentPath = parentSegments.join('/');
    const targetPath = parentPath ? `${parentPath}/${finalName}` : finalName;

    // Create the cloned folder record
    const newFolder = await this.createFolder({
      name: finalName,
      path: targetPath,
      parentId: folder?.parent_id || undefined,
      colorToken: folder?.color_token || 'cyan',
      icon: folder?.icon || undefined,
    });

    // Query non-trashed notes in the source folder
    const notesToClone = await dbClient.query<any>(
      `SELECT * FROM notes 
       WHERE status != 'trashed' 
       AND (folder_path = ? OR folder_id = ?);`,
      [cleanSourcePath, id]
    );

    let duplicatedCount = 0;
    for (const note of notesToClone) {
      const clonedId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const clonedTitle = note.title ? `${note.title} (Copy)` : 'Untitled Note (Copy)';

      await dbClient.run(
        `INSERT INTO notes (
          id, user_id, folder_id, folder_path, group_name, title, content_markdown, blocks_json, color_token, is_favorite, is_pinned, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active');`,
        [
          clonedId,
          note.user_id,
          newFolder.id,
          targetPath,
          note.group_name,
          clonedTitle,
          note.content_markdown,
          note.blocks_json,
          note.color_token,
        ]
      );
      duplicatedCount++;
    }

    return {
      newFolder,
      duplicatedNotesCount: duplicatedCount,
    };
  }

  public async updateFolderColor(id: string, colorToken: string): Promise<void> {
    await dbClient.run(
      `UPDATE folders SET color_token = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [colorToken, id]
    );
    const folder = await this.getFolderById(id);
    if (folder) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          folder.user_id,
          folder.sync_rev,
          id,
          JSON.stringify({ action: 'color', colorToken, timestamp: new Date().toISOString() }),
        ]
      );
    }
  }

  public async updateFolderIcon(id: string, icon: string | null): Promise<void> {
    await dbClient.run(
      `UPDATE folders SET icon = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [icon, id]
    );
    const folder = await this.getFolderById(id);
    if (folder) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          folder.user_id,
          folder.sync_rev,
          id,
          JSON.stringify({ action: 'icon', icon, timestamp: new Date().toISOString() }),
        ]
      );
    }
  }

  public async toggleFolderFavorite(id: string): Promise<boolean> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const nextVal = folder.is_favorite ? 0 : 1;
    await dbClient.run(
      `UPDATE folders SET is_favorite = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [nextVal, id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
      [
        createLogId(),
        folder.user_id,
        folder.sync_rev + 1,
        id,
        JSON.stringify({ action: 'toggle_favorite', isFavorite: Boolean(nextVal) }),
      ]
    );

    return Boolean(nextVal);
  }

  public async toggleFolderPin(id: string): Promise<boolean> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const nextVal = folder.is_pinned ? 0 : 1;
    await dbClient.run(
      `UPDATE folders SET is_pinned = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [nextVal, id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
      [
        createLogId(),
        folder.user_id,
        folder.sync_rev + 1,
        id,
        JSON.stringify({ action: 'toggle_pin', isPinned: Boolean(nextVal) }),
      ]
    );

    return Boolean(nextVal);
  }

  public async archiveFolderContained(
    id: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const cleanPath = folder.path.trim().replace(/^\/+|\/+$/g, '');

    // 1. Identify all folders to archive (the target folder + nested subfolders)
    const foldersToArchive = await dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE (id = ? OR path LIKE ?) AND is_archived = 0;`,
      [id, `${cleanPath}/%`]
    );

    // 2. Identify all active notes to archive
    const notesToArchive = await dbClient.query<{ id: string; user_id: string; sync_rev: number }>(
      `SELECT id, user_id, sync_rev FROM notes 
       WHERE status = 'active' 
       AND (folder_path = ? OR folder_path LIKE ? OR folder_id = ?);`,
      [cleanPath, `${cleanPath}/%`, id]
    );

    // 3. Update folders table
    await dbClient.run(
      `UPDATE folders SET is_archived = 1, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? OR path LIKE ?;`,
      [id, `${cleanPath}/%`]
    );

    // 4. Update notes table
    if (notesToArchive.length > 0) {
      await dbClient.run(
        `UPDATE notes SET status = 'archived', sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE status = 'active' 
         AND (folder_path = ? OR folder_path LIKE ? OR folder_id = ?);`,
        [cleanPath, `${cleanPath}/%`, id]
      );
    }

    // 5. Changelog delta tracking
    for (const f of foldersToArchive) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          f.user_id,
          f.sync_rev + 1,
          f.id,
          JSON.stringify({
            action: 'archive',
            isArchived: true,
            path: f.path,
            timestamp: new Date().toISOString(),
          }),
        ]
      );
    }

    for (const n of notesToArchive) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'note', ?, 'update', ?);`,
        [
          createLogId(),
          n.user_id,
          n.sync_rev + 1,
          n.id,
          JSON.stringify({
            action: 'archive',
            status: 'archived',
            cascadedFromFolderId: id,
            timestamp: new Date().toISOString(),
          }),
        ]
      );
    }

    return {
      affectedNotes: notesToArchive.length,
      affectedFolders: foldersToArchive.length,
    };
  }

  public async unarchiveFolderContained(
    id: string
  ): Promise<{ affectedNotes: number; affectedFolders: number }> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new Error(`Folder with id ${id} not found.`);
    }

    const cleanPath = folder.path.trim().replace(/^\/+|\/+$/g, '');

    // 1. Identify all archived folders in branch
    const foldersToUnarchive = await dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE (id = ? OR path LIKE ?) AND is_archived = 1;`,
      [id, `${cleanPath}/%`]
    );

    // 2. Identify all archived notes in this folder branch
    const notesToUnarchive = await dbClient.query<{ id: string; user_id: string; sync_rev: number }>(
      `SELECT id, user_id, sync_rev FROM notes 
       WHERE status = 'archived' 
       AND (folder_path = ? OR folder_path LIKE ? OR folder_id = ?);`,
      [cleanPath, `${cleanPath}/%`, id]
    );

    // 3. Ensure any ancestor folders are also unarchived so path isn't orphaned
    const segments = cleanPath.split('/').filter(Boolean);
    for (let i = 1; i < segments.length; i++) {
      const ancestorPath = segments.slice(0, i).join('/');
      await dbClient.run(
        `UPDATE folders SET is_archived = 0, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE path = ? AND is_archived = 1;`,
        [ancestorPath]
      );
    }

    // 4. Update folders table for target and subfolders
    await dbClient.run(
      `UPDATE folders SET is_archived = 0, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? OR path LIKE ?;`,
      [id, `${cleanPath}/%`]
    );

    // 5. Update notes table
    if (notesToUnarchive.length > 0) {
      await dbClient.run(
        `UPDATE notes SET status = 'active', sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE status = 'archived' 
         AND (folder_path = ? OR folder_path LIKE ? OR folder_id = ?);`,
        [cleanPath, `${cleanPath}/%`, id]
      );
    }

    // 6. Changelog delta tracking
    for (const f of foldersToUnarchive) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'folder', ?, 'update', ?);`,
        [
          createLogId(),
          f.user_id,
          f.sync_rev + 1,
          f.id,
          JSON.stringify({
            action: 'unarchive',
            isArchived: false,
            path: f.path,
            timestamp: new Date().toISOString(),
          }),
        ]
      );
    }

    for (const n of notesToUnarchive) {
      await dbClient.run(
        `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
         VALUES (?, ?, ?, 'note', ?, 'update', ?);`,
        [
          createLogId(),
          n.user_id,
          n.sync_rev + 1,
          n.id,
          JSON.stringify({
            action: 'unarchive',
            status: 'active',
            cascadedFromFolderId: id,
            timestamp: new Date().toISOString(),
          }),
        ]
      );
    }

    return {
      affectedNotes: notesToUnarchive.length,
      affectedFolders: foldersToUnarchive.length,
    };
  }

  public async getFavoriteFolders(): Promise<DBFolder[]> {
    return dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE is_favorite = 1 AND is_archived = 0 ORDER BY path ASC;`
    );
  }

  public async getPinnedFolders(): Promise<DBFolder[]> {
    return dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE is_pinned = 1 AND is_archived = 0 ORDER BY path ASC;`
    );
  }

  public async getArchivedFolders(): Promise<DBFolder[]> {
    return dbClient.query<DBFolder>(
      `SELECT * FROM folders WHERE is_archived = 1 ORDER BY path ASC;`
    );
  }

  public async getPendingFolderChangelogs(sinceRev = 0): Promise<DBSyncChangelog[]> {
    return dbClient.query<DBSyncChangelog>(
      `SELECT * FROM sync_changelog 
       WHERE entity_type = 'folder' AND sync_rev > ? 
       ORDER BY sync_rev ASC, created_at ASC;`,
      [sinceRev]
    );
  }

  public async isFolderTombstoned(folderId: string, path?: string): Promise<boolean> {
    const byId = await dbClient.queryFirst<DBSyncChangelog>(
      `SELECT id FROM sync_changelog WHERE entity_type = 'folder' AND entity_id = ? AND change_type = 'delete';`,
      [folderId]
    );
    if (byId) return true;

    if (path) {
      const cleanPath = path.trim().replace(/^\/+|\/+$/g, '');
      const byPath = await dbClient.queryFirst<DBSyncChangelog>(
        `SELECT id FROM sync_changelog 
         WHERE entity_type = 'folder' AND change_type = 'delete' AND delta_payload LIKE ?;`,
        [`%"deletedPath":"${cleanPath}"%`]
      );
      if (byPath) return true;
    }
    return false;
  }

  public async applyRemoteFolderDelta(entry: DBSyncChangelog): Promise<FolderSyncResult> {
    const payload = JSON.parse(entry.delta_payload || '{}');

    // 1. Remote Delete Delta
    if (entry.change_type === 'delete') {
      const existing = await this.getFolderById(entry.entity_id);
      if (existing) {
        await this.deleteFolderCascade(
          entry.entity_id,
          existing.path,
          payload.noteAction || 'moveToGeneral'
        );
      }
      return { status: 'applied', folderId: entry.entity_id };
    }

    // Check Tombstone protection
    const tombstoned = await this.isFolderTombstoned(entry.entity_id, payload.path);
    if (tombstoned) {
      return { status: 'ignored_tombstone', folderId: entry.entity_id };
    }

    // 2. Remote Insert Delta
    if (entry.change_type === 'insert') {
      const existing = await this.getFolderById(entry.entity_id);
      if (existing) {
        if (existing.sync_rev >= entry.sync_rev) {
          return { status: 'ignored_stale', folderId: entry.entity_id };
        }
      }

      let targetPath = (payload.path || payload.name || 'Folder').trim().replace(/^\/+|\/+$/g, '');
      const pathCollision = await dbClient.queryFirst<DBFolder>(
        `SELECT id FROM folders WHERE path = ? AND id != ?;`,
        [targetPath, entry.entity_id]
      );

      let statusResult: FolderSyncResult['status'] = 'applied';
      if (pathCollision) {
        targetPath = `${targetPath} (Remote)`;
        statusResult = 'conflict_renamed';
      }

      const insertSql = `
        INSERT OR REPLACE INTO folders (id, user_id, name, parent_id, path, color_token, icon, sync_rev, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
      `;
      await dbClient.run(insertSql, [
        entry.entity_id,
        entry.user_id,
        payload.name,
        payload.parentId || null,
        targetPath,
        payload.colorToken || 'cyan',
        payload.icon || null,
        entry.sync_rev,
      ]);

      return { status: statusResult, folderId: entry.entity_id, effectivePath: targetPath };
    }

    // 3. Remote Update Delta
    if (entry.change_type === 'update') {
      const existing = await this.getFolderById(entry.entity_id);
      if (!existing) {
        return { status: 'ignored_stale', folderId: entry.entity_id };
      }

      if (existing.sync_rev >= entry.sync_rev) {
        return { status: 'ignored_stale', folderId: entry.entity_id };
      }

      if (payload.action === 'rename' || payload.newPath) {
        await this.renameFolderCascade(entry.entity_id, payload.name || payload.newName);
      } else if (payload.action === 'move') {
        await this.moveFolderCascade(entry.entity_id, payload.newParentPath || null);
      } else if (payload.action === 'color') {
        await dbClient.run(
          `UPDATE folders SET color_token = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [payload.colorToken, entry.sync_rev, entry.entity_id]
        );
      } else if (payload.action === 'icon') {
        await dbClient.run(
          `UPDATE folders SET icon = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [payload.icon || null, entry.sync_rev, entry.entity_id]
        );
      } else if (payload.action === 'toggle_favorite') {
        await dbClient.run(
          `UPDATE folders SET is_favorite = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [payload.isFavorite ? 1 : 0, entry.sync_rev, entry.entity_id]
        );
      } else if (payload.action === 'toggle_pin') {
        await dbClient.run(
          `UPDATE folders SET is_pinned = ?, sync_rev = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [payload.isPinned ? 1 : 0, entry.sync_rev, entry.entity_id]
        );
      } else if (payload.action === 'archive') {
        await this.archiveFolderContained(entry.entity_id);
      } else if (payload.action === 'unarchive') {
        await this.unarchiveFolderContained(entry.entity_id);
      }

      return { status: 'applied', folderId: entry.entity_id, effectivePath: payload.newPath };
    }

    return { status: 'applied', folderId: entry.entity_id };
  }

  public async resolvePathCollisions(): Promise<number> {
    const duplicates = await dbClient.query<{ path: string; count: number }>(
      `SELECT path, COUNT(*) as count FROM folders GROUP BY path HAVING count > 1;`
    );

    let resolvedCount = 0;
    for (const dup of duplicates) {
      const matching = await dbClient.query<DBFolder>(
        `SELECT * FROM folders WHERE path = ? ORDER BY sync_rev DESC, updated_at DESC;`,
        [dup.path]
      );
      for (let i = 1; i < matching.length; i++) {
        const item = matching[i];
        const newPath = `${item.path} (Conflict-${i})`;
        await dbClient.run(
          `UPDATE folders SET path = ?, sync_rev = sync_rev + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          [newPath, item.id]
        );
        resolvedCount++;
      }
    }
    return resolvedCount;
  }
}

export const foldersRepo = new FoldersRepository();
