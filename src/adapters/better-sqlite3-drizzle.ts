import type BetterSqlite3 from 'better-sqlite3';
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
export function createBetterSQLite3Adapter<TSchema extends Record<string, unknown>>(
  connection: BetterSqlite3.Database | string | ':memory:',
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): BetterSQLite3Database<TSchema> {
  let db: BetterSqlite3.Database;

  // Create or use existing better-sqlite3 database
  if (typeof connection === 'string') {
    // Dynamic import for better-sqlite3
    const Database = require('better-sqlite3');
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
export function isBetterSQLite3Available(): boolean {
  try {
    require('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}
