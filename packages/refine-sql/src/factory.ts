/**
 * Modern factory function for creating refine-sql data providers
 */

import createRefineSQL, { type EnhancedDataProvider } from './data-provider';
import type { TableSchema } from './typed-methods';
import type { SQLiteOptions } from './types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';


/**
 * Configuration interface for SQLite connections
 */
export interface SQLiteConfig<TSchema extends TableSchema = TableSchema> {
  /** Database path, connection options, or D1 database */
  connection: string | { d1Database: any };
  /** Schema definition */
  schema?: TSchema;
  /** Additional options */
  options?: SQLiteOptions;
}

/**
 * Create a refine-sql data provider with validation and error handling
 */
export function createProvider<TSchema extends TableSchema = TableSchema>(
  config: SQLiteConfig<TSchema>
): EnhancedDataProvider<TSchema>;
export function createProvider<TSchema extends TableSchema = TableSchema>(
  database: string | ':memory:' | D1Database | BunDatabase | NodeDatabase | BetterSqlite3.Database,
  options?: SQLiteOptions
): EnhancedDataProvider<TSchema>;
export function createProvider<TSchema extends TableSchema = TableSchema>(
  configOrDatabase: SQLiteConfig<TSchema> | string | ':memory:' | D1Database | BunDatabase | NodeDatabase | BetterSqlite3.Database,
  options?: SQLiteOptions
): EnhancedDataProvider<TSchema> {
  // Handle config object
  if (typeof configOrDatabase === 'object' && 'connection' in configOrDatabase) {
    const { connection, options: configOptions } = configOrDatabase;

    if (typeof connection === 'object' && 'd1Database' in connection) {
      return createRefineSQL(connection.d1Database, configOptions) as EnhancedDataProvider<TSchema>;
    }

    return createRefineSQL(connection as string, configOptions) as EnhancedDataProvider<TSchema>;
  }

  // Handle direct database parameter
  return createRefineSQL(configOrDatabase as any, options) as EnhancedDataProvider<TSchema>;
}

// Export main factory functions
export default createProvider;
export type { EnhancedDataProvider, TableSchema };
