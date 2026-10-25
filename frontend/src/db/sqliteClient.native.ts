/**
 * Native SQLite Client (iOS & Android).
 * Uses expo-sqlite native C driver on mobile devices.
 */

import * as SQLite from 'expo-sqlite';
import { DatabaseAdapter } from './sqliteClient.types';
import {
  CREATE_NOTES_TABLE,
  CREATE_SYNC_META_TABLE,
  CREATE_PENDING_MUTATIONS_TABLE,
  CREATE_INDEXES,
} from './schema';

const DB_NAME = 'scribex_local.db';
let dbInstance: DatabaseAdapter | null = null;

export async function getDatabase(): Promise<DatabaseAdapter> {
  if (dbInstance) {
    return dbInstance;
  }

  const nativeDb = await SQLite.openDatabaseAsync(DB_NAME);
  await nativeDb.execAsync(CREATE_NOTES_TABLE);
  await nativeDb.execAsync(CREATE_SYNC_META_TABLE);
  await nativeDb.execAsync(CREATE_PENDING_MUTATIONS_TABLE);
  await nativeDb.execAsync(CREATE_INDEXES);

  dbInstance = nativeDb as unknown as DatabaseAdapter;
  return dbInstance;
}

export * from './sqliteClient.types';
