// SQL Client Adapters
// These provide the core SqlClient interface for different SQLite implementations
export { default as createBunSQLiteAdapter } from './bun-sqlite';
export { default as createNodeSQLiteAdapter } from './node-sqlite';
export { default as createCloudflareD1Adapter } from './cloudflare-d1';
export { default as createBetterSQLite3Adapter } from './better-sqlite3';

// Drizzle ORM Adapters
// These provide Drizzle database instances with full ORM functionality
export {
  createBunSQLiteAdapter as createBunDrizzleAdapter,
  isBunSQLiteAvailable,
} from './bun';
export {
  createBetterSQLite3Adapter as createBetterSQLite3DrizzleAdapter,
  isBetterSQLite3Available,
} from './better-sqlite3-drizzle';
export { createD1Adapter, d1Transaction, isD1Available } from './d1';
export { createMySQLAdapter, isMySQLAvailable } from './mysql';
export { createPostgreSQLAdapter, isPostgreSQLAvailable } from './postgresql';

// Utility exports
export * from './utils';
