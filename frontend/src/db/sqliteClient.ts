/**
 * Cross-Platform SQLite Connection Manager.
 *
 * Metro resolves:
 * - `sqliteClient.native.ts` for iOS & Android (native expo-sqlite C driver).
 * - `sqliteClient.web.ts` for Web (persistent IndexedDB/AsyncStorage relational adapter).
 *
 * This file serves as TypeScript typing fallback.
 */

import { DatabaseAdapter } from './sqliteClient.types';

export async function getDatabase(): Promise<DatabaseAdapter> {
  // Resolved at runtime by bundler platform extensions (.native.ts / .web.ts)
  const client = await import('./sqliteClient.web');
  return client.getDatabase();
}

export * from './sqliteClient.types';
