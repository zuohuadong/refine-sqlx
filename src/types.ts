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

  /**
   * Time Travel settings
   * Note: Actual restoration must be done via wrangler CLI
   * This option allows querying at a specific point in time
   */
  timeTravel?: {
    /**
     * Enable Time Travel queries
     * When enabled, queries will use the specified bookmark or timestamp
     * @default false
     */
    enabled?: boolean;

    /**
     * Bookmark name or Unix timestamp to query from
     * - Bookmark: string identifier created by D1
     * - Timestamp: Unix timestamp (number) or ISO date string
     */
    bookmark?: string | number;
  };
}

/**
 * Optimistic locking configuration
 */
export interface OptimisticLockingConfig {
  /**
   * Enable optimistic locking
   * @default false
   */
  enabled?: boolean;

  /**
   * Version field name in tables
   * @default 'version'
   */
  versionField?: string;

  /**
   * Locking strategy
   * - 'version': Use integer version field
   * - 'timestamp': Use timestamp field
   * @default 'version'
   */
  strategy?: 'version' | 'timestamp';

  /**
   * Timestamp field name (when strategy is 'timestamp')
   * @default 'updated_at'
   */
  timestampField?: string;
}

/**
 * Multi-tenancy configuration
 */
export interface MultiTenancyConfig {
  /**
   * Enable multi-tenancy
   * @default false
   */
  enabled?: boolean;

  /**
   * Tenant field name in all tables
   * @default 'tenant_id'
   */
  tenantField?: string;

  /**
   * Current tenant ID
   * Can be overridden per-request via meta.tenantId
   */
  tenantId?: string | number;

  /**
   * Strict mode - throw error if tenant field is missing
   * @default true
   */
  strictMode?: boolean;
}

/**
 * Cache adapter interface
 */
export interface CacheAdapter {
  /**
   * Get cached value by key
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Set cached value with TTL in seconds
   */
  set(key: string, value: any, ttl: number): Promise<void>;

  /**
   * Delete cached values matching pattern
   * Supports wildcards like 'users:*'
   */
  delete(pattern: string): Promise<void>;

  /**
   * Clear all cached values
   */
  clear?(): Promise<void>;
}

/**
 * Query caching configuration
 */
export interface CacheConfig {
  /**
   * Enable query caching
   * @default false
   */
  enabled?: boolean;

  /**
   * Cache adapter
   * @default 'memory'
   */
  adapter?: 'memory' | CacheAdapter;

  /**
   * Default TTL in seconds
   * @default 300 (5 minutes)
   */
  ttl?: number;

  /**
   * Maximum cached items (memory adapter only)
   * @default 1000
   */
  maxSize?: number;

  /**
   * Key prefix for all cache keys
   * @default 'refine-sqlx:'
   */
  keyPrefix?: string;
}

/**
 * Enhanced logging configuration
 */
export interface LoggingConfig {
  /**
   * Enable logging
   * @default false
   */
  enabled?: boolean;

  /**
   * Log level
   * @default 'info'
   */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Log SQL queries
   * @default true
   */
  logQueries?: boolean;

  /**
   * Log performance metrics
   * @default true
   */
  logPerformance?: boolean;

  /**
   * Slow query threshold in milliseconds
   * Queries slower than this will be logged as warnings
   * @default 1000
   */
  slowQueryThreshold?: number;

  /**
   * Custom query logger callback
   */
  onQuery?: (event: QueryLogEvent) => void;
}

/**
 * Query log event
 */
export interface QueryLogEvent {
  /**
   * SQL query string
   */
  sql: string;

  /**
   * Query parameters
   */
  params?: any[];

  /**
   * Query duration in milliseconds
   */
  duration: number;

  /**
   * Resource name
   */
  resource?: string;

  /**
   * Operation type
   */
  operation: 'getList' | 'getOne' | 'getMany' | 'create' | 'createMany' | 'update' | 'updateMany' | 'deleteOne' | 'deleteMany';

  /**
   * Timestamp
   */
  timestamp: Date;
}

/**
 * Data validation configuration
 */
export interface ValidationConfig {
  /**
   * Enable validation
   * @default false
   */
  enabled?: boolean;

  /**
   * Validation schemas per resource
   * Key: resource name
   * Value: { insert?: ZodSchema, update?: ZodSchema, select?: ZodSchema }
   */
  schemas?: Record<string, {
    insert?: any; // ZodSchema - avoid hard dependency
    update?: any; // ZodSchema
    select?: any; // ZodSchema
  }>;

  /**
   * Throw error on validation failure
   * If false, validation errors will be logged only
   * @default true
   */
  throwOnError?: boolean;
}

/**
 * Live mode configuration (v0.5.0)
 */
export type { LiveModeConfig } from './live';

/**
 * Feature configuration (v0.5.0)
 * Import from config module to avoid circular dependencies
 */
export type { FeaturesConfig } from './config';

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

  /**
   * D1-specific options (only applicable when using D1Database)
   */
  d1Options?: D1Options;

  /**
   * Optimistic locking configuration (v0.5.0)
   */
  optimisticLocking?: OptimisticLockingConfig;

  /**
   * Multi-tenancy configuration (v0.5.0)
   */
  multiTenancy?: MultiTenancyConfig;

  /**
   * Query caching configuration (v0.5.0)
   */
  cache?: CacheConfig;

  /**
   * Enhanced logging configuration (v0.5.0)
   */
  logging?: LoggingConfig;

  /**
   * Data validation configuration (v0.5.0)
   */
  validation?: ValidationConfig;

  /**
   * Live mode configuration (v0.5.0)
   * Enable real-time updates
   */
  liveMode?: import('./live').LiveModeConfig;

  /**
   * Feature configuration (v0.5.0)
   * Unified configuration for relations, aggregations, transactions, JSON, and views
   */
  features?: import('./config').FeaturesConfig;
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

/**
 * Transaction context for executing multiple operations
 */
export interface TransactionContext<TSchema extends Record<string, unknown>> {
  /**
   * Execute a query within the transaction
   */
  query<T>(fn: (db: any) => Promise<T>): Promise<T>;
}

/**
 * Aggregation function parameters
 */
export interface AggregateParams {
  /**
   * Resource name to aggregate
   */
  resource: string;

  /**
   * Aggregation functions to apply
   */
  functions: Array<{
    /**
     * Aggregation function type
     */
    type: 'count' | 'sum' | 'avg' | 'min' | 'max';

    /**
     * Field to aggregate (not needed for count)
     */
    field?: string;

    /**
     * Result alias
     */
    alias?: string;
  }>;

  /**
   * GROUP BY fields
   */
  groupBy?: string[];

  /**
   * HAVING conditions (optional)
   */
  having?: any;

  /**
   * Filters to apply before aggregation
   */
  filters?: any;

  /**
   * Additional metadata
   */
  meta?: Record<string, any>;
}

/**
 * Aggregation result
 */
export interface AggregateResult {
  [key: string]: number | string | null;
}

/**
 * Extended DataProvider with transaction support
 */
export interface DataProviderWithTransactions extends Omit<import('@refinedev/core').DataProvider, 'transaction'> {
  /**
   * Execute multiple operations within a transaction
   * All operations will be rolled back if any operation fails
   *
   * @example
   * ```typescript
   * await dataProvider.transaction(async (tx) => {
   *   await tx.query(db => db.insert(users).values({ name: 'John' }));
   *   await tx.query(db => db.insert(posts).values({ title: 'Hello' }));
   * });
   * ```
   */
  transaction<T>(
    callback: (tx: TransactionContext<any>) => Promise<T>,
  ): Promise<T>;
}

/**
 * Extended DataProvider with aggregation support
 */
export interface DataProviderWithAggregations extends Omit<import('@refinedev/core').DataProvider, 'aggregate'> {
  /**
   * Execute aggregation queries
   *
   * @example
   * ```typescript
   * const result = await dataProvider.aggregate({
   *   resource: 'orders',
   *   functions: [
   *     { type: 'count', alias: 'total' },
   *     { type: 'sum', field: 'amount', alias: 'revenue' }
   *   ],
   *   groupBy: ['status']
   * });
   * ```
   */
  aggregate<T = AggregateResult>(
    params: AggregateParams,
  ): Promise<{ data: T[] }>;
}

/**
 * Extended DataProvider with all features
 */
export interface ExtendedDataProvider
  extends DataProviderWithTransactions,
    DataProviderWithAggregations {}
