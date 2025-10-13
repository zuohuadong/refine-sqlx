// refine-orm - Multi-database ORM data provider for Refine
// Built on top of drizzle-orm with support for PostgreSQL, MySQL, and SQLite

// Export essential types
export type * from './types/client';
export type * from './types/operations';
export type * from './types/config';

// Export core functionality
export { createProvider } from './core/data-provider';
export { RefineQueryBuilder as QueryBuilder } from './core/query-builder';
export { TransactionManager } from './core/transaction-manager';

// Export adapters
export * from './adapters/index';

// Main factory functions (recommended for most users)
export {
  createPostgreSQLProvider,
  createMySQLProvider,
  createSQLiteProvider,
  createDataProvider,
  getRuntimeDiagnostics,
  checkDatabaseSupport,
} from './factory';
