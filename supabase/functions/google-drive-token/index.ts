/**
 * ScribeX Supabase Edge Function: google-drive-token
 *
 * Keeps a user's Google Drive Media Vault permanently connected by securely
 * storing their Google OAuth refresh_token (AES-256-GCM encrypted at rest)
 * and silently minting fresh 1-hour Google Drive access tokens on demand.
 *
 * Required Supabase Secrets:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 *   - DRIVE_TOKEN_ENCRYPTION_KEY  (high-entropy 32+ char secret)
 * Auto-injected by Supabase:
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptToken(plainText: string, secret: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

async function decryptToken(payload: string, secret: string): Promise<string> {
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted token format');
  }
  const key = await deriveAesKey(secret);
  const iv = base64ToBytes(parts[1]);
  const cipherBytes = base64ToBytes(parts[2]);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const encryptionSecret = Deno.env.get('DRIVE_TOKEN_ENCRYPTION_KEY') || '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Supabase runtime environment incomplete' }, 500);
  }

  // Strict Auth Gate: authenticate caller via Supabase JWT
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Missing Authorization header' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user?.id) {
    return jsonResponse({ ok: false, error: 'Invalid or expired Supabase session' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON request body' }, 400);
  }

  const action = String(body?.action || '').trim();

  // -------------------------------------------------------------------------
  // ACTION: store — Encrypt and persist Google OAuth refresh_token for user
  // -------------------------------------------------------------------------
  if (action === 'store') {
    if (!encryptionSecret) {
      return jsonResponse(
        { ok: false, error: 'DRIVE_TOKEN_ENCRYPTION_KEY secret is not configured' },
        500
      );
    }

    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
    const driveEmail =
      typeof body.driveEmail === 'string' && body.driveEmail.trim()
        ? body.driveEmail.trim()
        : user.email || '';
    const driveDisplayName =
      typeof body.driveDisplayName === 'string' ? body.driveDisplayName.trim() : driveEmail;
    const vaultFolderId =
      typeof body.vaultFolderId === 'string' && body.vaultFolderId.trim()
        ? body.vaultFolderId.trim()
        : null;

    if (!refreshToken || !driveEmail) {
      return jsonResponse({ ok: false, error: 'refreshToken and driveEmail are required' }, 400);
    }

    try {
      const { data: existing } = await adminClient
        .from('google_drive_connections')
        .select('drive_email, vault_folder_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const encryptedRefreshToken = await encryptToken(refreshToken, encryptionSecret);
      const preservedFolderId =
        vaultFolderId ||
        (existing?.drive_email === driveEmail ? existing?.vault_folder_id || null : null);

      const { error: upsertError } = await adminClient.from('google_drive_connections').upsert(
        {
          user_id: user.id,
          drive_email: driveEmail,
          drive_display_name: driveDisplayName,
          encrypted_refresh_token: encryptedRefreshToken,
          vault_folder_id: preservedFolderId,
        },
        { onConflict: 'user_id' }
      );

      if (upsertError) {
        return jsonResponse({ ok: false, error: upsertError.message }, 500);
      }

      return jsonResponse({ ok: true, driveEmail });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: err?.message || 'Failed to store refresh token' }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // ACTION: refresh — Exchange stored refresh_token for a fresh access token
  // -------------------------------------------------------------------------
  if (action === 'refresh') {
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

    if (!encryptionSecret || !googleClientId || !googleClientSecret) {
      return jsonResponse(
        {
          ok: false,
          configMissing: true,
          error:
            'Google OAuth refresh secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DRIVE_TOKEN_ENCRYPTION_KEY) are not configured on Supabase.',
        },
        500
      );
    }

    try {
      const { data: row, error: fetchError } = await adminClient
        .from('google_drive_connections')
        .select('drive_email, drive_display_name, encrypted_refresh_token, vault_folder_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        return jsonResponse({ ok: false, error: fetchError.message }, 500);
      }

      if (!row?.encrypted_refresh_token) {
        return jsonResponse({ ok: false, missing: true, error: 'No stored Google Drive connection' }, 200);
      }

      const refreshToken = await decryptToken(row.encrypted_refresh_token, encryptionSecret);

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const tokenJson = await tokenRes.json().catch(() => ({}));

      if (!tokenRes.ok || !tokenJson?.access_token) {
        const googleErr = String(tokenJson?.error || '');
        if (googleErr === 'invalid_grant' || tokenRes.status === 400 || tokenRes.status === 401) {
          // User revoked access in Google Account or Testing-mode 7-day refresh token expired
          await adminClient.from('google_drive_connections').delete().eq('user_id', user.id);
          return jsonResponse({
            ok: false,
            revoked: true,
            error: tokenJson?.error_description || 'Google Drive access was revoked or expired.',
          });
        }
        return jsonResponse(
          {
            ok: false,
            error: tokenJson?.error_description || `Google token refresh failed (${tokenRes.status})`,
          },
          502
        );
      }

      // Verify returned scopes still cover Google Drive if Google included the scope field
      if (typeof tokenJson.scope === 'string') {
        const scopes = tokenJson.scope.split(/\s+/);
        const hasDrive =
          scopes.includes('https://www.googleapis.com/auth/drive.file') ||
          scopes.includes('https://www.googleapis.com/auth/drive');
        if (!hasDrive) {
          await adminClient.from('google_drive_connections').delete().eq('user_id', user.id);
          return jsonResponse({
            ok: false,
            revoked: true,
            error: 'Google Drive permission is no longer granted on this refresh token.',
          });
        }
      }

      // If Google rotated the refresh_token, re-encrypt and save the new one seamlessly
      if (typeof tokenJson.refresh_token === 'string' && tokenJson.refresh_token.trim()) {
        const nextEncrypted = await encryptToken(tokenJson.refresh_token.trim(), encryptionSecret);
        await adminClient
          .from('google_drive_connections')
          .update({ encrypted_refresh_token: nextEncrypted })
          .eq('user_id', user.id);
      }

      return jsonResponse({
        ok: true,
        accessToken: tokenJson.access_token,
        expiresIn: Number(tokenJson.expires_in) || 3500,
        driveEmail: row.drive_email,
        driveDisplayName: row.drive_display_name || row.drive_email,
        vaultFolderId: row.vault_folder_id || undefined,
      });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: err?.message || 'Unexpected refresh error' }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // ACTION: revoke — Remove stored refresh token on explicit Disconnect
  // -------------------------------------------------------------------------
  if (action === 'revoke') {
    try {
      const { error: delError } = await adminClient
        .from('google_drive_connections')
        .delete()
        .eq('user_id', user.id);

      if (delError) {
        return jsonResponse({ ok: false, error: delError.message }, 500);
      }
      return jsonResponse({ ok: true });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: err?.message || 'Failed to revoke Drive connection' }, 500);
    }
  }

  return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
});
