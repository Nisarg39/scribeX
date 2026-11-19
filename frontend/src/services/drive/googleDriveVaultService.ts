/**
 * ScribeX Zero-Cost Google Drive Media Vault Service
 * Source of Truth: docs/Unified_Backend_and_AI_Master_Specification.md (Section 3.2.1 & Phase 2)
 *
 * Manages:
 * 1. Dedicated Google Drive Account Linking / Switching (`drive.file` scope, `prompt: select_account`)
 * 2. Background Multipart Upload to `ScribeX_Vault/` + Immediate Local Binary Deletion
 * 3. On-Demand Temp Cache Hydration (`cacheDirectory/gdrive_temp/<noteId>/`) when Editor opens
 * 4. Immediate Temp Cache Purge when Editor closes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { dbClient } from '../../db/client';
import { ComposableBlock } from '../../types/note';
import { isSupabaseConfigured, supabase } from '../supabase/supabaseClient';

export const GDRIVE_PREFIX = 'gdrive://';
export const GDRIVE_TEMP_ROOT = `${FileSystem.cacheDirectory || ''}gdrive_temp/`;
const VAULT_FOLDER_NAME = 'ScribeX_Vault';

const STORAGE_DRIVE_ACCOUNT_PREFIX = 'scribex_gdrive_account:';
const STORAGE_DRIVE_ONBOARDED_PREFIX = 'scribex_gdrive_onboarded:';

export interface GoogleDriveAccountState {
  email: string;
  displayName?: string;
  accessToken: string;
  expiresAt?: number;
  vaultFolderId?: string;
  linkedAt: string;
  source: 'direct_google_oauth' | 'supabase_provider_token';
}

export interface DriveMediaUploadResult {
  blocks: ComposableBlock[];
  uploadedCount: number;
  deletedLocalCount: number;
}

const MEDIA_BLOCK_TYPES = new Set(['image', 'audio', 'video', 'file', 'scan']);

// In-memory registry mapping temp playback URIs back to canonical gdrive://<fileId> URIs
const tempToPersistedUriByNote = new Map<string, Map<string, string>>();
const webBlobUrlsByNote = new Map<string, string[]>();

function isRemoteHttpOrCloudUri(uri: string): boolean {
  return (
    uri.startsWith(GDRIVE_PREFIX) ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('#')
  );
}

export function isLocalUploadableUri(uri?: string | null): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed || isRemoteHttpOrCloudUri(trimmed)) return false;
  if (trimmed.includes('/gdrive_temp/')) return false;
  return (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  );
}

/**
 * Persists a newly picked image locally on-device before either Guest SQLite persistence
 * or Logged-In background upload to Google Drive `ScribeX_Vault/`.
 * - Native (iOS/Android): copies into `documentDirectory/local_media/`
 * - Web: converts to persistent `data:<mimeType>;base64,...` URI
 */
export async function stagePickedImageLocally(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
}): Promise<{ uri: string; fileName: string; mimeType: string }> {
  const mimeType = asset.mimeType || 'image/jpeg';
  const rawExt = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = asset.fileName || `image_${Date.now()}.${ext}`;

  if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
    const localDir = `${FileSystem.documentDirectory}local_media/`;
    await FileSystem.makeDirectoryAsync(localDir, { intermediates: true }).catch(() => {});
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destUri = `${localDir}${safeName}`;
    await FileSystem.copyAsync({ from: asset.uri, to: destUri });
    return { uri: destUri, fileName, mimeType };
  }

  if (asset.uri.startsWith('data:')) {
    return { uri: asset.uri, fileName, mimeType };
  }
  if (asset.base64) {
    return { uri: `data:${mimeType};base64,${asset.base64}`, fileName, mimeType };
  }

  const resp = await fetch(asset.uri);
  const blob = await resp.blob();
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || asset.uri));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { uri: dataUri, fileName, mimeType };
}

/**
 * Deletes a managed local image in `documentDirectory/local_media/` when replaced or removed.
 */
export async function deleteLocalMediaIfManaged(uri?: string | null): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  if (!uri.includes('/local_media/')) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export function extractMediaUriFromBlock(block: ComposableBlock): string | null {
  if (!MEDIA_BLOCK_TYPES.has(block.type)) return null;
  const meta = block.metadata || {};

  if (block.type === 'scan') {
    return meta.imageUrl || meta.rawImageUrl || meta.url || null;
  }
  if (block.type === 'audio') {
    return block.content || meta.url || meta.audioUrl || null;
  }
  return block.content || meta.url || null;
}

export function applyMediaUriToBlock(
  block: ComposableBlock,
  nextUri: string,
  driveMeta?: { driveFileId?: string; fileName?: string; mimeType?: string }
): ComposableBlock {
  const nextMeta = {
    ...(block.metadata || {}),
    ...(driveMeta?.driveFileId ? { driveFileId: driveMeta.driveFileId } : {}),
    ...(driveMeta?.fileName ? { fileName: driveMeta.fileName } : {}),
    ...(driveMeta?.mimeType ? { mimeType: driveMeta.mimeType } : {}),
  };

  if (block.type === 'scan') {
    return {
      ...block,
      metadata: {
        ...nextMeta,
        imageUrl: nextUri,
      },
    };
  }

  if (block.type === 'audio') {
    return {
      ...block,
      content: nextUri,
      metadata: {
        ...nextMeta,
        url: nextUri,
        audioUrl: nextUri,
      },
    };
  }

  return {
    ...block,
    content: nextUri,
    metadata: {
      ...nextMeta,
      url: nextUri,
    },
  };
}

function guessMimeAndFileName(block: ComposableBlock, uri: string): { fileName: string; mimeType: string } {
  const meta = block.metadata || {};
  const existingName = meta.fileName || meta.documentName || meta.title;
  const uriTail = uri.split('/').pop()?.split('?')[0] || '';
  const fallbackExt =
    block.type === 'image' || block.type === 'scan'
      ? 'jpg'
      : block.type === 'audio'
      ? 'm4a'
      : block.type === 'video'
      ? 'mp4'
      : 'bin';

  const fileName =
    existingName && String(existingName).includes('.')
      ? String(existingName)
      : uriTail && uriTail.includes('.')
      ? uriTail
      : `scribex_${block.type}_${block.id}.${fallbackExt}`;

  const ext = fileName.split('.').pop()?.toLowerCase() || fallbackExt;
  const mimeByExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    opus: 'audio/ogg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    pdf: 'application/pdf',
    zip: 'application/zip',
    txt: 'text/plain',
  };

  return {
    fileName,
    mimeType: meta.mimeType || mimeByExt[ext] || 'application/octet-stream',
  };
}

function parseOAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const hashIdx = url.indexOf('#');
    const qIdx = url.indexOf('?');
    if (qIdx !== -1) {
      const end = hashIdx !== -1 && hashIdx > qIdx ? hashIdx : url.length;
      new URLSearchParams(url.slice(qIdx + 1, end)).forEach((v, k) => {
        out[k] = v;
      });
    }
    if (hashIdx !== -1) {
      new URLSearchParams(url.slice(hashIdx + 1)).forEach((v, k) => {
        out[k] = v;
      });
    }
  } catch {
    // Ignore parse error safely
  }
  return out;
}

class GoogleDriveVaultService {
  private getAccountStorageKey(userId: string): string {
    return `${STORAGE_DRIVE_ACCOUNT_PREFIX}${userId}`;
  }

  private getOnboardingStorageKey(userId: string): string {
    return `${STORAGE_DRIVE_ONBOARDED_PREFIX}${userId}`;
  }

  public async hasCompletedDriveOnboarding(userId: string): Promise<boolean> {
    if (!userId || userId === 'user-default') return true;
    try {
      const [onboarded, account] = await Promise.all([
        AsyncStorage.getItem(this.getOnboardingStorageKey(userId)),
        this.getDriveAccountState(userId),
      ]);
      return onboarded === 'true' || Boolean(account?.email);
    } catch {
      return false;
    }
  }

  public async markDriveOnboardingCompleted(userId: string): Promise<void> {
    if (!userId || userId === 'user-default') return;
    await AsyncStorage.setItem(this.getOnboardingStorageKey(userId), 'true').catch(() => {});
  }

  public async syncDriveTokenFromSupabaseSession(session: any): Promise<void> {
    const userId = session?.user?.id;
    const providerToken = session?.provider_token;
    const email = session?.user?.email;
    if (!userId || !providerToken || !email) return;

    try {
      const existingRaw = await AsyncStorage.getItem(this.getAccountStorageKey(userId));
      const existing = existingRaw ? (JSON.parse(existingRaw) as GoogleDriveAccountState) : null;
      // Preserve a separately linked direct_google_oauth account if one is still valid
      if (
        existing?.source === 'direct_google_oauth' &&
        existing.expiresAt &&
        existing.expiresAt > Date.now()
      ) {
        return;
      }

      const nextState: GoogleDriveAccountState = {
        email,
        displayName: session.user.user_metadata?.full_name || email,
        accessToken: providerToken,
        expiresAt: Date.now() + 55 * 60 * 1000,
        vaultFolderId: existing?.email === email ? existing?.vaultFolderId : undefined,
        linkedAt: new Date().toISOString(),
        source: 'supabase_provider_token',
      };
      await AsyncStorage.setItem(this.getAccountStorageKey(userId), JSON.stringify(nextState));
      await this.markDriveOnboardingCompleted(userId);
    } catch {
      // Non-fatal
    }
  }

  public async getDriveAccountState(userId: string): Promise<GoogleDriveAccountState | null> {
    if (!userId || userId === 'user-default') return null;
    try {
      const raw = await AsyncStorage.getItem(this.getAccountStorageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as GoogleDriveAccountState;
        const isExpired = Boolean(parsed.expiresAt && parsed.expiresAt <= Date.now());
        if (!isExpired) {
          return parsed;
        }
        // Clear stale expired token so we can check for a fresh Supabase provider_token below
        await AsyncStorage.removeItem(this.getAccountStorageKey(userId)).catch(() => {});
      }

      // Check if active Supabase session carries a Google provider_token with user email
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        const session = data?.session as any;
        if (session?.user?.id === userId && session?.provider_token && session?.user?.email) {
          const state: GoogleDriveAccountState = {
            email: session.user.email,
            displayName: session.user.user_metadata?.full_name || session.user.email,
            accessToken: session.provider_token,
            expiresAt: Date.now() + 55 * 60 * 1000,
            linkedAt: new Date().toISOString(),
            source: 'supabase_provider_token',
          };
          await AsyncStorage.setItem(this.getAccountStorageKey(userId), JSON.stringify(state));
          return state;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  public async disconnectDriveAccount(userId: string): Promise<void> {
    if (!userId || userId === 'user-default') return;
    await AsyncStorage.removeItem(this.getAccountStorageKey(userId)).catch(() => {});
  }

  /**
   * Opens Google Account Picker (`prompt=select_account consent`) with `drive.file` scope
   * so the user can choose either their ScribeX Google account or any separate Google Drive account.
   */
  public async connectOrSwitchDriveAccount(
    userId: string
  ): Promise<{ ok: boolean; account?: GoogleDriveAccountState; error?: string }> {
    if (!userId || userId === 'user-default') {
      return { ok: false, error: 'Sign in with Google first to connect Google Drive Media Vault.' };
    }

    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

    try {
      if (googleClientId && !googleClientId.includes('your-web-client-id')) {
        const redirectUri =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/drive-callback`
            : Linking.createURL('drive/callback');

        const authUrl =
          'https://accounts.google.com/o/oauth2/v2/auth?' +
          new URLSearchParams({
            client_id: googleClientId,
            redirect_uri: redirectUri,
            response_type: 'token',
            scope:
              'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
            prompt: 'select_account consent',
            include_granted_scopes: 'true',
          }).toString();

        const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (res.type !== 'success' || !res.url) {
          return { ok: false, error: 'Google Drive account selection was cancelled.' };
        }

        const params = parseOAuthParams(res.url);
        if (!params.access_token) {
          return {
            ok: false,
            error: params.error_description || 'Google Drive authorization did not return an access token.',
          };
        }

        const expiresInSec = parseInt(params.expires_in || '3500', 10) || 3500;
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${params.access_token}` },
        });
        const profile = userInfoRes.ok ? await userInfoRes.json() : {};

        const accountState: GoogleDriveAccountState = {
          email: profile.email || 'Connected Google Drive',
          displayName: profile.name || profile.email || 'Google Drive',
          accessToken: params.access_token,
          expiresAt: Date.now() + expiresInSec * 1000,
          linkedAt: new Date().toISOString(),
          source: 'direct_google_oauth',
        };

        await AsyncStorage.setItem(this.getAccountStorageKey(userId), JSON.stringify(accountState));
        await this.markDriveOnboardingCompleted(userId);
        return { ok: true, account: accountState };
      }

      // Fallback when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is unset: request Drive scope via Supabase OAuth
      if (!isSupabaseConfigured()) {
        return { ok: false, error: 'Supabase is not configured.' };
      }

      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/signin`
          : Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
          scopes: 'https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account consent',
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (Platform.OS !== 'web' && data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success' && res.url) {
          const p = parseOAuthParams(res.url);
          if (p.access_token && p.refresh_token) {
            await supabase.auth.setSession({
              access_token: p.access_token,
              refresh_token: p.refresh_token,
            });
          } else if (p.code) {
            await supabase.auth.exchangeCodeForSession(p.code);
          }
          const linked = await this.getDriveAccountState(userId);
          await this.markDriveOnboardingCompleted(userId);
          return { ok: true, account: linked || undefined };
        }
        return { ok: false, error: 'Google Drive authorization cancelled.' };
      }

      await this.markDriveOnboardingCompleted(userId);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to connect Google Drive.' };
    }
  }

  private async ensureVaultFolderId(account: GoogleDriveAccountState, userId: string): Promise<string> {
    if (account.vaultFolderId) return account.vaultFolderId;

    const searchUrl =
      'https://www.googleapis.com/drive/v3/files?' +
      new URLSearchParams({
        q: `name='${VAULT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      }).toString();

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (searchRes.ok) {
      const json = await searchRes.json();
      if (Array.isArray(json.files) && json.files.length > 0) {
        const folderId = json.files[0].id as string;
        await AsyncStorage.setItem(
          this.getAccountStorageKey(userId),
          JSON.stringify({ ...account, vaultFolderId: folderId })
        );
        return folderId;
      }
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: VAULT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to initialize ScribeX_Vault folder (${createRes.status})`);
    }
    const created = await createRes.json();
    const folderId = created.id as string;
    await AsyncStorage.setItem(
      this.getAccountStorageKey(userId),
      JSON.stringify({ ...account, vaultFolderId: folderId })
    );
    return folderId;
  }

  private async uploadFileToDrive(
    localUri: string,
    fileName: string,
    mimeType: string,
    folderId: string,
    accessToken: string
  ): Promise<{ id: string; sizeBytes: number }> {
    const metadata = { name: fileName, parents: [folderId] };
    let base64Body = '';
    let sizeBytes = 0;

    if (localUri.startsWith('data:')) {
      const commaIdx = localUri.indexOf(',');
      base64Body = commaIdx !== -1 ? localUri.slice(commaIdx + 1) : '';
      sizeBytes = Math.floor((base64Body.length * 3) / 4);
    } else if (Platform.OS !== 'web') {
      const info = await FileSystem.getInfoAsync(localUri);
      sizeBytes = info.exists && 'size' in info ? Number(info.size) || 0 : 0;
      base64Body = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      const resp = await fetch(localUri);
      const blob = await resp.blob();
      sizeBytes = blob.size;
      const arrBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrBuf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      base64Body = btoa(bin);
    }

    const boundary = `scribex_boundary_${Date.now()}`;
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${base64Body}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`Google Drive upload failed (${uploadRes.status})`);
    }

    const json = await uploadRes.json();
    return {
      id: json.id as string,
      sizeBytes: Number(json.size) || sizeBytes,
    };
  }

  public async deleteDriveAssetById(driveFileId: string, userId: string): Promise<void> {
    if (!driveFileId || !userId || userId === 'user-default') return;
    const assetId = `asset-${driveFileId}`;

    try {
      const account = await this.getDriveAccountState(userId);
      if (account?.accessToken) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${account.accessToken}` },
        }).catch(() => {});
      }

      await dbClient.run(`DELETE FROM assets WHERE id = ? AND user_id = ?;`, [assetId, userId]).catch(() => {});
      if (isSupabaseConfigured()) {
        await supabase.from('assets').delete().eq('id', assetId).eq('user_id', userId);
      }
    } catch (err) {
      console.warn(`[GoogleDriveVault] Failed to delete replaced asset ${driveFileId}:`, err);
    }
  }

  /**
   * Deletes all Google Drive files (`ScribeX_Vault/`), `assets` rows, and Guest `local_media/`
   * files associated with notes being permanently purged from Trash.
   */
  public async cleanupMediaForDeletedNotes(
    notesToPurge: Array<{
      id: string;
      userId: string;
      blocksJson?: string | null;
      contentMarkdown?: string | null;
    }>
  ): Promise<void> {
    if (!Array.isArray(notesToPurge) || notesToPurge.length === 0) return;

    const cloudBlocksById = new Map<string, ComposableBlock[]>();
    const dehydratedCloudNotes = notesToPurge.filter((n) => {
      if (!n.userId || n.userId === 'user-default') return false;
      try {
        const parsed = n.blocksJson ? JSON.parse(n.blocksJson) : [];
        return !Array.isArray(parsed) || parsed.length === 0;
      } catch {
        return true;
      }
    });

    if (dehydratedCloudNotes.length > 0 && isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('notes')
          .select('id, blocks_json')
          .in('id', dehydratedCloudNotes.map((n) => n.id));
        for (const row of data || []) {
          if (Array.isArray(row.blocks_json)) {
            cloudBlocksById.set(row.id, row.blocks_json as ComposableBlock[]);
          } else if (typeof row.blocks_json === 'string') {
            try {
              const parsed = JSON.parse(row.blocks_json);
              if (Array.isArray(parsed)) cloudBlocksById.set(row.id, parsed);
            } catch {}
          }
        }
      } catch {
        // Offline/unavailable: fall back to local blocksJson & contentMarkdown scan below
      }
    }

    for (const note of notesToPurge) {
      let blocks: ComposableBlock[] = cloudBlocksById.get(note.id) || [];
      if (blocks.length === 0 && note.blocksJson) {
        try {
          const parsed = JSON.parse(note.blocksJson);
          if (Array.isArray(parsed)) blocks = parsed;
        } catch {}
      }

      const driveIds = new Set<string>();
      const localUris = new Set<string>();
      for (const b of blocks) {
        if (typeof b.metadata?.driveFileId === 'string' && b.metadata.driveFileId) {
          driveIds.add(b.metadata.driveFileId);
        }
        const uri = extractMediaUriFromBlock(b);
        if (uri?.startsWith(GDRIVE_PREFIX)) {
          const id = uri.slice(GDRIVE_PREFIX.length).trim();
          if (id) driveIds.add(id);
        } else if (uri && uri.includes('/local_media/')) {
          localUris.add(uri);
        }
      }

      if (note.contentMarkdown) {
        const matches = note.contentMarkdown.matchAll(/gdrive:\/\/([a-zA-Z0-9_-]+)/g);
        for (const m of matches) {
          if (m[1]) driveIds.add(m[1]);
        }
      }

      if (note.userId && note.userId !== 'user-default') {
        for (const driveId of driveIds) {
          await this.deleteDriveAssetById(driveId, note.userId);
        }
      } else {
        for (const localUri of localUris) {
          await deleteLocalMediaIfManaged(localUri);
        }
      }

      await this.purgeNoteTempCache(note.id).catch(() => {});
    }
  }

  /**
   * Scans blocks for local binary URIs (`file://`, `content://`, `blob:`, `data:`),
   * uploads them to `ScribeX_Vault/`, records lightweight metadata in `assets`,
   * rewrites block references to `gdrive://<id>`, and deletes the local original file immediately.
   */
  public async uploadNoteMediaAttachments(
    noteId: string,
    blocks: ComposableBlock[],
    userId: string
  ): Promise<DriveMediaUploadResult> {
    if (!userId || userId === 'user-default' || !Array.isArray(blocks) || blocks.length === 0) {
      return { blocks, uploadedCount: 0, deletedLocalCount: 0 };
    }

    const account = await this.getDriveAccountState(userId);
    if (!account?.accessToken) {
      return { blocks, uploadedCount: 0, deletedLocalCount: 0 };
    }

    let uploadedCount = 0;
    let deletedLocalCount = 0;
    let folderId: string | null = account.vaultFolderId || null;
    const updatedBlocks: ComposableBlock[] = [];

    for (const block of blocks) {
      const uri = extractMediaUriFromBlock(block);
      if (!isLocalUploadableUri(uri)) {
        updatedBlocks.push(block);
        continue;
      }

      try {
        if (!folderId) {
          folderId = await this.ensureVaultFolderId(account, userId);
        }
        const { fileName, mimeType } = guessMimeAndFileName(block, uri!);
        const uploaded = await this.uploadFileToDrive(
          uri!,
          fileName,
          mimeType,
          folderId,
          account.accessToken
        );

        const gdriveUri = `${GDRIVE_PREFIX}${uploaded.id}`;
        const assetId = `asset-${uploaded.id}`;

        await dbClient.run(
          `INSERT OR REPLACE INTO assets (
            id, user_id, storage_key, file_name, mime_type, size_bytes, sha256_hash, processing_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed');`,
          [assetId, userId, gdriveUri, fileName, mimeType, uploaded.sizeBytes, uploaded.id]
        );

        if (isSupabaseConfigured()) {
          await supabase.from('assets').upsert({
            id: assetId,
            user_id: userId,
            storage_key: gdriveUri,
            file_name: fileName,
            mime_type: mimeType,
            size_bytes: uploaded.sizeBytes,
            sha256_hash: uploaded.id,
            processing_status: 'completed',
          });
        }

        // Delete original local device copy immediately after confirmed Drive upload
        if (Platform.OS !== 'web' && uri!.startsWith('file://')) {
          await FileSystem.deleteAsync(uri!, { idempotent: true }).catch(() => {});
          deletedLocalCount++;
        }

        updatedBlocks.push(
          applyMediaUriToBlock(block, gdriveUri, {
            driveFileId: uploaded.id,
            fileName,
            mimeType,
          })
        );
        uploadedCount++;
      } catch (err: any) {
        console.warn(`[GoogleDriveVault] Upload deferred for block ${block.id}:`, err);
        if (typeof err?.message === 'string' && err.message.includes('(401)')) {
          await this.disconnectDriveAccount(userId).catch(() => {});
        }
        updatedBlocks.push(block);
      }
    }

    return { blocks: updatedBlocks, uploadedCount, deletedLocalCount };
  }

  /**
   * Downloads `gdrive://<fileId>` attachments into `cacheDirectory/gdrive_temp/<noteId>/`
   * (or Web Blob URLs) when a note is opened in the Editor so media plays smoothly.
   */
  public async hydrateNoteMediaToTempCache(
    noteId: string,
    blocks: ComposableBlock[],
    userId: string
  ): Promise<ComposableBlock[]> {
    if (!noteId || !userId || userId === 'user-default' || !Array.isArray(blocks)) {
      return blocks;
    }

    const account = await this.getDriveAccountState(userId);
    if (!account?.accessToken) return blocks;

    const noteTempMap = tempToPersistedUriByNote.get(noteId) || new Map<string, string>();
    tempToPersistedUriByNote.set(noteId, noteTempMap);

    const hydratedBlocks: ComposableBlock[] = [];
    const noteCacheDir = `${GDRIVE_TEMP_ROOT}${noteId}/`;

    for (const block of blocks) {
      const uri = extractMediaUriFromBlock(block);
      if (!uri || !uri.startsWith(GDRIVE_PREFIX)) {
        hydratedBlocks.push(block);
        continue;
      }

      const driveFileId = uri.slice(GDRIVE_PREFIX.length).trim();
      if (!driveFileId) {
        hydratedBlocks.push(block);
        continue;
      }

      try {
        const { fileName } = guessMimeAndFileName(block, uri);
        const safeFileName = `${driveFileId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`;

        if (Platform.OS !== 'web') {
          await FileSystem.makeDirectoryAsync(noteCacheDir, { intermediates: true }).catch(() => {});
          const destPath = `${noteCacheDir}${safeFileName}`;
          const info = await FileSystem.getInfoAsync(destPath);
          if (!info.exists) {
            await FileSystem.downloadAsync(mediaUrl, destPath, {
              headers: { Authorization: `Bearer ${account.accessToken}` },
            });
          }
          noteTempMap.set(destPath, uri);
          hydratedBlocks.push(applyMediaUriToBlock(block, destPath, { driveFileId }));
        } else {
          const resp = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${account.accessToken}` },
          });
          if (resp.ok) {
            const blob = await resp.blob();
            const dataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(String(reader.result || ''));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            if (dataUri) {
              noteTempMap.set(dataUri, uri);
              hydratedBlocks.push(applyMediaUriToBlock(block, dataUri, { driveFileId }));
            } else {
              hydratedBlocks.push(block);
            }
          } else {
            hydratedBlocks.push(block);
          }
        }
      } catch (err) {
        console.warn(`[GoogleDriveVault] Temp hydration skipped for ${driveFileId}:`, err);
        hydratedBlocks.push(block);
      }
    }

    return hydratedBlocks;
  }

  /**
   * Restores temporary `gdrive_temp/` playback URIs back to canonical `gdrive://<fileId>`
   * before persisting `blocks_json` to SQLite/Supabase.
   */
  public dehydrateTempUrisForPersistence(
    noteId: string,
    blocks: ComposableBlock[]
  ): ComposableBlock[] {
    if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
    const noteTempMap = tempToPersistedUriByNote.get(noteId);

    return blocks.map((block) => {
      const uri = extractMediaUriFromBlock(block);
      if (!uri) return block;

      const mappedGdriveUri = noteTempMap?.get(uri);
      if (mappedGdriveUri) {
        return applyMediaUriToBlock(block, mappedGdriveUri, {
          driveFileId: block.metadata?.driveFileId,
        });
      }

      if (
        (uri.includes('/gdrive_temp/') || uri.startsWith('blob:') || uri.startsWith('data:')) &&
        block.metadata?.driveFileId
      ) {
        return applyMediaUriToBlock(block, `${GDRIVE_PREFIX}${block.metadata.driveFileId}`, {
          driveFileId: block.metadata.driveFileId,
        });
      }

      return block;
    });
  }

  /**
   * Immediately purges all cached temporary playback media for `noteId` when Editor closes.
   */
  public async purgeNoteTempCache(noteId: string): Promise<void> {
    if (!noteId) return;

    tempToPersistedUriByNote.delete(noteId);

    const webUrls = webBlobUrlsByNote.get(noteId);
    if (webUrls && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const u of webUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // Ignore revocation failures
        }
      }
      webBlobUrlsByNote.delete(noteId);
    }

    if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
      const noteCacheDir = `${GDRIVE_TEMP_ROOT}${noteId}`;
      await FileSystem.deleteAsync(noteCacheDir, { idempotent: true }).catch(() => {});
    }
  }
}

export const googleDriveVaultService = new GoogleDriveVaultService();
