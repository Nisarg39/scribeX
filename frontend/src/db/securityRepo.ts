/**
 * ScribeX Security Repository
 * Manages Workspace Master Credentials, Auto-Relock Settings, and Per-Note / Per-Folder Lock Metadata.
 */

import { dbClient } from './client';
import {
  CredentialKind,
  DBWorkspaceSecurity,
  LockType,
  WorkspaceSecurityConfig,
} from './types';
import { generateSalt, hashCredential, validateCredentialFormat } from '../core/security/pinCrypto';
import { syncEngine } from '../services/sync/syncEngine';

const DEFAULT_SECURITY_ID = 'default';

const createLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const DEFAULT_SECURITY_CONFIG: WorkspaceSecurityConfig = {
  id: DEFAULT_SECURITY_ID,
  appLockEnabled: false,
  masterCredentialType: null,
  masterHash: null,
  masterSalt: null,
  masterHint: null,
  biometricsEnabled: false,
  autoRelockSeconds: 0, // 0 = immediate on exit/switch
  updatedAt: new Date().toISOString(),
};

export interface LockTargetPayload {
  lockType: LockType;
  credentialKind?: CredentialKind | null;
  secret?: string | null;
  hint?: string | null;
}

export interface ComputedLockRecord {
  isLocked: 1;
  lockType: LockType;
  lockCredentialKind: CredentialKind | null;
  lockHash: string | null;
  lockSalt: string | null;
  lockHint: string | null;
}

export function buildLockRecordFields(payload: LockTargetPayload): ComputedLockRecord {
  const cleanHint = payload.hint && payload.hint.trim().length > 0 ? payload.hint.trim() : null;

  if (payload.lockType === 'master') {
    return {
      isLocked: 1,
      lockType: 'master',
      lockCredentialKind: null,
      lockHash: null,
      lockSalt: null,
      lockHint: cleanHint,
    };
  }

  const kind: CredentialKind = payload.credentialKind || 'pin';
  const secret = payload.secret || '';
  const validation = validateCredentialFormat(secret, kind);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid custom credential format.');
  }

  const salt = generateSalt();
  const hash = hashCredential(secret, salt);

  return {
    isLocked: 1,
    lockType: 'custom',
    lockCredentialKind: kind,
    lockHash: hash,
    lockSalt: salt,
    lockHint: cleanHint,
  };
}

export class SecurityRepository {
  private mapRowToConfig(row: DBWorkspaceSecurity): WorkspaceSecurityConfig {
    return {
      id: row.id || DEFAULT_SECURITY_ID,
      appLockEnabled: Boolean(row.app_lock_enabled),
      masterCredentialType: row.master_credential_type || null,
      masterHash: row.master_hash || null,
      masterSalt: row.master_salt || null,
      masterHint: row.master_hint || null,
      biometricsEnabled: Boolean(row.biometrics_enabled),
      autoRelockSeconds:
        typeof row.auto_relock_seconds === 'number' && !Number.isNaN(row.auto_relock_seconds)
          ? row.auto_relock_seconds
          : 0,
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private async ensureSecurityRow(): Promise<DBWorkspaceSecurity> {
    const existing = await dbClient.queryFirst<DBWorkspaceSecurity>(
      `SELECT * FROM workspace_security WHERE id = ? LIMIT 1;`,
      [DEFAULT_SECURITY_ID]
    );
    if (existing) {
      return existing;
    }

    const nowIso = new Date().toISOString();
    await dbClient.run(
      `INSERT OR IGNORE INTO workspace_security (
        id, app_lock_enabled, master_credential_type, master_hash, master_salt, master_hint,
        biometrics_enabled, auto_relock_seconds, updated_at
      ) VALUES (?, 0, NULL, NULL, NULL, NULL, 0, 0, ?);`,
      [DEFAULT_SECURITY_ID, nowIso]
    );

    const created = await dbClient.queryFirst<DBWorkspaceSecurity>(
      `SELECT * FROM workspace_security WHERE id = ? LIMIT 1;`,
      [DEFAULT_SECURITY_ID]
    );
    return (
      created || {
        id: DEFAULT_SECURITY_ID,
        app_lock_enabled: 0,
        master_credential_type: null,
        master_hash: null,
        master_salt: null,
        master_hint: null,
        biometrics_enabled: 0,
        auto_relock_seconds: 0,
        updated_at: nowIso,
      }
    );
  }

  public async getSecurityConfig(): Promise<WorkspaceSecurityConfig> {
    const row = await this.ensureSecurityRow();
    return this.mapRowToConfig(row);
  }

  private async queueWorkspaceSecuritySync(cfg: WorkspaceSecurityConfig): Promise<void> {
    // Strictly syncs Master PIN/Password and auto-relock settings; NEVER syncs biometricsEnabled
    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, 'user-default', 1, 'workspace_security', ?, 'update', ?);`,
      [
        createLogId(),
        DEFAULT_SECURITY_ID,
        JSON.stringify({
          app_lock_enabled: cfg.appLockEnabled,
          master_credential_type: cfg.masterCredentialType,
          master_hash: cfg.masterHash,
          master_salt: cfg.masterSalt,
          master_hint: cfg.masterHint,
          auto_relock_seconds: cfg.autoRelockSeconds,
        }),
      ]
    );
    syncEngine.schedulePush();
  }

  public async saveMasterCredential(params: {
    secret: string;
    credentialKind: CredentialKind;
    hint?: string | null;
    enableAppLock?: boolean;
  }): Promise<WorkspaceSecurityConfig> {
    const validation = validateCredentialFormat(params.secret, params.credentialKind);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid master credential.');
    }

    const current = await this.ensureSecurityRow();
    const salt = generateSalt();
    const hash = hashCredential(params.secret, salt);
    const cleanHint = params.hint && params.hint.trim().length > 0 ? params.hint.trim() : null;
    const appLockEnabled =
      typeof params.enableAppLock === 'boolean'
        ? params.enableAppLock
          ? 1
          : 0
        : current.app_lock_enabled;
    const nowIso = new Date().toISOString();

    await dbClient.run(
      `UPDATE workspace_security
       SET master_credential_type = ?,
           master_hash = ?,
           master_salt = ?,
           master_hint = ?,
           app_lock_enabled = ?,
           updated_at = ?
       WHERE id = ?;`,
      [params.credentialKind, hash, salt, cleanHint, appLockEnabled, nowIso, DEFAULT_SECURITY_ID]
    );

    const updated = await this.getSecurityConfig();
    await this.queueWorkspaceSecuritySync(updated);
    return updated;
  }

  public async setAppLockEnabled(enabled: boolean): Promise<WorkspaceSecurityConfig> {
    const current = await this.ensureSecurityRow();
    if (enabled && (!current.master_hash || !current.master_salt)) {
      throw new Error('Configure a Master PIN or Password before enabling App Startup Lock.');
    }

    const nowIso = new Date().toISOString();
    await dbClient.run(
      `UPDATE workspace_security SET app_lock_enabled = ?, updated_at = ? WHERE id = ?;`,
      [enabled ? 1 : 0, nowIso, DEFAULT_SECURITY_ID]
    );
    const updated = await this.getSecurityConfig();
    await this.queueWorkspaceSecuritySync(updated);
    return updated;
  }

  public async setAutoRelockSeconds(seconds: number): Promise<WorkspaceSecurityConfig> {
    await this.ensureSecurityRow();
    const allowed = [0, 60, 300, 900, -1];
    const normalized = allowed.includes(seconds) ? seconds : 0;
    const nowIso = new Date().toISOString();

    await dbClient.run(
      `UPDATE workspace_security SET auto_relock_seconds = ?, updated_at = ? WHERE id = ?;`,
      [normalized, nowIso, DEFAULT_SECURITY_ID]
    );
    const updated = await this.getSecurityConfig();
    await this.queueWorkspaceSecuritySync(updated);
    return updated;
  }

  public async setBiometricsEnabled(enabled: boolean): Promise<WorkspaceSecurityConfig> {
    // Device-only preference: stored locally and intentionally excluded from cloud sync
    await this.ensureSecurityRow();
    const nowIso = new Date().toISOString();
    await dbClient.run(
      `UPDATE workspace_security SET biometrics_enabled = ?, updated_at = ? WHERE id = ?;`,
      [enabled ? 1 : 0, nowIso, DEFAULT_SECURITY_ID]
    );
    return this.getSecurityConfig();
  }

  public async countMasterLockedItems(): Promise<{ notes: number; folders: number; total: number }> {
    const noteRow = await dbClient.queryFirst<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM notes WHERE is_locked = 1 AND lock_type = 'master';`
    );
    const folderRow = await dbClient.queryFirst<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM folders WHERE is_locked = 1 AND lock_type = 'master';`
    );
    const notes = noteRow?.cnt || 0;
    const folders = folderRow?.cnt || 0;
    return { notes, folders, total: notes + folders };
  }

  public async clearMasterCredential(options?: {
    unlockMasterLockedItems?: boolean;
  }): Promise<WorkspaceSecurityConfig> {
    await this.ensureSecurityRow();
    const nowIso = new Date().toISOString();

    await dbClient.withTransaction(async () => {
      if (options?.unlockMasterLockedItems) {
        await dbClient.run(
          `UPDATE notes
           SET is_locked = 0, lock_type = NULL, lock_credential_kind = NULL, lock_hash = NULL, lock_salt = NULL, lock_hint = NULL, sync_rev = sync_rev + 1
           WHERE is_locked = 1 AND lock_type = 'master';`
        );
        await dbClient.run(
          `UPDATE folders
           SET is_locked = 0, lock_type = NULL, lock_credential_kind = NULL, lock_hash = NULL, lock_salt = NULL, lock_hint = NULL, sync_rev = sync_rev + 1
           WHERE is_locked = 1 AND lock_type = 'master';`
        );
      }

      await dbClient.run(
        `UPDATE workspace_security
         SET app_lock_enabled = 0,
             biometrics_enabled = 0,
             master_credential_type = NULL,
             master_hash = NULL,
             master_salt = NULL,
             master_hint = NULL,
             updated_at = ?
         WHERE id = ?;`,
        [nowIso, DEFAULT_SECURITY_ID]
      );
    });

    const updated = await this.getSecurityConfig();
    await this.queueWorkspaceSecuritySync(updated);
    return updated;
  }

  public async lockNoteRecord(noteId: string, payload: LockTargetPayload): Promise<ComputedLockRecord> {
    if (payload.lockType === 'master') {
      const cfg = await this.getSecurityConfig();
      if (!cfg.masterHash || !cfg.masterSalt) {
        throw new Error('Set up a Master PIN or Password before locking with Master Credential.');
      }
    }

    const record = buildLockRecordFields(payload);
    await dbClient.run(
      `UPDATE notes
       SET is_locked = ?,
           lock_type = ?,
           lock_credential_kind = ?,
           lock_hash = ?,
           lock_salt = ?,
           lock_hint = ?,
           sync_rev = sync_rev + 1
       WHERE id = ?;`,
      [
        record.isLocked,
        record.lockType,
        record.lockCredentialKind,
        record.lockHash,
        record.lockSalt,
        record.lockHint,
        noteId,
      ]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, 'user-default', 1, 'note', ?, 'update', ?);`,
      [createLogId(), noteId, JSON.stringify({ isLocked: true, lockType: record.lockType })]
    );
    syncEngine.schedulePush();

    return record;
  }

  public async batchLockNoteRecords(
    noteIds: string[],
    payload: LockTargetPayload
  ): Promise<ComputedLockRecord> {
    if (payload.lockType === 'master') {
      const cfg = await this.getSecurityConfig();
      if (!cfg.masterHash || !cfg.masterSalt) {
        throw new Error('Set up a Master PIN or Password before locking with Master Credential.');
      }
    }

    const record = buildLockRecordFields(payload);
    if (noteIds.length === 0) return record;

    await dbClient.withTransaction(async () => {
      for (const noteId of noteIds) {
        await dbClient.run(
          `UPDATE notes
           SET is_locked = ?,
               lock_type = ?,
               lock_credential_kind = ?,
               lock_hash = ?,
               lock_salt = ?,
               lock_hint = ?,
               sync_rev = sync_rev + 1
           WHERE id = ?;`,
          [
            record.isLocked,
            record.lockType,
            record.lockCredentialKind,
            record.lockHash,
            record.lockSalt,
            record.lockHint,
            noteId,
          ]
        );
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, 'user-default', 1, 'note', ?, 'update', ?);`,
          [createLogId(), noteId, JSON.stringify({ isLocked: true, lockType: record.lockType })]
        );
      }
    });
    syncEngine.schedulePush();

    return record;
  }

  public async unlockNoteRecord(noteId: string): Promise<void> {
    await dbClient.run(
      `UPDATE notes
       SET is_locked = 0,
           lock_type = NULL,
           lock_credential_kind = NULL,
           lock_hash = NULL,
           lock_salt = NULL,
           lock_hint = NULL,
           sync_rev = sync_rev + 1
       WHERE id = ?;`,
      [noteId]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, 'user-default', 1, 'note', ?, 'update', ?);`,
      [createLogId(), noteId, JSON.stringify({ isLocked: false })]
    );
    syncEngine.schedulePush();
  }

  public async batchUnlockNoteRecords(noteIds: string[]): Promise<void> {
    if (noteIds.length === 0) return;

    await dbClient.withTransaction(async () => {
      for (const noteId of noteIds) {
        await dbClient.run(
          `UPDATE notes
           SET is_locked = 0,
               lock_type = NULL,
               lock_credential_kind = NULL,
               lock_hash = NULL,
               lock_salt = NULL,
               lock_hint = NULL,
               sync_rev = sync_rev + 1
           WHERE id = ?;`,
          [noteId]
        );
        await dbClient.run(
          `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
           VALUES (?, 'user-default', 1, 'note', ?, 'update', ?);`,
          [createLogId(), noteId, JSON.stringify({ isLocked: false })]
        );
      }
    });
    syncEngine.schedulePush();
  }

  public async lockFolderRecord(folderId: string, payload: LockTargetPayload): Promise<ComputedLockRecord> {
    if (payload.lockType === 'master') {
      const cfg = await this.getSecurityConfig();
      if (!cfg.masterHash || !cfg.masterSalt) {
        throw new Error('Set up a Master PIN or Password before locking with Master Credential.');
      }
    }

    const record = buildLockRecordFields(payload);
    await dbClient.run(
      `UPDATE folders
       SET is_locked = ?,
           lock_type = ?,
           lock_credential_kind = ?,
           lock_hash = ?,
           lock_salt = ?,
           lock_hint = ?,
           sync_rev = sync_rev + 1
       WHERE id = ?;`,
      [
        record.isLocked,
        record.lockType,
        record.lockCredentialKind,
        record.lockHash,
        record.lockSalt,
        record.lockHint,
        folderId,
      ]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, 'user-default', 1, 'folder', ?, 'update', ?);`,
      [createLogId(), folderId, JSON.stringify({ isLocked: true, lockType: record.lockType })]
    );
    syncEngine.schedulePush();

    return record;
  }

  public async unlockFolderRecord(folderId: string): Promise<void> {
    await dbClient.run(
      `UPDATE folders
       SET is_locked = 0,
           lock_type = NULL,
           lock_credential_kind = NULL,
           lock_hash = NULL,
           lock_salt = NULL,
           lock_hint = NULL,
           sync_rev = sync_rev + 1
       WHERE id = ?;`,
      [folderId]
    );

    await dbClient.run(
      `INSERT OR REPLACE INTO sync_changelog (id, user_id, sync_rev, entity_type, entity_id, change_type, delta_payload)
       VALUES (?, 'user-default', 1, 'folder', ?, 'update', ?);`,
      [createLogId(), folderId, JSON.stringify({ isLocked: false })]
    );
    syncEngine.schedulePush();
  }
}

export const securityRepo = new SecurityRepository();
