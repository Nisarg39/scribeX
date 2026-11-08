/**
 * ScribeX Reminders Repository
 * Source of Truth: docs/Local_Serverless_Reminder_Implementation_Plan.md
 */

import { dbClient } from './client';
import { DBReminder } from './types';
import { ReminderRecord, CreateReminderDTO, ReminderTargetType } from '../types/reminder';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class RemindersRepository {
  private mapToReminderRecord(db: DBReminder): ReminderRecord {
    return {
      id: db.id,
      userId: db.user_id,
      targetType: db.target_type,
      targetId: db.target_id,
      noteId: db.note_id || undefined,
      triggerAt: db.trigger_at,
      notificationId: db.notification_id || undefined,
      channelId: db.channel_id,
      isDismissed: db.is_dismissed === 1,
      dismissedAt: db.dismissed_at || undefined,
      deviceId: db.device_id,
      syncRev: db.sync_rev,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  public async createReminder(dto: CreateReminderDTO): Promise<ReminderRecord> {
    const id = dto.id || `rem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const userId = dto.userId || 'user-default';
    const channelId = 'scribex_reminders';
    const deviceId = 'local_client';

    // Dismiss existing active reminder for the same target if one exists
    await this.dismissReminderByTarget(dto.targetType, dto.targetId);

    const insertSql = `
      INSERT INTO reminders (
        id, user_id, target_type, target_id, note_id, trigger_at, notification_id,
        channel_id, is_dismissed, dismissed_at, device_id, sync_rev, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `;

    await dbClient.run(insertSql, [
      id,
      userId,
      dto.targetType,
      dto.targetId,
      dto.noteId || null,
      dto.triggerAt,
      channelId,
      deviceId,
    ]);

    // Append to sync_changelog for Phase 2 readiness
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'reminder', ?, 'insert', ?);`,
      [
        createLogId(),
        userId,
        id,
        JSON.stringify({
          id,
          targetType: dto.targetType,
          targetId: dto.targetId,
          noteId: dto.noteId,
          triggerAt: dto.triggerAt,
          title: dto.title,
          body: dto.body,
        }),
      ]
    );

    const created = await this.getReminderById(id);
    return created!;
  }

  public async getReminderById(id: string): Promise<ReminderRecord | null> {
    const row = await dbClient.queryFirst<DBReminder>(
      `SELECT * FROM reminders WHERE id = ?;`,
      [id]
    );
    return row ? this.mapToReminderRecord(row) : null;
  }

  public async getActiveReminderByTarget(
    targetType: ReminderTargetType,
    targetId: string
  ): Promise<ReminderRecord | null> {
    const row = await dbClient.queryFirst<DBReminder>(
      `SELECT * FROM reminders 
       WHERE target_type = ? AND target_id = ? AND is_dismissed = 0
       ORDER BY trigger_at DESC LIMIT 1;`,
      [targetType, targetId]
    );
    return row ? this.mapToReminderRecord(row) : null;
  }

  public async listActiveReminders(): Promise<ReminderRecord[]> {
    const rows = await dbClient.query<DBReminder>(
      `SELECT * FROM reminders 
       WHERE is_dismissed = 0
       ORDER BY trigger_at ASC;`
    );
    return rows.map((r) => this.mapToReminderRecord(r));
  }

  public async listReminders(filter?: {
    isDismissed?: boolean;
    targetType?: ReminderTargetType;
    noteId?: string;
  }): Promise<ReminderRecord[]> {
    let sql = `SELECT * FROM reminders WHERE 1=1`;
    const params: any[] = [];

    if (filter) {
      if (filter.isDismissed !== undefined) {
        sql += ` AND is_dismissed = ?`;
        params.push(filter.isDismissed ? 1 : 0);
      }
      if (filter.targetType) {
        sql += ` AND target_type = ?`;
        params.push(filter.targetType);
      }
      if (filter.noteId) {
        sql += ` AND note_id = ?`;
        params.push(filter.noteId);
      }
    }

    sql += ` ORDER BY trigger_at ASC;`;
    const rows = await dbClient.query<DBReminder>(sql, params);
    return rows.map((r) => this.mapToReminderRecord(r));
  }

  public async updateNotificationId(id: string, notificationId: string): Promise<void> {
    const reminder = await this.getReminderById(id);
    if (!reminder) return;

    await dbClient.run(
      `UPDATE reminders SET notification_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [notificationId, id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'reminder', ?, 'update', ?);`,
      [createLogId(), reminder.userId, id, JSON.stringify({ notificationId })]
    );
  }

  public async dismissReminder(id: string): Promise<ReminderRecord | null> {
    const reminder = await this.getReminderById(id);
    if (!reminder) return null;

    await dbClient.run(
      `UPDATE reminders 
       SET is_dismissed = 1, dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'reminder', ?, 'update', ?);`,
      [createLogId(), reminder.userId, id, JSON.stringify({ isDismissed: true })]
    );

    return this.getReminderById(id);
  }

  public async dismissReminderByTarget(
    targetType: ReminderTargetType,
    targetId: string
  ): Promise<ReminderRecord | null> {
    const active = await this.getActiveReminderByTarget(targetType, targetId);
    if (!active) return null;

    return this.dismissReminder(active.id);
  }

  public async deleteReminder(id: string): Promise<void> {
    const reminder = await this.getReminderById(id);
    if (!reminder) return;

    await dbClient.run(`DELETE FROM reminders WHERE id = ?;`, [id]);

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'reminder', ?, 'delete', ?);`,
      [createLogId(), reminder.userId, id, JSON.stringify({ id })]
    );
  }

  public async deleteRemindersByTarget(
    targetType: ReminderTargetType,
    targetId: string
  ): Promise<ReminderRecord[]> {
    const rows = await dbClient.query<DBReminder>(
      `SELECT * FROM reminders WHERE target_type = ? AND target_id = ?;`,
      [targetType, targetId]
    );
    const records = rows.map((r) => this.mapToReminderRecord(r));

    for (const rec of records) {
      await this.deleteReminder(rec.id);
    }
    return records;
  }

  public async deleteRemindersByNoteId(noteId: string): Promise<ReminderRecord[]> {
    const rows = await dbClient.query<DBReminder>(
      `SELECT * FROM reminders WHERE note_id = ?;`,
      [noteId]
    );
    const records = rows.map((r) => this.mapToReminderRecord(r));

    for (const rec of records) {
      await this.deleteReminder(rec.id);
    }
    return records;
  }
}

export const remindersRepo = new RemindersRepository();

