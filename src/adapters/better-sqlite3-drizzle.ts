import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * Create a Drizzle database instance for better-sqlite3 (Node.js)
 *
 * @param connection - better-sqlite3 database instance or path
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle config
 */
export async function createBetterSQLite3Adapter<
  TSchema extends Record<string, unknown>,
>(
  connection: any | string | ':memory:',
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): Promise<BetterSQLite3Database<TSchema>> {
  let db: any;

  // Create or use existing better-sqlite3 database
  if (typeof connection === 'string') {
    // Dynamic import for better-sqlite3
    const Database = (await import('better-sqlite3')).default;
    db = new Database(connection);
  } else {
    db = connection;
  }

  // Create Drizzle instance
  return drizzleBetterSqlite3(db, { schema, ...config });
}

/**
 * Check if better-sqlite3 is available
 */
export async function isBetterSQLite3Available(): Promise<boolean> {
  try {
    await import('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}
