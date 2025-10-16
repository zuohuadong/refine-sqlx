// v0.3.0 - Drizzle ORM integration
export { createRefineSQL } from './provider';
export type { DataProviderWithTimeTravel } from './provider';
export type {
  InferInsertModel,
  InferSelectModel,
  RefineSQLConfig,
  RefineSQLMeta,
  RuntimeEnvironment,
  TableName,
  D1Options,
  MySQLConfig,
  PostgreSQLConfig,
  DatabaseType,
  TimeTravelOptions,
} from './types';

// Runtime utilities
export {
  detectRuntime,
  isD1Database,
  isDrizzleDatabase,
  isBetterSqlite3Database,
  isBunDatabase,
  isNodeDatabase,
} from './runtime';

// Filter and query utilities
export {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';

// Batch operations (compatible with all database adapters)
export {
  batchInsert,
  batchUpdate,
  batchDelete,
  DEFAULT_BATCH_SIZE,
} from './utils/batch';

// Validation utilities
export { validateD1Options, getBatchSize } from './utils/validation';

// Adapters - Export from unified adapters directory
export {
  // SQL Client adapters (SqlClient interface)
  createBunSQLiteAdapter,
  createNodeSQLiteAdapter,
  createCloudflareD1Adapter,
  createBetterSQLite3Adapter,
  // Drizzle ORM adapters (Drizzle database instances)
  createBunDrizzleAdapter,
  createBetterSQLite3DrizzleAdapter,
  createD1Adapter,
  createMySQLAdapter,
  createPostgreSQLAdapter,
  // Helper functions
  isBunSQLiteAvailable,
  isBetterSQLite3Available,
  isD1Available,
  isMySQLAvailable,
  isPostgreSQLAvailable,
  d1Transaction,
} from './adapters';

// Connection utilities
export {
  parseConnectionString,
  detectDatabaseType,
  buildMySQLConnectionString,
  buildPostgreSQLConnectionString,
  validateMySQLConfig,
  validatePostgreSQLConfig,
} from './utils/connection';

// Errors
export {
  RefineSQLError,
  TableNotFoundError,
  ColumnNotFoundError,
  RecordNotFoundError,
  DatabaseOperationError,
  UnsupportedOperatorError,
  UnsupportedRuntimeError,
  InvalidConfigurationError,
} from './errors';

// Logging
export type { Logger } from './logger';
export { ConsoleLogger, NoOpLogger, createLogger } from './logger';

// Time Travel (SQLite only)
export type { TimeTravelSnapshot } from './time-travel-simple';
