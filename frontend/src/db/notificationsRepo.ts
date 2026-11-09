/**
 * ScribeX In-App Notification Center Repository
 * Source of Truth: docs/Offline_Notifications_and_InApp_Notification_Center_Plan.md
 */

import { dbClient } from './client';
import {
  DBInAppNotification,
  InAppNotificationItem,
  CreateInAppNotificationDTO,
  NotificationTargetType,
  NotificationCounts,
} from './types';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class NotificationsRepository {
  private mapToNotificationItem(db: DBInAppNotification): InAppNotificationItem {
    return {
      id: db.id,
      userId: db.user_id,
      reminderId: db.reminder_id || undefined,
      targetType: db.target_type,
      targetId: db.target_id,
      noteId: db.note_id || undefined,
      title: db.title,
      body: db.body,
      triggerAt: db.trigger_at,
      recurrenceRule: db.recurrence_rule || undefined,
      isRead: db.is_read === 1,
      readAt: db.read_at || undefined,
      isCleared: db.is_cleared === 1,
      clearedAt: db.cleared_at || undefined,
      syncRev: db.sync_rev,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  public async createNotification(dto: CreateInAppNotificationDTO): Promise<InAppNotificationItem> {
    const id = dto.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const userId = dto.userId || 'user-default';

    // If an active notification already exists for this reminder/target, update it or replace it
    if (dto.targetId && dto.targetType) {
      await dbClient.run(
        `DELETE FROM in_app_notifications WHERE target_type = ? AND target_id = ?;`,
        [dto.targetType, dto.targetId]
      );
    }

    const insertSql = `
      INSERT INTO in_app_notifications (
        id, user_id, reminder_id, target_type, target_id, note_id,
        title, body, trigger_at, recurrence_rule, is_read, read_at,
        is_cleared, cleared_at, sync_rev, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `;

    await dbClient.run(insertSql, [
      id,
      userId,
      dto.reminderId || null,
      dto.targetType,
      dto.targetId,
      dto.noteId || null,
      dto.title,
      dto.body,
      dto.triggerAt,
      dto.recurrenceRule || null,
    ]);

    // Append to sync_changelog for Phase 2 dual-engine cloud sync
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'in_app_notification', ?, 'insert', ?);`,
      [
        createLogId(),
        userId,
        id,
        JSON.stringify({
          id,
          targetType: dto.targetType,
          targetId: dto.targetId,
          noteId: dto.noteId,
          title: dto.title,
          body: dto.body,
          triggerAt: dto.triggerAt,
          recurrenceRule: dto.recurrenceRule,
        }),
      ]
    );

    const created = await this.getNotificationById(id);
    return created!;
  }

  public async recordFiredNotification(dto: {
    reminderId?: string;
    targetType: NotificationTargetType;
    targetId: string;
    noteId?: string;
    title: string;
    body: string;
    triggerAt: string;
    recurrenceRule?: string;
  }): Promise<InAppNotificationItem> {
    return this.createNotification({
      reminderId: dto.reminderId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      noteId: dto.noteId,
      title: dto.title,
      body: dto.body,
      triggerAt: dto.triggerAt,
      recurrenceRule: dto.recurrenceRule,
    });
  }

  public async purgePrematureNotifications(asOfDate?: string): Promise<void> {
    const asOf = asOfDate || new Date().toISOString();
    await dbClient.run(
      `DELETE FROM in_app_notifications WHERE trigger_at > ?;`,
      [asOf]
    );

    // Normalize legacy entries that had placeholder titles/bodies
    try {
      await dbClient.run(
        `UPDATE in_app_notifications 
         SET title = body, body = '' 
         WHERE target_type = 'task' AND title = 'Task Reminder' AND body != '' AND body != 'Task Reminder';`
      );
      await dbClient.run(
        `UPDATE in_app_notifications 
         SET body = '' 
         WHERE body = 'Review Note';`
      );
    } catch {
      // ignore
    }
  }

  public async getNotificationById(id: string): Promise<InAppNotificationItem | null> {
    const row = await dbClient.queryFirst<DBInAppNotification>(
      `SELECT * FROM in_app_notifications WHERE id = ?;`,
      [id]
    );
    return row ? this.mapToNotificationItem(row) : null;
  }

  public async listNotifications(
    userId: string = 'user-default',
    filter?: {
      isRead?: boolean;
      isCleared?: boolean;
      targetType?: NotificationTargetType;
      asOfDate?: string;
    }
  ): Promise<InAppNotificationItem[]> {
    const asOf = filter?.asOfDate || new Date().toISOString();
    let sql = `SELECT * FROM in_app_notifications WHERE user_id = ? AND trigger_at <= ?`;
    const params: any[] = [userId, asOf];

    const isClearedFilter = filter?.isCleared !== undefined ? filter.isCleared : false;
    sql += ` AND is_cleared = ?`;
    params.push(isClearedFilter ? 1 : 0);

    if (filter) {
      if (filter.isRead !== undefined) {
        sql += ` AND is_read = ?`;
        params.push(filter.isRead ? 1 : 0);
      }
      if (filter.targetType) {
        sql += ` AND target_type = ?`;
        params.push(filter.targetType);
      }
    }

    sql += ` ORDER BY created_at DESC, trigger_at DESC;`;
    const rows = await dbClient.query<DBInAppNotification>(sql, params);
    return rows.map((r) => this.mapToNotificationItem(r));
  }

  public async getUnreadCount(userId: string = 'user-default', asOfDate?: string): Promise<number> {
    const asOf = asOfDate || new Date().toISOString();
    const row = await dbClient.queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ? AND is_read = 0 AND is_cleared = 0 AND trigger_at <= ?;`,
      [userId, asOf]
    );
    return row ? row.count : 0;
  }

  public async getNotificationCounts(userId: string = 'user-default', asOfDate?: string): Promise<NotificationCounts> {
    const asOf = asOfDate || new Date().toISOString();
    const row = await dbClient.queryFirst<{
      allCount: number;
      unreadCount: number;
      taskCount: number;
      noteCount: number;
    }>(
      `SELECT
        COUNT(*) as allCount,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unreadCount,
        SUM(CASE WHEN target_type = 'task' THEN 1 ELSE 0 END) as taskCount,
        SUM(CASE WHEN target_type = 'note' THEN 1 ELSE 0 END) as noteCount
       FROM in_app_notifications
       WHERE user_id = ? AND is_cleared = 0 AND trigger_at <= ?;`,
      [userId, asOf]
    );

    return {
      all: Number(row?.allCount || 0),
      unread: Number(row?.unreadCount || 0),
      tasks: Number(row?.taskCount || 0),
      notes: Number(row?.noteCount || 0),
    };
  }

  public async markAsRead(id: string, isRead: boolean = true): Promise<InAppNotificationItem | null> {
    const notif = await this.getNotificationById(id);
    if (!notif) return null;

    const readAt = isRead ? new Date().toISOString() : null;
    await dbClient.run(
      `UPDATE in_app_notifications SET is_read = ?, read_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [isRead ? 1 : 0, readAt, id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'in_app_notification', ?, 'update', ?);`,
      [createLogId(), notif.userId, id, JSON.stringify({ isRead, readAt })]
    );

    return this.getNotificationById(id);
  }

  public async markAllAsRead(userId: string = 'user-default'): Promise<void> {
    const readAt = new Date().toISOString();
    await dbClient.run(
      `UPDATE in_app_notifications SET is_read = 1, read_at = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND is_read = 0;`,
      [readAt, userId]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'in_app_notification', ?, 'update', ?);`,
      [createLogId(), userId, 'all', JSON.stringify({ isRead: true, readAt })]
    );
  }

  public async clearNotification(id: string): Promise<void> {
    const notif = await this.getNotificationById(id);
    if (!notif) return;

    await dbClient.run(
      `UPDATE in_app_notifications SET is_cleared = 1, cleared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [id]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, ?, 1, 'in_app_notification', ?, 'delete', ?);`,
      [createLogId(), notif.userId, id, JSON.stringify({ isCleared: true })]
    );
  }

  public async clearAll(userId: string = 'user-default'): Promise<void> {
    await dbClient.run(
      `UPDATE in_app_notifications SET is_cleared = 1, cleared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND is_cleared = 0;`,
      [userId]
    );
  }

  public async deleteNotificationByTarget(targetType: NotificationTargetType, targetId: string): Promise<void> {
    await dbClient.run(
      `DELETE FROM in_app_notifications WHERE target_type = ? AND target_id = ?;`,
      [targetType, targetId]
    );
  }
}

export const notificationsRepo = new NotificationsRepository();

