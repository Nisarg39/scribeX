/**
 * ScribeX Universal Database Client Router
 * Delegates to client.native on iOS/Android and client.web on Browser/PWA
 */

import { Platform } from 'react-native';

export interface IDatabaseClient {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryFirst<T>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  exec(sql: string): Promise<void>;
  withTransaction<T>(callback: (db?: any) => Promise<T>): Promise<T>;
}

let clientInstance: IDatabaseClient;

if (Platform.OS === 'web') {
  const { dbClient: webClient } = require('./client.web');
  clientInstance = webClient;
} else {
  const { dbClient: nativeClient } = require('./client.native');
  clientInstance = nativeClient;
}

export const dbClient = clientInstance;
