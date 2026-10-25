/**
 * Database Adapter Interface for Universal Cross-Platform SQLite.
 */

export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: any[]
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync(callback: () => Promise<void>): Promise<void>;
}
