import type { D1Database } from '@cloudflare/workers-types';
import type BetterSqlite3 from 'better-sqlite3';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DrizzleConfig } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type { Logger } from './logger';

/**
 * Configuration options for createRefineSQL
 */
export interface RefineSQLConfig<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Database connection - can be:
   * - File path string (e.g., './database.sqlite')
   * - ':memory:' for in-memory database
   * - D1Database instance (Cloudflare D1)
   * - BunDatabase instance (Bun SQLite)
   * - NodeDatabase instance (Node.js >= 24)
   * - BetterSqlite3.Database instance (Node.js < 24)
   * - Drizzle database instance
   */
  connection:
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database
    | BunSQLiteDatabase<TSchema>
    | BetterSQLite3Database<TSchema>
    | DrizzleD1Database<TSchema>;

  /**
   * Drizzle ORM schema definition
   * Required for type safety and query building
   */
  schema: TSchema;

  /**
   * Optional Drizzle config for logging, etc.
   */
  config?: DrizzleConfig<TSchema>;

  /**
   * Field naming convention
   * @default 'snake_case'
   */
  casing?: 'camelCase' | 'snake_case' | 'none';

  /**
   * Enable query logging
   * Can be:
   * - boolean: true to enable console logging, false to disable
   * - Logger: custom logger instance
   * @default false
   */
  logger?: boolean | Logger;
}

/**
 * Runtime environment types
 */
export type RuntimeEnvironment = 'bun' | 'node' | 'd1' | 'better-sqlite3';

/**
 * Table name from schema
 */
export type TableName<TSchema extends Record<string, unknown>> = Extract<
  keyof TSchema,
  string
>;

/**
 * Infer select type from table
 */
export type InferSelectModel<TTable> =
  TTable extends { $inferSelect: infer T } ? T : never;

/**
 * Infer insert type from table
 */
export type InferInsertModel<TTable> =
  TTable extends { $inferInsert: infer T } ? T : never;
