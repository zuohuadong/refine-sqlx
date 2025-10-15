import type {
  D1Database,
  D1PreparedStatement,
} from '@cloudflare/workers-types';
import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Create a Drizzle database instance for Cloudflare D1
 *
 * @param connection - D1Database instance
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle config
 */
export function createD1Adapter<TSchema extends Record<string, unknown>>(
  connection: D1Database,
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): DrizzleD1Database<TSchema> {
  // Create Drizzle instance for D1
  return drizzleD1(connection, { schema, ...config });
}

/**
 * Check if running in Cloudflare Workers environment
 */
export function isD1Available(): boolean {
  try {
    return (
      typeof (globalThis as any).caches !== 'undefined' &&
      'default' in (globalThis as any).caches
    );
  } catch {
    return false;
  }
}

/**
 * Wrapper for D1 transaction using batch API
 *
 * D1 doesn't support traditional BEGIN/COMMIT/ROLLBACK transactions,
 * but provides atomic batch operations that achieve the same result.
 *
 * @param db - Drizzle D1 database instance
 * @param callback - Transaction callback with statements
 */
export async function d1Transaction<T>(
  db: D1Database,
  callback: (statements: D1PreparedStatement[]) => Promise<void>,
): Promise<T[]> {
  const statements: D1PreparedStatement[] = [];

  // Collect statements
  await callback(statements);

  // Execute as atomic batch
  if (statements.length === 0) {
    return [];
  }

  // D1 batch is atomic - all succeed or all fail
  const results = await db.batch(statements);

  return results as T[];
}
