/**
 * ScribeX Zero-Knowledge Cryptographic & Credential Utility
 * Pure TypeScript PBKDF2-HMAC-SHA256 implementation — identical deterministic outputs
 * across Web, iOS/Android Hermes, and headless Node.js test environments.
 */

export type CredentialKind = 'pin' | 'password';
export type LockType = 'master' | 'custom';

export const DEFAULT_PBKDF2_ITERATIONS = 5000;
export const MAX_FAILED_ATTEMPTS = 5;
export const COOLDOWN_DURATION_MS = 30_000;

// Standard SHA-256 initial hash values and round constants (FIPS 180-4)
const SHA256_H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8Encode(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

const SHA256_W = new Uint32Array(64);

export function sha256Bytes(data: Uint8Array): Uint8Array {
  const len = data.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[len] = 0x80;

  // Big-endian 64-bit length at the end (upper 32 bits safe up to 512MB)
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  padded[paddedLen - 8] = (highBits >>> 24) & 0xff;
  padded[paddedLen - 7] = (highBits >>> 16) & 0xff;
  padded[paddedLen - 6] = (highBits >>> 8) & 0xff;
  padded[paddedLen - 5] = highBits & 0xff;
  padded[paddedLen - 4] = (lowBits >>> 24) & 0xff;
  padded[paddedLen - 3] = (lowBits >>> 16) & 0xff;
  padded[paddedLen - 2] = (lowBits >>> 8) & 0xff;
  padded[paddedLen - 1] = lowBits & 0xff;

  let h0 = SHA256_H0[0];
  let h1 = SHA256_H0[1];
  let h2 = SHA256_H0[2];
  let h3 = SHA256_H0[3];
  let h4 = SHA256_H0[4];
  let h5 = SHA256_H0[5];
  let h6 = SHA256_H0[6];
  let h7 = SHA256_H0[7];

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let t = 0; t < 16; t++) {
      const i = offset + t * 4;
      SHA256_W[t] =
        ((padded[i] << 24) |
          (padded[i + 1] << 16) |
          (padded[i + 2] << 8) |
          padded[i + 3]) >>>
        0;
    }

    for (let t = 16; t < 64; t++) {
      const s0 =
        ((SHA256_W[t - 15] >>> 7) | (SHA256_W[t - 15] << 25)) ^
        ((SHA256_W[t - 15] >>> 18) | (SHA256_W[t - 15] << 14)) ^
        (SHA256_W[t - 15] >>> 3);
      const s1 =
        ((SHA256_W[t - 2] >>> 17) | (SHA256_W[t - 2] << 15)) ^
        ((SHA256_W[t - 2] >>> 19) | (SHA256_W[t - 2] << 13)) ^
        (SHA256_W[t - 2] >>> 10);
      SHA256_W[t] = (SHA256_W[t - 16] + s0 + SHA256_W[t - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + SHA256_W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (words[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (words[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (words[i] >>> 8) & 0xff;
    out[i * 4 + 3] = words[i] & 0xff;
  }
  return out;
}

export function hmacSha256Bytes(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = keyBytes;
  if (k.length > blockSize) {
    k = sha256Bytes(k);
  }
  const ipad = new Uint8Array(blockSize + messageBytes.length);
  const opad = new Uint8Array(blockSize + 32);

  for (let i = 0; i < blockSize; i++) {
    const kb = i < k.length ? k[i] : 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  ipad.set(messageBytes, blockSize);
  const inner = sha256Bytes(ipad);
  opad.set(inner, blockSize);
  return sha256Bytes(opad);
}

let entropyCounter = 0;

/**
 * Generates a random cryptographic salt as a lowercase hex string.
 */
export function generateSalt(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  const gCrypto = (globalThis as any)?.crypto;
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    gCrypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  // Fallback entropy mixer if globalThis.crypto.getRandomValues is unavailable
  entropyCounter = (entropyCounter + 1) & 0xffffffff;
  const seedInput = `${Date.now()}-${Math.random()}-${Math.random()}-${entropyCounter}`;
  const digest = sha256Bytes(utf8Encode(seedInput));
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = digest[i % digest.length] ^ Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

/**
 * Computes a salted PBKDF2-HMAC-SHA256 digest (hex string) for a PIN or password.
 */
export function hashCredential(
  secret: string,
  salt: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): string {
  const passwordBytes = utf8Encode(secret);
  const saltBytes = utf8Encode(salt);

  // Block index 1 (4-byte big-endian) for 32-byte derived key
  const saltWithIndex = new Uint8Array(saltBytes.length + 4);
  saltWithIndex.set(saltBytes);
  saltWithIndex[saltBytes.length] = 0;
  saltWithIndex[saltBytes.length + 1] = 0;
  saltWithIndex[saltBytes.length + 2] = 0;
  saltWithIndex[saltBytes.length + 3] = 1;

  let u = hmacSha256Bytes(passwordBytes, saltWithIndex);
  const dk = new Uint8Array(u);

  for (let i = 1; i < iterations; i++) {
    u = hmacSha256Bytes(passwordBytes, u);
    for (let j = 0; j < 32; j++) {
      dk[j] ^= u[j];
    }
  }

  return bytesToHex(dk);
}

/**
 * Constant-time string comparison to mitigate timing side-channels.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Verifies a plaintext candidate against a stored salted PBKDF2-HMAC-SHA256 digest.
 */
export function verifyCredential(
  candidate: string,
  expectedHash: string | null | undefined,
  salt: string | null | undefined,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): boolean {
  if (!candidate || !expectedHash || !salt) return false;
  const computed = hashCredential(candidate, salt, iterations);
  return constantTimeEqual(computed, expectedHash);
}

/**
 * Validates PIN (4–6 digits) or Password (minimum 4 non-whitespace chars).
 */
export function validateCredentialFormat(
  secret: string,
  kind: CredentialKind
): { valid: boolean; error?: string } {
  if (kind === 'pin') {
    if (!/^\d{4,6}$/.test(secret)) {
      return { valid: false, error: 'PIN must be 4 to 6 numeric digits.' };
    }
    return { valid: true };
  }

  if (!secret || secret.length < 4 || secret.trim().length === 0) {
    return { valid: false, error: 'Password must be at least 4 characters.' };
  }
  return { valid: true };
}

interface AttemptRecord {
  failures: number;
  lockedUntilMs: number;
}

/**
 * In-memory brute-force protection:
 * 5 consecutive failed attempts triggers a 30-second cooldown per lock scope.
 */
export class AttemptRateLimiter {
  private records = new Map<string, AttemptRecord>();

  public getLockoutRemainingMs(scopeKey: string, nowMs: number = Date.now()): number {
    const rec = this.records.get(scopeKey);
    if (!rec) return 0;
    if (rec.lockedUntilMs > nowMs) {
      return rec.lockedUntilMs - nowMs;
    }
    return 0;
  }

  public getAttemptCount(scopeKey: string): number {
    return this.records.get(scopeKey)?.failures || 0;
  }

  public getRemainingAttempts(scopeKey: string): number {
    const count = this.getAttemptCount(scopeKey);
    return Math.max(0, MAX_FAILED_ATTEMPTS - count);
  }

  public recordFailure(
    scopeKey: string,
    nowMs: number = Date.now()
  ): { failures: number; lockedOut: boolean; remainingMs: number } {
    const existing = this.records.get(scopeKey);
    // If previous cooldown expired, restart counter
    const baseFailures =
      existing && existing.lockedUntilMs > 0 && nowMs >= existing.lockedUntilMs
        ? 0
        : existing?.failures || 0;

    const failures = baseFailures + 1;
    if (failures >= MAX_FAILED_ATTEMPTS) {
      const lockedUntilMs = nowMs + COOLDOWN_DURATION_MS;
      this.records.set(scopeKey, { failures, lockedUntilMs });
      return { failures, lockedOut: true, remainingMs: COOLDOWN_DURATION_MS };
    }

    this.records.set(scopeKey, { failures, lockedUntilMs: 0 });
    return { failures, lockedOut: false, remainingMs: 0 };
  }

  public recordSuccess(scopeKey: string): void {
    this.records.delete(scopeKey);
  }

  public resetAll(): void {
    this.records.clear();
  }
}

export const securityRateLimiter = new AttemptRateLimiter();
