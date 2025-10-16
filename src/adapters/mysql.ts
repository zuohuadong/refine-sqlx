import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import type { MySQLConfig } from '../types';
import {
  buildMySQLConnectionString,
  validateMySQLConfig,
} from '../utils/connection';

/**
 * Create a MySQL adapter using Drizzle ORM with mysql2 driver
 *
 * @param connection - MySQL connection configuration or connection string
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle configuration
 * @returns Drizzle MySQL2 database instance
 *
 * @example
 * ```typescript
 * import { createMySQLAdapter } from 'refine-sqlx/adapters';
 * import * as schema from './schema';
 *
 * // Using connection string
 * const db = await createMySQLAdapter(
 *   'mysql://root:password@localhost:3306/mydb',
 *   schema
 * );
 *
 * // Using config object
 * const db = await createMySQLAdapter(
 *   {
 *     host: 'localhost',
 *     port: 3306,
 *     user: 'root',
 *     password: 'password',
 *     database: 'mydb',
 *   },
 *   schema
 * );
 * ```
 */
export async function createMySQLAdapter<
  TSchema extends Record<string, unknown>,
>(
  connection: string | MySQLConfig,
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): Promise<MySql2Database<TSchema>> {
  // Dynamically import mysql2 to avoid bundling it when not needed
  const mysql = await import('mysql2/promise');

  let connectionConfig: MySQLConfig;

  // Parse connection string if needed
  if (typeof connection === 'string') {
    const { parseConnectionString } = await import('../utils/connection');
    const parsed = parseConnectionString(connection);
    if (parsed.type !== 'mysql' || !parsed.config) {
      throw new Error('Invalid MySQL connection string');
    }
    connectionConfig = parsed.config as MySQLConfig;
  } else {
    connectionConfig = connection;
  }

  // Validate configuration
  validateMySQLConfig(connectionConfig);

  // Create mysql2 connection pool
  const pool = mysql.createPool({
    host: connectionConfig.host,
    port: connectionConfig.port ?? 3306,
    user: connectionConfig.user,
    password: connectionConfig.password,
    database: connectionConfig.database,
    ssl: connectionConfig.ssl,
    connectionLimit: connectionConfig.pool?.max ?? 10,
    waitForConnections: true,
    queueLimit: 0,
  });

  // Create Drizzle database instance
  const db = drizzle(pool, { schema, mode: 'default', ...config });

  return db;
}

/**
 * Check if mysql2 is available
 */
export function isMySQLAvailable(): boolean {
  try {
    require.resolve('mysql2/promise');
    return true;
  } catch {
    return false;
  }
}
