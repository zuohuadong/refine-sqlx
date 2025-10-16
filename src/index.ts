// v0.5.0 - Unified feature integration
export { createRefineSQL } from './provider';

// Core configuration types
export type {
  RefineSQLConfig,
  RuntimeEnvironment,
  TableName,
  D1Options,
  OptimisticLockingConfig,
  MultiTenancyConfig,
  CacheConfig,
  CacheAdapter,
  LoggingConfig,
  QueryLogEvent,
  ValidationConfig,
  InferInsertModel,
  InferSelectModel,
  FeaturesConfig,
} from './types';

// Feature configuration and validation (v0.5.0)
export {
  validateConfig,
  validateFeaturesConfig,
  type RelationsConfig,
  type AggregationsConfig,
  type TransactionsConfig,
  type JSONConfig,
  type ViewsConfig,
  type ValidatedFeaturesConfig,
} from './config';

// Extended DataProvider types (v0.5.0)
export type {
  DataProviderWithTransactions,
  DataProviderWithAggregations,
  ExtendedDataProvider,
  TransactionContext,
  AggregateParams,
  AggregateResult,
} from './types';

// Feature executors and types (v0.5.0)
export {
  AggregationsExecutor,
  JSONParser,
  RelationsExecutor,
  TransactionManager,
  ViewDetector,
  FeatureRegistry,
  type FeatureExecutor,
  type FeatureContext,
  type AggregateFunction,
  type AggregateResponse,
  type HavingCondition,
  type HavingLogical,
  type HavingOperator,
  type RelationInclude,
} from './features';

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

// Cache (v0.5.0)
export { MemoryCacheAdapter, CacheManager, RedisCacheAdapter } from './cache';
export type { RedisClient, RedisCacheAdapterOptions } from './cache/redis-adapter';

// Live Queries (v0.5.0)
export {
  createLiveProvider,
  LiveEventEmitter,
  PollingStrategy,
  WebSocketStrategy,
} from './live';
export type { LiveModeConfig } from './live';

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
  OptimisticLockError,
} from './errors';

// Logging
export type { Logger } from './logger';
export { ConsoleLogger, NoOpLogger, createLogger } from './logger';

// Validation (v0.5.0)
export {
  Validator,
  ValidationError,
  createValidationConfig,
} from './validation';
export type { ValidationSchema } from './validation';

// CLI (v0.5.0)
export * from './cli';
