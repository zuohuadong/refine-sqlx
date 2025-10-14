// refine-d1 - Modern SQLite and Cloudflare D1 data provider for Refine
// Optimized for SQLite environments with decorator-based error handling

// Export essential types
export type * from './client';
export type * from './types/index';

// Export core functionality
export { SqlxChainQuery as QueryBuilder } from './chain-query';

// Export main factory function (primary API)
export { default as createProvider } from './factory';

// Export enhanced types and utilities
export type { EnhancedDataProvider } from './data-provider';
export type { TableSchema } from './typed-methods';

// Export advanced features
export {
  TransactionManager,
  NativeQueryBuilders,
  SelectChain,
  InsertChain,
  UpdateChain,
  DeleteChain,
  AdvancedUtils,
  type TransactionContext,
} from './advanced-features';

// Export enhanced data provider
export {
  createFullyCompatibleProvider,
  createEnhancedProvider,
  type FullyCompatibleDataProvider,
  type EnhancedCompatibilityConfig,
} from './data-provider';

// Export migration and compatibility utilities
export {
  createMigrationProvider,
  CodeTransformer,
  MigrationHelpers,
  type MigrationConfig,
  type MigrationCompatibleProvider,
  type MigrationReport,
  type CompatibilityCheck,
  type MigrationChecklist,
} from './migration-guide';
export {
  CompatibleChainQuery,
  addCompatibilityLayer,
  type CompatibleDataProvider,
} from './compatibility-layer';

// Export refine-sqlx compatibility layer
export {
  createSQLiteProvider,
  createProvider as createRefineOrmProvider,
  MigrationHelpers as RefineOrmMigrationHelpers,
  CodeTransformer as RefineOrmCodeTransformer,
  type RefineOrmCompatibleProvider,
  type SQLiteProviderConfig,
  type UniversalProviderConfig,
} from './refine-sqlx-compat';

// Export decorators and utilities for advanced usage
export {
  cached,
  handleErrors,
  logExecution,
  validateParams,
  dbOperation,
  withAdapterErrorHandling,
  withClientCheck,
} from './utils';
