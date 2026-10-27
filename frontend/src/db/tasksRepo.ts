/**
 * ScribeX Tasks Repository
 * Source of Truth: docs/Universal_Note_Input_Structure_and_Relations.md
 */

import { dbClient } from './client';
import { DBTask, CreateTaskDTO, TaskFilter } from './types';
import { TaskItem } from '../types/note';
import { NoteColorToken } from '../theme/tokens';

export class TasksRepository {
  private mapToTaskItem(dbTask: DBTask): TaskItem {
    return {
      id: dbTask.id,
      userId: dbTask.user_id,
      noteId: dbTask.note_id || undefined,
      noteTitle: dbTask.note_title || undefined,
      noteColorToken: (dbTask.note_color_token as NoteColorToken) || undefined,
      blockId: dbTask.block_id || undefined,
      title: dbTask.title,
      isCompleted: dbTask.is_completed === 1,
      priority: dbTask.priority,
      dueDate: dbTask.due_date || undefined,
      createdAt: dbTask.created_at,
      updatedAt: dbTask.updated_at,
    };
  }

  public async createTask(dto: CreateTaskDTO): Promise<TaskItem> {
    const taskId = dto.id || `task-${Date.now()}`;
    const userId = dto.userId || 'user-default';
    const cleanTitle = dto.title.trim();
    const priority = dto.priority || 'none';
    const dueDate = dto.dueDate || 'Today';

    const insertSql = `
      INSERT INTO tasks (
        id, user_id, note_id, note_title, note_color_token, block_id, title, is_completed, priority, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await dbClient.run(insertSql, [
      taskId,
      userId,
      dto.noteId || null,
      dto.noteTitle || null,
      dto.noteColorToken || null,
      dto.blockId || null,
      cleanTitle,
      dto.isCompleted ? 1 : 0,
      priority,
      dueDate,
    ]);

    await dbClient.run(
      `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'task', ?, 'insert', ?);`,
      [`log-${Date.now()}`, userId, taskId, JSON.stringify({ id: taskId, title: cleanTitle })]
    );

    const created = await this.getTaskById(taskId);
    return created!;
  }

  public async getTaskById(id: string): Promise<TaskItem | null> {
    const row = await dbClient.queryFirst<DBTask>(
      `SELECT * FROM tasks WHERE id = ?;`,
      [id]
    );
    return row ? this.mapToTaskItem(row) : null;
  }

  public async listTasks(filter?: TaskFilter): Promise<TaskItem[]> {
    let sql = `SELECT * FROM tasks WHERE 1=1`;
    const params: any[] = [];

    if (filter) {
      if (filter.noteId) {
        sql += ` AND note_id = ?`;
        params.push(filter.noteId);
      }
      if (filter.isCompleted !== undefined) {
        sql += ` AND is_completed = ?`;
        params.push(filter.isCompleted ? 1 : 0);
      }
      if (filter.priority) {
        sql += ` AND priority = ?`;
        params.push(filter.priority);
      }
      if (filter.dueToday) {
        sql += ` AND due_date = 'Today'`;
      }
    }

    sql += ` ORDER BY is_completed ASC, created_at DESC;`;

    const rows = await dbClient.query<DBTask>(sql, params);
    return rows.map((r) => this.mapToTaskItem(r));
  }

  public async toggleTask(id: string): Promise<boolean> {
    const task = await this.getTaskById(id);
    if (!task) return false;

    const nextVal = !task.isCompleted;
    await dbClient.run(
      `UPDATE tasks SET is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [nextVal ? 1 : 0, id]
    );

    await dbClient.run(
      `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'task', ?, 'update', ?);`,
      [`log-${Date.now()}`, task.userId, id, JSON.stringify({ isCompleted: nextVal })]
    );

    return nextVal;
  }

  public async updateTask(id: string, updates: Partial<TaskItem>): Promise<TaskItem> {
    const existing = await this.getTaskById(id);
    if (!existing) throw new Error(`Task not found with id: ${id}`);

    const clauses: string[] = [];
    const params: any[] = [];

    if (updates.title !== undefined) {
      clauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.isCompleted !== undefined) {
      clauses.push('is_completed = ?');
      params.push(updates.isCompleted ? 1 : 0);
    }
    if (updates.priority !== undefined) {
      clauses.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.dueDate !== undefined) {
      clauses.push('due_date = ?');
      params.push(updates.dueDate);
    }

    clauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await dbClient.run(`UPDATE tasks SET ${clauses.join(', ')} WHERE id = ?;`, params);
    const updated = await this.getTaskById(id);
    return updated!;
  }

  public async deleteTask(id: string): Promise<void> {
    const task = await this.getTaskById(id);
    if (!task) return;

    await dbClient.run(`DELETE FROM tasks WHERE id = ?;`, [id]);

    await dbClient.run(
      `INSERT INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'task', ?, 'delete', ?);`,
      [`log-${Date.now()}`, task.userId, id, JSON.stringify({ id })]
    );
  }

  public async getTasksByNoteId(noteId: string): Promise<TaskItem[]> {
    return this.listTasks({ noteId });
  }

  public async syncNoteChecklists(
    noteId: string,
    noteTitle: string,
    noteColorToken: NoteColorToken | undefined,
    checklistItems: Array<{ id: string; text: string; checked: boolean; priority?: any; dueDate?: string }>
  ): Promise<void> {
    const existing = await this.getTasksByNoteId(noteId);
    const existingIds = new Set(existing.map((t) => t.id));
    const currentIds = new Set(checklistItems.map((c) => c.id));

    // 1. Delete tasks that were removed from the note
    for (const ex of existing) {
      if (!currentIds.has(ex.id)) {
        await this.deleteTask(ex.id);
      }
    }

    // 2. Insert or update
    for (const item of checklistItems) {
      if (!item.text.trim()) continue;

      if (existingIds.has(item.id)) {
        await this.updateTask(item.id, {
          title: item.text.trim(),
          isCompleted: item.checked,
          priority: item.priority || 'none',
          dueDate: item.dueDate || 'Today',
        });
      } else {
        await this.createTask({
          id: item.id,
          noteId,
          noteTitle,
          noteColorToken,
          title: item.text.trim(),
          isCompleted: item.checked,
          priority: item.priority || 'none',
          dueDate: item.dueDate || 'Today',
        });
      }
    }
  }
}

export const tasksRepo = new TasksRepository();
