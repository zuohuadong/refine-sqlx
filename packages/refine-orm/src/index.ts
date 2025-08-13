// refine-orm - Multi-database ORM data provider for Refine
// Built on top of drizzle-orm with support for PostgreSQL, MySQL, and SQLite

// Export essential types
export type * from './types/client.js';
export type * from './types/operations.js';
export type * from './types/config.js';

// Export core functionality
export { createProvider } from './core/data-provider.js';
export { RefineQueryBuilder as QueryBuilder } from './core/query-builder.js';
export { TransactionManager } from './core/transaction-manager.js';

// Export adapters
export * from './adapters/index.js';

// Main factory functions (recommended for most users)
export {
  createPostgreSQLProvider,
  createMySQLProvider,
  createSQLiteProvider,
  createDataProvider,
  getRuntimeDiagnostics,
  checkDatabaseSupport,
} from './factory.js';
