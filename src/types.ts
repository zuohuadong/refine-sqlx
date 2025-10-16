import type { D1Database } from '@cloudflare/workers-types';
import type BetterSqlite3 from 'better-sqlite3';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DrizzleConfig } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type { Logger } from './logger';

/**
 * Database type detection
 */
export type DatabaseType = 'sqlite' | 'mysql' | 'postgresql' | 'd1';

/**
 * MySQL connection configuration
 */
export interface MySQLConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: any;
  /** Connection pool settings */
  pool?: { min?: number; max?: number };
}

/**
 * PostgreSQL connection configuration
 */
export interface PostgreSQLConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | any;
  /** Connection pool settings */
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

/**
 * Time Travel configuration for SQLite and D1
 * Provides point-in-time backup and restore functionality
 *
 * Note: D1 Time Travel is built-in and managed by Cloudflare.
 * For SQLite, this enables automatic backup creation similar to D1's behavior.
 */
export interface TimeTravelOptions {
  /**
   * Enable Time Travel automatic backups
   * @default false
   */
  enabled: boolean;

  /**
   * Backup directory path (SQLite only)
   * Where to store time-travel backups
   * @default './.time-travel'
   */
  backupDir?: string;

  /**
   * Backup interval in seconds (SQLite only)
   * How often to create automatic backups
   * @default 60 (1 minute, matching D1's granularity)
   */
  intervalSeconds?: number;

  /**
   * Retention period in days (SQLite only)
   * How long to keep backups
   * @default 30 (matching D1's default retention)
   */
  retentionDays?: number;
}

/**
 * D1-specific configuration options
 */
export interface D1Options {
  /**
   * Batch operation settings
   */
  batch?: {
    /**
     * Maximum number of statements per batch
     * D1 recommended limit is 50 statements
     * @default 50
     */
    maxSize?: number;
  };
}

/**
 * Configuration options for createRefineSQL
 *
 * @example
 * ```typescript
 * // SQLite - file path
 * { connection: 'database.sqlite', schema }
 *
 * // SQLite - in-memory
 * { connection: ':memory:', schema }
 *
 * // MySQL - connection string
 * { connection: 'mysql://user:pass@localhost:3306/mydb', schema }
 *
 * // MySQL - config object
 * { connection: { host: 'localhost', user: 'root', password: 'secret', database: 'mydb' }, schema }
 *
 * // PostgreSQL - connection string
 * { connection: 'postgresql://user:pass@localhost:5432/mydb', schema }
 *
 * // PostgreSQL - config object
 * { connection: { host: 'localhost', user: 'postgres', password: 'secret', database: 'mydb' }, schema }
 *
 * // Cloudflare D1
 * { connection: env.DB, schema }
 *
 * // Drizzle instance (any database)
 * { connection: drizzleInstance, schema }
 * ```
 */
export interface RefineSQLConfig<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Database connection - supports multiple formats:
   *
   * **SQLite**:
   * - File path: `'database.sqlite'` or `'data/app.db'`
   * - Memory: `':memory:'`
   * - Native instances: BunDatabase, NodeDatabase, BetterSqlite3.Database
   *
   * **MySQL**:
   * - Connection string: `'mysql://user:pass@host:3306/db'`
   * - Config object: `{ host, user, password, database, ... }`
   *
   * **PostgreSQL**:
   * - Connection string: `'postgresql://user:pass@host:5432/db'` or `'postgres://...'`
   * - Config object: `{ host, user, password, database, ... }`
   *
   * **Cloudflare D1**:
   * - D1Database instance: `env.DB`
   *
   * **Drizzle ORM** (most flexible):
   * - Any Drizzle database instance (auto-detected)
   */
  connection:
    | string
    | ':memory:'
    | MySQLConfig
    | PostgreSQLConfig
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database
    | BunSQLiteDatabase<TSchema>
    | BetterSQLite3Database<TSchema>
    | DrizzleD1Database<TSchema>
    | MySql2Database<TSchema>
    | PostgresJsDatabase<TSchema>;

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

  /**
   * D1-specific options (only applicable when using D1Database)
   */
  d1Options?: D1Options;

  /**
   * Time Travel configuration (SQLite and D1)
   *
   * - **D1**: Time Travel is built-in, no configuration needed
   * - **SQLite**: Enables automatic backups for point-in-time restore
   *
   * @example
   * ```typescript
   * // SQLite with Time Travel
   * const dataProvider = await createRefineSQL({
   *   connection: './database.sqlite',
   *   schema,
   *   timeTravel: {
   *     enabled: true,
   *     intervalSeconds: 60,    // Backup every minute
   *     retentionDays: 30,      // Keep 30 days of backups
   *   }
   * });
   * ```
   */
  timeTravel?: TimeTravelOptions;
}

/**
 * Runtime environment types
 */
export type RuntimeEnvironment =
  | 'bun'
  | 'node'
  | 'd1'
  | 'better-sqlite3'
  | 'mysql'
  | 'postgresql';

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

/**
 * Metadata for Refine SQL operations
 * Used to customize behavior of CRUD operations
 */
export interface RefineSQLMeta {
  /**
   * Custom ID column name
   * @default 'id'
   */
  idColumnName?: string;
}
