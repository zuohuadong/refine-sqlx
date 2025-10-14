// Configuration types compatible with refine-sqlx
import type { TableSchema } from '../typed-methods';

/**
 * Base RefineORM options compatible with refine-sqlx
 */
export interface RefineOrmOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger function */
  logger?: (query: string, params: any[]) => void;
  /** Connection pool options */
  pool?: { min?: number; max?: number; idle?: number };
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Enable query caching */
  cache?: boolean;
  /** Custom cache implementation */
  cacheStore?: any;
}

/**
 * SQLite-specific options compatible with refine-sqlx
 * This extends the base options with SQLite-specific settings
 */
export interface SQLiteOptions extends RefineOrmOptions {
  /** SQLite-specific connection options */
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;

  // Runtime-specific options
  bun?: { create?: boolean; readwrite?: boolean; strict?: boolean };

  node?: { open?: boolean; enableForeignKeys?: boolean };

  'better-sqlite3'?: {
    memory?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: boolean;
  };
}

/**
 * Connection options compatible with refine-sqlx
 */
export interface ConnectionOptions {
  /** Database file path for SQLite */
  filename?: string;
  /** Connection mode */
  mode?: 'readonly' | 'readwrite' | 'create';
  /** Enable foreign keys */
  foreignKeys?: boolean;
  /** Connection timeout */
  timeout?: number;
  /** Additional driver-specific options */
  [key: string]: any;
}

/**
 * Schema configuration
 */
export interface SchemaConfig<TSchema extends TableSchema = TableSchema> {
  /** Schema definition */
  schema: TSchema;
  /** Schema validation options */
  validation?: { enabled?: boolean; strict?: boolean };
  /** Migration options */
  migrations?: { enabled?: boolean; directory?: string; tableName?: string };
}

/**
 * Runtime detection results
 */
export interface RuntimeInfo {
  runtime: 'bun' | 'node' | 'cloudflare-worker' | 'unknown';
  version?: string;
  features: {
    bunSqlite?: boolean;
    cloudflareD1?: boolean;
    betterSqlite3?: boolean;
  };
  recommendedDriver: string;
}

/**
 * Database support check result
 */
export interface DatabaseSupport {
  supported: boolean;
  driver?: string;
  reason?: string;
  alternatives?: string[];
}
