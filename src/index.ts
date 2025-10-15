// v0.3.0 - Drizzle ORM integration
export { createRefineSQL } from './provider';
export type {
  InferInsertModel,
  InferSelectModel,
  RefineSQLConfig,
  RuntimeEnvironment,
  TableName,
  D1Options,
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

// Adapters
export { createBunSQLiteAdapter, isBunSQLiteAvailable } from './adapters/bun';
export {
  createBetterSQLite3Adapter,
  isBetterSQLite3Available,
} from './adapters/better-sqlite3-drizzle';
export { createD1Adapter, d1Transaction, isD1Available } from './adapters/d1';

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
