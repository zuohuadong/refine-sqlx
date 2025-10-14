/**
 * User-friendly factory functions for creating RefineORM data providers
 * These functions provide simplified APIs with sensible defaults and automatic runtime detection
 */

import type { Table } from 'drizzle-orm';
import type { RefineOrmDataProvider } from './types/client';
import type {
  RefineOrmOptions,
  PostgreSQLOptions,
  MySQLOptions,
  SQLiteOptions,
  ConnectionOptions,
} from './types/config';
import { ConfigurationError } from './types/errors';
import {
  createPostgreSQLProvider as createPostgreSQLAdapter,
  createMySQLProvider as createMySQLAdapter,
  createSQLiteProvider as createSQLiteAdapter,
} from './adapters/index';
import { createProvider as createProviderCore } from './core/data-provider';
import {
  detectBunRuntime,
  detectNodeRuntime,
  detectCloudflareD1,
  getRuntimeInfo,
  getRecommendedDriver,
  detectBunSqlSupport,
} from './utils/runtime-detection';

/**
 * Configuration for the universal createProvider function
 */
export interface UniversalRefineOrmConfig<
  TSchema extends Record<string, Table>,
> {
  /** Database type */
  database: 'postgresql' | 'mysql' | 'sqlite';
  /** Connection string or connection options */
  connection: string | ConnectionOptions | { d1Database: any };
  /** Drizzle schema */
  schema: TSchema;
  /** Additional options */
  options?: RefineOrmOptions;
}

/**
 * Simplified configuration for PostgreSQL
 */
export interface SimplePostgreSQLConfig<TSchema extends Record<string, Table>> {
  /** Connection string (e.g., "postgresql://user:pass@host:port/db") */
  connection: string | ConnectionOptions;
  /** Drizzle schema */
  schema: TSchema;
  /** Additional options */
  options?: PostgreSQLOptions;
}

/**
 * Simplified configuration for MySQL
 */
export interface SimpleMySQLConfig<TSchema extends Record<string, Table>> {
  /** Connection string (e.g., "mysql://user:pass@host:port/db") */
  connection: string | ConnectionOptions;
  /** Drizzle schema */
  schema: TSchema;
  /** Additional options */
  options?: MySQLOptions;
}

/**
 * Simplified configuration for SQLite
 */
export interface SimpleSQLiteConfig<TSchema extends Record<string, Table>> {
  /** Database path, connection options, or D1 database */
  connection: string | ConnectionOptions | { d1Database: any };
  /** Drizzle schema */
  schema: TSchema;
  /** Additional options */
  options?: SQLiteOptions;
}

/**
 * Universal factory function that creates a RefineORM data provider for any supported database
 * Automatically detects runtime environment and chooses optimal drivers
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * const provider = createProvider({
 *   database: 'postgresql',
 *   connection: process.env.DATABASE_URL!,
 *   schema: { users, posts }
 * });
 *
 * // MySQL
 * const provider = createProvider({
 *   database: 'mysql',
 *   connection: 'mysql://user:pass@localhost:3306/mydb',
 *   schema: { users, posts }
 * });
 *
 * // SQLite
 * const provider = createProvider({
 *   database: 'sqlite',
 *   connection: './database.db',
 *   schema: { users, posts }
 * });
 * ```
 */
export async function createProvider<TSchema extends Record<string, Table>>(
  config: UniversalRefineOrmConfig<TSchema>
): Promise<RefineOrmDataProvider<TSchema>> {
  const { database, connection, schema, options = {} } = config;

  // Add runtime information to debug logs
  if (options.debug) {
    const runtimeInfo = getRuntimeInfo();
    const recommendedDriver = getRecommendedDriver(database);
    console.log(
      `[RefineORM] Creating ${database} provider in ${runtimeInfo.runtime} runtime using ${recommendedDriver} driver`
    );
  }

  switch (database) {
    case 'postgresql':
      return await createPostgreSQLAdapter(
        connection as string | ConnectionOptions,
        schema,
        options as PostgreSQLOptions
      );

    case 'mysql':
      return await createMySQLAdapter(
        connection as string | ConnectionOptions,
        schema,
        options as MySQLOptions
      );

    case 'sqlite':
      return await createSQLiteAdapter(
        connection,
        schema,
        options as SQLiteOptions
      );

    default:
      throw new ConfigurationError(
        `Unsupported database type: ${database}. Supported types: postgresql, mysql, sqlite`
      );
  }
}

/**
 * Create a PostgreSQL data provider with automatic runtime detection
 * Chooses between bun:sql (Bun) and postgres-js (Node.js) automatically
 *
 * @example
 * ```typescript
 * // Simple usage with connection string
 * const provider = createPostgreSQLProvider({
 *   connection: process.env.DATABASE_URL!,
 *   schema: { users, posts }
 * });
 *
 * // With custom options
 * const provider = createPostgreSQLProvider({
 *   connection: {
 *     host: 'localhost',
 *     port: 5432,
 *     user: 'postgres',
 *     password: 'password',
 *     database: 'mydb'
 *   },
 *   schema: { users, posts },
 *   options: {
 *     pool: { min: 2, max: 10 },
 *     debug: true
 *   }
 * });
 * ```
 */
export async function createPostgreSQLProvider<
  TSchema extends Record<string, Table>,
>(
  config: SimplePostgreSQLConfig<TSchema>
): Promise<RefineOrmDataProvider<TSchema>> {
  const { connection, schema, options = {} } = config;

  // Add helpful runtime information
  if (options.debug) {
    const runtime = getRuntimeInfo();
    const useBunSql =
      runtime.runtime === 'bun' && detectBunSqlSupport('postgresql');
    console.log(
      `[RefineORM] Creating PostgreSQL provider in ${runtime.runtime} runtime`
    );
    console.log(
      `[RefineORM] Using ${useBunSql ? 'bun:sql' : 'postgres-js'} driver`
    );
  }

  return await createPostgreSQLAdapter(connection, schema, options);
}

/**
 * Create a MySQL data provider with automatic runtime detection
 * Uses bun:sql for Bun runtime (1.2.21+) or mysql2 for other environments
 *
 * @example
 * ```typescript
 * // Simple usage with connection string
 * const provider = createMySQLProvider({
 *   connection: 'mysql://user:password@localhost:3306/database',
 *   schema: { users, posts }
 * });
 *
 * // With custom options
 * const provider = createMySQLProvider({
 *   connection: {
 *     host: 'localhost',
 *     port: 3306,
 *     user: 'root',
 *     password: 'password',
 *     database: 'mydb'
 *   },
 *   schema: { users, posts },
 *   options: {
 *     pool: { min: 5, max: 20 },
 *     timezone: 'Z'
 *   }
 * });
 * ```
 */
export async function createMySQLProvider<
  TSchema extends Record<string, Table>,
>(config: SimpleMySQLConfig<TSchema>): Promise<RefineOrmDataProvider<TSchema>> {
  const { connection, schema, options = {} } = config;

  // Add helpful runtime information
  if (options.debug) {
    const runtime = getRuntimeInfo();
    const useBunSql = runtime.runtime === 'bun' && detectBunSqlSupport('mysql');
    console.log(
      `[RefineORM] Creating MySQL provider in ${runtime.runtime} runtime`
    );
    console.log(`[RefineORM] Using ${useBunSql ? 'bun:sql' : 'mysql2'} driver`);
  }

  return await createMySQLAdapter(connection, schema, options);
}

/**
 * Create a SQLite data provider with automatic runtime detection
 * Chooses between bun:sqlite (Bun), better-sqlite3 (Node.js), or D1 (Cloudflare) automatically
 *
 * @example
 * ```typescript
 * // Simple file-based SQLite
 * const provider = createSQLiteProvider({
 *   connection: './database.db',
 *   schema: { users, posts }
 * });
 *
 * // In-memory SQLite
 * const provider = createSQLiteProvider({
 *   connection: ':memory:',
 *   schema: { users, posts }
 * });
 *
 * // Cloudflare D1
 * const provider = createSQLiteProvider({
 *   connection: { d1Database: env.DB },
 *   schema: { users, posts }
 * });
 *
 * // With custom options
 * const provider = createSQLiteProvider({
 *   connection: {
 *     filename: './app.db',
 *     readonly: false,
 *     fileMustExist: false
 *   },
 *   schema: { users, posts },
 *   options: {
 *     debug: true,
 *     logger: (query, params) => console.log('Query:', query, params)
 *   }
 * });
 * ```
 */
export async function createSQLiteProvider<
  TSchema extends Record<string, Table>,
>(
  config: SimpleSQLiteConfig<TSchema>
): Promise<RefineOrmDataProvider<TSchema>> {
  const { connection, schema, options = {} } = config;

  // Add helpful runtime information
  if (options.debug) {
    const runtime = getRuntimeInfo();
    let driver = 'better-sqlite3';

    if (runtime.runtime === 'cloudflare-d1') {
      driver = 'd1';
    } else if (runtime.runtime === 'bun' && detectBunSqlSupport('sqlite')) {
      driver = 'bun:sqlite';
    }

    console.log(
      `[RefineORM] Creating SQLite provider in ${runtime.runtime} runtime`
    );
    console.log(`[RefineORM] Using ${driver} driver`);
  }

  return await createSQLiteAdapter(connection, schema, options);
}

/**
 * Get runtime information and recommended drivers for debugging
 * Useful for troubleshooting connection issues
 *
 * @example
 * ```typescript
 * const info = getRuntimeDiagnostics();
 * console.log('Runtime:', info.runtime);
 * console.log('Recommended drivers:', info.recommendedDrivers);
 * console.log('Available features:', info.features);
 * ```
 */
export function getRuntimeDiagnostics() {
  const runtime = getRuntimeInfo();

  return {
    runtime: runtime.runtime,
    version: runtime.version,
    recommendedDrivers: {
      postgresql: getRecommendedDriver('postgresql'),
      mysql: getRecommendedDriver('mysql'),
      sqlite: getRecommendedDriver('sqlite'),
    },
    features: {
      bunSqlPostgreSQL: detectBunSqlSupport('postgresql'),
      bunSqlMySQL: detectBunSqlSupport('mysql'),
      bunSqlite: detectBunSqlSupport('sqlite'),
      cloudflareD1: detectCloudflareD1(),
    },
    environment: {
      isBun: detectBunRuntime(),
      isNode: detectNodeRuntime(),
      isCloudflareD1: detectCloudflareD1(),
    },
  };
}

/**
 * Check if the current environment supports a specific database and driver combination
 * Useful for conditional logic in applications that support multiple databases
 *
 * @example
 * ```typescript
 * if (checkDatabaseSupport('postgresql', 'bun:sql')) {
 *   // Use Bun's native PostgreSQL support
 * } else {
 *   // Fall back to postgres-js
 * }
 * ```
 */
export function checkDatabaseSupport(
  database: 'postgresql' | 'mysql' | 'sqlite',
  driver?: string
): boolean {
  if (!driver) {
    // Check if database is supported at all
    try {
      getRecommendedDriver(database);
      return true;
    } catch {
      return false;
    }
  }

  // Check specific driver support
  switch (database) {
    case 'postgresql':
      if (driver === 'bun:sql') {
        return detectBunSqlSupport('postgresql');
      }
      if (driver === 'postgres' || driver === 'postgres-js') {
        return detectNodeRuntime();
      }
      return false;

    case 'mysql':
      if (driver === 'bun:sql') {
        return detectBunSqlSupport('mysql'); // Currently false
      }
      if (driver === 'mysql2') {
        return true; // Available in both Bun and Node.js
      }
      return false;

    case 'sqlite':
      if (driver === 'bun:sqlite') {
        return detectBunSqlSupport('sqlite');
      }
      if (driver === 'better-sqlite3') {
        return detectNodeRuntime();
      }
      if (driver === 'd1') {
        return detectCloudflareD1();
      }
      return false;

    default:
      return false;
  }
}

/**
 * Create a data provider with minimal configuration
 * Automatically detects database type from connection string when possible
 *
 * @example
 * ```typescript
 * // Auto-detect PostgreSQL from connection string
 * const provider = createDataProvider({
 *   connection: 'postgresql://user:pass@host:port/db',
 *   schema: { users, posts }
 * });
 *
 * // Auto-detect MySQL from connection string
 * const provider = createDataProvider({
 *   connection: 'mysql://user:pass@host:port/db',
 *   schema: { users, posts }
 * });
 *
 * // SQLite file path
 * const provider = createDataProvider({
 *   connection: './database.db',
 *   schema: { users, posts }
 * });
 * ```
 */
export async function createDataProvider<
  TSchema extends Record<string, Table>,
>(config: {
  connection: string | ConnectionOptions | { d1Database: any };
  schema: TSchema;
  options?: RefineOrmOptions;
}): Promise<RefineOrmDataProvider<TSchema>> {
  const { connection, schema, options = {} } = config;

  // Auto-detect database type from connection string
  let database: 'postgresql' | 'mysql' | 'sqlite';

  if (typeof connection === 'string') {
    if (
      connection.startsWith('postgresql://') ||
      connection.startsWith('postgres://')
    ) {
      database = 'postgresql';
    } else if (connection.startsWith('mysql://')) {
      database = 'mysql';
    } else if (
      connection.endsWith('.db') ||
      connection.endsWith('.sqlite') ||
      connection === ':memory:'
    ) {
      database = 'sqlite';
    } else {
      throw new ConfigurationError(
        'Could not auto-detect database type from connection string. ' +
          'Please use createProvider() with explicit database type, or use specific factory functions like createPostgreSQLProvider().'
      );
    }
  } else if (typeof connection === 'object' && 'd1Database' in connection) {
    database = 'sqlite';
  } else {
    throw new ConfigurationError(
      'Could not auto-detect database type from connection options. ' +
        'Please use createProvider() with explicit database type, or use specific factory functions.'
    );
  }

  if (options.debug) {
    console.log(`[RefineORM] Auto-detected database type: ${database}`);
  }

  return await createProvider({ database, connection, schema, options });
}
