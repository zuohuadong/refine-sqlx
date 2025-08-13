// refine-sqlx - Modern SQLite and Cloudflare D1 data provider for Refine
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

// Export decorators and utilities for advanced usage
export { 
  cached, 
  handleErrors, 
  logExecution, 
  validateParams, 
  dbOperation,
  withAdapterErrorHandling,
  withClientCheck
} from './utils';