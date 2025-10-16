import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PostgreSQLConfig } from '../types';
import {
  buildPostgreSQLConnectionString,
  validatePostgreSQLConfig,
} from '../utils/connection';

/**
 * Create a PostgreSQL adapter using Drizzle ORM with postgres-js driver
 *
 * @param connection - PostgreSQL connection configuration or connection string
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle configuration
 * @returns Drizzle PostgresJs database instance
 *
 * @example
 * ```typescript
 * import { createPostgreSQLAdapter } from 'refine-sqlx/adapters';
 * import * as schema from './schema';
 *
 * // Using connection string
 * const db = await createPostgreSQLAdapter(
 *   'postgresql://postgres:password@localhost:5432/mydb',
 *   schema
 * );
 *
 * // Using config object
 * const db = await createPostgreSQLAdapter(
 *   {
 *     host: 'localhost',
 *     port: 5432,
 *     user: 'postgres',
 *     password: 'password',
 *     database: 'mydb',
 *   },
 *   schema
 * );
 * ```
 */
export async function createPostgreSQLAdapter<
  TSchema extends Record<string, unknown>,
>(
  connection: string | PostgreSQLConfig,
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): Promise<PostgresJsDatabase<TSchema>> {
  // Dynamically import postgres to avoid bundling it when not needed
  const postgres = (await import('postgres')).default;

  let connectionConfig: PostgreSQLConfig;
  let connectionString: string;

  // Parse connection string if needed
  if (typeof connection === 'string') {
    const { parseConnectionString } = await import('../utils/connection');
    const parsed = parseConnectionString(connection);
    if (parsed.type !== 'postgresql' || !parsed.config) {
      throw new Error('Invalid PostgreSQL connection string');
    }
    connectionConfig = parsed.config as PostgreSQLConfig;
    connectionString = connection;
  } else {
    connectionConfig = connection;
    connectionString = buildPostgreSQLConnectionString(connectionConfig);
  }

  // Validate configuration
  validatePostgreSQLConfig(connectionConfig);

  // Create postgres-js connection
  const client = postgres(connectionString, {
    max: connectionConfig.max ?? 10,
    idle_timeout: connectionConfig.idle_timeout,
    connect_timeout: connectionConfig.connect_timeout ?? 30,
    ssl: connectionConfig.ssl,
  });

  // Create Drizzle database instance
  const db = drizzle(client, { schema, ...config });

  return db;
}

/**
 * Check if postgres-js is available
 */
export function isPostgreSQLAvailable(): boolean {
  try {
    require.resolve('postgres');
    return true;
  } catch {
    return false;
  }
}
