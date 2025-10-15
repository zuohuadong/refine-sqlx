/**
 * Batch operation utilities
 *
 * This module provides optimized batch operations for all supported databases.
 * Compatible across all database adapters: D1, Bun SQLite, Node.js SQLite, better-sqlite3.
 */

import type { DataProvider } from '@refinedev/core';

/**
 * Default batch size for all database adapters
 *
 * This default (50) is optimized for Cloudflare D1's recommended batch size,
 * but is safe and efficient for all supported databases.
 */
export const DEFAULT_BATCH_SIZE = 50;

/**
 * Split array into chunks of specified size
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch insert utility for all database adapters
 *
 * This function optimizes bulk inserts by automatically splitting items
 * into recommended batch sizes and executing them in parallel when possible.
 *
 * Works with all database types: D1, Bun SQLite, Node.js SQLite, better-sqlite3
 *
 * @param dataProvider - Refine data provider instance
 * @param resource - Table/resource name
 * @param items - Array of items to insert
 * @param options - Optional batch configuration
 * @returns Array of created items
 *
 * @example
 * ```typescript
 * import { createRefineSQL, batchInsert } from 'refine-sqlx';
 *
 * const dataProvider = await createRefineSQL({ connection, schema });
 *
 * const users = await batchInsert(dataProvider, 'users', [
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: 'Bob', email: 'bob@example.com' },
 *   // ... up to thousands of items
 * ], { batchSize: 50 });
 * ```
 */
export async function batchInsert<T extends Record<string, any>>(
  dataProvider: DataProvider,
  resource: string,
  items: T[],
  options?: { batchSize?: number },
): Promise<T[]> {
  if (!items.length) return [];

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const batches = chunk(items, batchSize);

  // Execute batches in parallel for better performance
  const results = await Promise.all(
    batches.map((batch) =>
      dataProvider.createMany!({ resource, variables: batch as any }),
    ),
  );

  // Flatten results
  return results.flatMap((result) => result.data as T[]);
}

/**
 * Batch update utility for all database adapters
 *
 * Updates multiple records by ID in optimized batches.
 *
 * Works with all database types: D1, Bun SQLite, Node.js SQLite, better-sqlite3
 *
 * @param dataProvider - Refine data provider instance
 * @param resource - Table/resource name
 * @param ids - Array of record IDs to update
 * @param variables - Update data
 * @param options - Optional batch configuration
 * @returns Array of updated items
 *
 * @example
 * ```typescript
 * import { createRefineSQL, batchUpdate } from 'refine-sqlx';
 *
 * const dataProvider = await createRefineSQL({ connection, schema });
 *
 * const updated = await batchUpdate(dataProvider, 'users', [1, 2, 3], {
 *   status: 'active'
 * });
 * ```
 */
export async function batchUpdate<T extends Record<string, any>>(
  dataProvider: DataProvider,
  resource: string,
  ids: (string | number)[],
  variables: Partial<T>,
  options?: { batchSize?: number },
): Promise<T[]> {
  if (!ids.length) return [];

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const batches = chunk(ids, batchSize);

  // Execute batches in parallel for better performance
  const results = await Promise.all(
    batches.map((batchIds) =>
      dataProvider.updateMany!({
        resource,
        ids: batchIds,
        variables: variables as any,
      }),
    ),
  );

  return results.flatMap((result) => result.data as T[]);
}

/**
 * Batch delete utility for all database adapters
 *
 * Deletes multiple records by ID in optimized batches.
 *
 * Works with all database types: D1, Bun SQLite, Node.js SQLite, better-sqlite3
 *
 * @param dataProvider - Refine data provider instance
 * @param resource - Table/resource name
 * @param ids - Array of record IDs to delete
 * @param options - Optional batch configuration
 * @returns Array of deleted items
 *
 * @example
 * ```typescript
 * import { createRefineSQL, batchDelete } from 'refine-sqlx';
 *
 * const dataProvider = await createRefineSQL({ connection, schema });
 *
 * const deleted = await batchDelete(dataProvider, 'users', [1, 2, 3]);
 * ```
 */
export async function batchDelete<T extends Record<string, any>>(
  dataProvider: DataProvider,
  resource: string,
  ids: (string | number)[],
  options?: { batchSize?: number },
): Promise<T[]> {
  if (!ids.length) return [];

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const batches = chunk(ids, batchSize);

  // Execute batches in parallel
  const results = await Promise.all(
    batches.map((batchIds) =>
      dataProvider.deleteMany!({ resource, ids: batchIds }),
    ),
  );

  return results.flatMap((result) => result.data as T[]);
}
