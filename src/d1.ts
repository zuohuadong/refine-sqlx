/**
 * Cloudflare D1 optimized build
 *
 * This entry point provides a tree-shaken, optimized build specifically for
 * Cloudflare D1 environments. It includes only the D1 adapter and necessary
 * utilities, resulting in significantly smaller bundle size.
 *
 * Target: < 250 KB (recommended), < 1000 KB (maximum for Workers)
 *
 * @example
 * ```typescript
 * import { createRefineSQL } from 'refine-sqlx/d1';
 * import * as schema from './schema';
 *
 * export default {
 *   async fetch(request: Request, env: { DB: D1Database }) {
 *     const dataProvider = await createRefineSQL({
 *       connection: env.DB,
 *       schema,
 *     });
 *
 *     return Response.json({ ok: true });
 *   },
 * };
 * ```
 */

import type { DataProvider } from '@refinedev/core';
import { count, eq, inArray, sql } from 'drizzle-orm';
import { createD1Adapter } from './adapters/d1';
import { validateD1Options } from './utils/validation';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';
import type { RefineSQLConfig } from './types';

export type {
  RefineSQLConfig,
  InferInsertModel,
  InferSelectModel,
  TableName,
  D1Options,
} from './types';
export { createD1Adapter, isD1Available } from './adapters/d1';
export {
  batchInsert,
  batchUpdate,
  batchDelete,
  DEFAULT_BATCH_SIZE,
} from './utils/batch';

/**
 * Create a Refine DataProvider for Cloudflare D1
 * Optimized build with minimal dependencies
 *
 * @example
 * ```typescript
 * const dataProvider = await createRefineSQL({
 *   connection: env.DB,
 *   schema,
 * });
 * ```
 *
 * @example D1 with batch configuration
 * ```typescript
 * const dataProvider = await createRefineSQL({
 *   connection: env.DB,
 *   schema,
 *   d1Options: {
 *     batch: { maxSize: 50 }
 *   }
 * });
 * ```
 *
 * @example D1 with Time Travel (queries historical data)
 * ```typescript
 * const dataProvider = await createRefineSQL({
 *   connection: env.DB,
 *   schema,
 *   d1Options: {
 *     timeTravel: {
 *       enabled: true,
 *       bookmark: 'before-migration' // or Unix timestamp
 *     }
 *   }
 * });
 * ```
 */
export async function createRefineSQL<TSchema extends Record<string, unknown>>(
  config: RefineSQLConfig<TSchema>,
): Promise<DataProvider> {
  // Validate D1-specific options
  validateD1Options(config.d1Options);

  // D1-specific initialization
  const db = createD1Adapter(
    config.connection as any,
    config.schema,
    config.config,
  );

  // Time Travel implementation note:
  // D1 Time Travel is primarily a CLI feature for database restoration.
  // Runtime queries at specific points in time are not directly supported via the D1 client API.
  // For production use cases requiring historical data access, consider:
  // 1. Using wrangler CLI for point-in-time restoration: `wrangler d1 time-travel restore`
  // 2. Implementing application-level versioning with timestamp columns
  // 3. Creating separate historical tables with triggers
  if (config.d1Options?.timeTravel?.enabled) {
    console.warn(
      '[refine-sqlx] D1 Time Travel is configured, but runtime historical queries are not supported by D1 API. ' +
        'Use wrangler CLI for database restoration: `wrangler d1 time-travel restore`',
    );
  }

  function getTable(resource: string) {
    const table = config.schema[resource];
    if (!table) {
      throw new Error(`Table "${resource}" not found in schema`);
    }
    return table as any;
  }

  return {
    async getList(params) {
      const table = getTable(params.resource);
      const where = filtersToWhere(params.filters, table);
      const orderBy = sortersToOrderBy(params.sorters, table);
      const { offset, limit } = calculatePagination(params.pagination ?? {});

      const query = db.select().from(table).$dynamic();
      if (where) query.where(where);
      if (orderBy.length > 0) query.orderBy(...orderBy);

      const data = await query.limit(limit).offset(offset);

      // Get total count using raw SQL
      const countResult: Array<Record<string, unknown>> = await (db as any)
        .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(table)
        .where(where || sql`1 = 1`);
      const total = Number(countResult[0]?.total ?? 0);

      return { data: data as any[], total };
    },

    async getMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db
        .select()
        .from(table)
        .where(inArray(table[idColumn], params.ids));
      return { data: data as any[] };
    },

    async getOne(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [data] = await db
        .select()
        .from(table)
        .where(eq(table[idColumn], params.id));
      if (!data) throw new Error(`Record with id ${params.id} not found`);
      return { data: data as any };
    },

    async create(params) {
      const table = getTable(params.resource);
      const [result] = await db
        .insert(table)
        .values(params.variables as any)
        .returning();
      return { data: result as any };
    },

    async createMany(params) {
      if (!params.variables?.length) return { data: [] };
      const table = getTable(params.resource);
      const data = await db
        .insert(table)
        .values(params.variables as any[])
        .returning();
      return { data: data as any[] };
    },

    async update(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [result] = await db
        .update(table)
        .set(params.variables as any)
        .where(eq(table[idColumn], params.id))
        .returning();
      if (!result) throw new Error(`Record with id ${params.id} not found`);
      return { data: result as any };
    },

    async updateMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db
        .update(table)
        .set(params.variables as any)
        .where(inArray(table[idColumn], params.ids))
        .returning();
      return { data: data as any[] };
    },

    async deleteOne(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [result] = await db
        .delete(table)
        .where(eq(table[idColumn], params.id))
        .returning();
      if (!result) throw new Error(`Record with id ${params.id} not found`);
      return { data: result as any };
    },

    async deleteMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db
        .delete(table)
        .where(inArray(table[idColumn], params.ids))
        .returning();
      return { data: data as any[] };
    },

    getApiUrl() {
      // D1 doesn't have a traditional API URL
      // Return a placeholder or configuration-based value
      return '';
    },
  };
}
