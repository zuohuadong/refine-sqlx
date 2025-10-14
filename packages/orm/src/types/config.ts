import type { Table } from 'drizzle-orm';

// Database connection configuration
export interface ConnectionOptions {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | SSLConfig;
  connectionString?: string;
  // SQLite specific options
  filename?: string;
  path?: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;
  // Cloudflare D1 specific
  d1Database?: any;
}

// SSL configuration for secure connections
export interface SSLConfig {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

// Connection pool configuration
export interface PoolConfig {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
}

// Database-specific configuration
export interface DatabaseConfig<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  type: 'postgresql' | 'mysql' | 'sqlite';
  connection: string | ConnectionOptions | { d1Database: any };
  schema: TSchema;
  pool?: PoolConfig;
  ssl?: boolean | SSLConfig;
  debug?: boolean;
  logger?: boolean | ((query: string, params: any[]) => void);
}

// PostgreSQL specific options
export interface PostgreSQLOptions extends RefineOrmOptions {
  ssl?: boolean | SSLConfig;
  pool?: PoolConfig;
  searchPath?: string[];
}

// MySQL specific options
export interface MySQLOptions extends RefineOrmOptions {
  ssl?: boolean | SSLConfig;
  pool?: PoolConfig;
  timezone?: string;
  charset?: string;
}

// SQLite specific options
export interface SQLiteOptions extends RefineOrmOptions {
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;
}

// Base options interface
export interface RefineOrmOptions {
  logger?: boolean | ((query: string, params: any[]) => void);
  debug?: boolean;
  pool?: PoolConfig;
}

// Runtime detection configuration
export interface RuntimeConfig {
  runtime: 'bun' | 'node' | 'cloudflare-d1';
  database: 'postgresql' | 'mysql' | 'sqlite';
  driver: string;
  supportsNativeDriver: boolean;
}

// Re-export SchemaConfig from schema
export type { SchemaConfig } from './schema';

// Query context for debugging and logging
export interface QueryContext {
  resource: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  filters?: any;
  sorters?: any;
  pagination?: any;
  meta?: Record<string, any>;
  startTime?: number;
  sql?: string; // Optional SQL query text for performance analysis
}

// Query result metadata
export interface QueryResult<T = any> {
  data: T[];
  total?: number;
  meta?: Record<string, any>;
  executionTime?: number;
}

// Transaction configuration
export interface TransactionOptions {
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
  timeout?: number;
  readOnly?: boolean;
}

// Performance monitoring configuration
export interface PerformanceConfig {
  enableMetrics?: boolean;
  slowQueryThreshold?: number;
  maxQueryTime?: number;
  enableQueryCache?: boolean;
  cacheSize?: number;
}
