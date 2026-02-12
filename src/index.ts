// v0.6.0 - Unified feature integration
export { createRefineSQL } from './provider';

// Zero-config shortcut API
export { drizzleDataProvider } from './shortcut';
export type { DrizzleDataProviderOptions } from './shortcut';

// Core configuration types
export type {
  RefineSQLConfig,
  RuntimeEnvironment,
  TableName,
  D1Options,
  CacheConfig,
  CacheAdapter,
  InferInsertModel,
  InferSelectModel,
} from './types';

// Feature configuration and validation
export {
  validateConfig,
  validateFeaturesConfig,
  type FeaturesConfig,
  type RelationsConfig,
  type AggregationsConfig,
  type TransactionsConfig,
  type JSONConfig,
  type ViewsConfig,
  type ValidatedFeaturesConfig,
} from './config';

// Extended DataProvider types
export type {
  DataProviderWithTransactions,
  DataProviderWithAggregations,
  ExtendedDataProvider,
} from './types/provider';

// Re-export TransactionContext and Aggregate types
export type { TransactionContext } from './features/transactions/manager';
export type {
  AggregateParams,
  AggregateResponse,
} from './features/aggregations/executor';

// Feature executors and types
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
  type HavingCondition,
  type HavingLogical,
  type HavingOperator,
  type RelationInclude,
} from './features';

// Security
export { SecurityGuard } from './security';
export type { SecurityConfig } from './security';

// Filter and query utilities
export {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';

// Batch operations
export {
  batchInsert,
  batchUpdate,
  batchDelete,
  DEFAULT_BATCH_SIZE,
} from './utils/batch';

// Validation utilities
export { validateD1Options, getBatchSize } from './utils/validation';

// ID normalization utilities
export { normalizeId, normalizeIds, getColumn } from './utils/id-normalization';

// Simple REST parameter conversion
export {
  convertSimpleRestParams,
  toSimpleRestParams,
  type SimpleRestQuery,
  type ConvertedParams,
} from './utils/simple-rest';

// Cache
export { MemoryCacheAdapter, CacheManager, RedisCacheAdapter } from './cache';
export type { RedisClient, RedisCacheAdapterOptions } from './cache/redis-adapter';

// Live Queries
export {
  createLiveProvider,
  LiveEventEmitter,
  PollingStrategy,
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
  IdTypeConversionError,
  AccessDeniedError,
  InvalidFieldValueError,
  MissingRequiredFieldError,
  FeatureNotEnabledError,
  RelationQueryError,
} from './errors';

// Logging
export type { Logger } from './logger';
export { ConsoleLogger, NoOpLogger, createLogger } from './logger';

// Validation
export {
  Validator,
  ValidationError,
  createValidationConfig,
} from './validation';
export type { ValidationSchema } from './validation';
