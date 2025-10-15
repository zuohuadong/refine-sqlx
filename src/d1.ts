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
 *     const dataProvider = createRefineSQL({
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
import { count, eq, inArray } from 'drizzle-orm/sqlite-core';
import { createD1Adapter } from './adapters/d1';
import { calculatePagination, filtersToWhere, sortersToOrderBy } from './filters';
import type { RefineSQLConfig } from './types';

// Re-export types
export type { RefineSQLConfig, InferInsertModel, InferSelectModel, TableName } from './types';
export { createD1Adapter, isD1Available } from './adapters/d1';

/**
 * Create a Refine DataProvider for Cloudflare D1
 * Optimized build with minimal dependencies
 */
export function createRefineSQL<TSchema extends Record<string, unknown>>(
  config: RefineSQLConfig<TSchema>,
): DataProvider {
  // D1-specific initialization
  const db = createD1Adapter(config.connection as any, config.schema, config.config);

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
      const countQuery = db.select({ count: count() }).from(table).$dynamic();
      if (where) countQuery.where(where);
      const [{ count: total }] = await countQuery;

      return { data: data as any[], total };
    },

    async getMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db.select().from(table).where(inArray(table[idColumn], params.ids));
      return { data: data as any[] };
    },

    async getOne(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [data] = await db.select().from(table).where(eq(table[idColumn], params.id));
      if (!data) throw new Error(`Record with id ${params.id} not found`);
      return { data: data as any };
    },

    async create(params) {
      const table = getTable(params.resource);
      const [result] = await db.insert(table).values(params.variables as any).returning();
      return { data: result as any };
    },

    async createMany(params) {
      if (!params.variables?.length) return { data: [] };
      const table = getTable(params.resource);
      const data = await db.insert(table).values(params.variables as any[]).returning();
      return { data: data as any[] };
    },

    async update(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [result] = await db.update(table).set(params.variables as any).where(eq(table[idColumn], params.id)).returning();
      if (!result) throw new Error(`Record with id ${params.id} not found`);
      return { data: result as any };
    },

    async updateMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db.update(table).set(params.variables as any).where(inArray(table[idColumn], params.ids)).returning();
      return { data: data as any[] };
    },

    async deleteOne(params) {
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const [result] = await db.delete(table).where(eq(table[idColumn], params.id)).returning();
      if (!result) throw new Error(`Record with id ${params.id} not found`);
      return { data: result as any };
    },

    async deleteMany(params) {
      if (!params.ids?.length) return { data: [] };
      const table = getTable(params.resource);
      const idColumn = params.meta?.idColumnName ?? 'id';
      const data = await db.delete(table).where(inArray(table[idColumn], params.ids)).returning();
      return { data: data as any[] };
    },
  };
}
