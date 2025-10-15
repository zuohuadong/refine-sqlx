import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleBunSqlite } from 'drizzle-orm/bun-sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

/**
 * Create a Drizzle database instance for Bun SQLite
 *
 * @param connection - Bun SQLite database instance or path
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle config
 */
export async function createBunSQLiteAdapter<
  TSchema extends Record<string, unknown>,
>(
  connection: any | string | ':memory:',
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): Promise<BunSQLiteDatabase<TSchema>> {
  let db: any;

  // Create or use existing Bun SQLite database
  if (typeof connection === 'string') {
    // Dynamic import for bun:sqlite
    if (typeof Bun === 'undefined') {
      throw new Error(
        'Bun runtime not detected. Cannot use bun:sqlite adapter.',
      );
    }

    const { Database } = await import('bun:sqlite');
    db = new Database(connection);
  } else {
    db = connection;
  }

  // Create Drizzle instance
  return drizzleBunSqlite(db, { schema, ...config });
}

/**
 * Check if Bun SQLite is available
 */
export function isBunSQLiteAvailable(): boolean {
  return typeof Bun !== 'undefined';
}
