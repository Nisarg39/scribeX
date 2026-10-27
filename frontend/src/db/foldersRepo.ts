/**
 * ScribeX Folders Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBFolder, CreateFolderDTO, FolderTreeNode } from './types';

export class FoldersRepository {
  public async createFolder(dto: CreateFolderDTO): Promise<DBFolder> {
    const id = dto.id || `folder-${Date.now()}`;
    const userId = dto.userId || 'user-default';
    const colorToken = dto.colorToken || 'cyan';

    const insertSql = `
      INSERT INTO folders (id, user_id, name, parent_id, path, color_token, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    await dbClient.run(insertSql, [
      id,
      userId,
      dto.name,
      dto.parentId || null,
      dto.path,
      colorToken,
      dto.icon || null,
    ]);

    await dbClient.run(
      `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'folder', ?, 'insert', ?);`,
      [`log-${Date.now()}`, userId, id, JSON.stringify(dto)]
    );

    const created = await this.getFolderById(id);
    return created!;
  }

  public async getFolderById(id: string): Promise<DBFolder | null> {
    return dbClient.queryFirst<DBFolder>(`SELECT * FROM folders WHERE id = ?;`, [id]);
  }

  public async listFolders(): Promise<DBFolder[]> {
    return dbClient.query<DBFolder>(`SELECT * FROM folders ORDER BY path ASC;`);
  }

  public async getFolderHierarchy(): Promise<FolderTreeNode[]> {
    const folders = await this.listFolders();
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

  public async renameFolder(id: string, newName: string): Promise<void> {
    const folder = await this.getFolderById(id);
    if (!folder) return;

    // Update path
    const parts = folder.path.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');

    await dbClient.run(
      `UPDATE folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [newName, newPath, id]
    );

    // Update notes residing in this folder
    await dbClient.run(
      `UPDATE notes SET folder_path = ? WHERE folder_id = ?;`,
      [newPath, id]
    );
  }

  public async deleteFolder(id: string): Promise<void> {
    await dbClient.run(`DELETE FROM folders WHERE id = ?;`, [id]);
  }
}

export const foldersRepo = new FoldersRepository();
