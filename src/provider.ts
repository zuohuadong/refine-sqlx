import type {
  BaseRecord,
  CreateManyParams,
  CreateManyResponse,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteManyParams,
  DeleteManyResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateManyParams,
  UpdateManyResponse,
  UpdateParams,
  UpdateResponse,
} from '@refinedev/core';
import { count, eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { createBetterSQLite3Adapter } from './adapters/better-sqlite3-drizzle';
import { createBunSQLiteAdapter } from './adapters/bun';
import { createD1Adapter } from './adapters/d1';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';
import { isD1Database, isDrizzleDatabase } from './runtime';
import type { RefineSQLConfig, TableName } from './types';
import { validateD1Options } from './utils/validation';

type DrizzleDatabase<TSchema extends Record<string, unknown>> =
  | BunSQLiteDatabase<TSchema>
  | BetterSQLite3Database<TSchema>
  | DrizzleD1Database<TSchema>;

/**
 * Create a Refine DataProvider with Drizzle ORM
 *
 * @example
 * ```typescript
 * import { createRefineSQL } from 'refine-sqlx';
 * import * as schema from './schema';
 *
 * const dataProvider = await createRefineSQL({
 *   connection: './database.sqlite',
 *   schema,
 * });
 * ```
 */
export async function createRefineSQL<TSchema extends Record<string, unknown>>(
  config: RefineSQLConfig<TSchema>,
): Promise<DataProvider> {
  // Validate D1-specific options if provided
  validateD1Options(config.d1Options);

  let db: DrizzleDatabase<TSchema>;

  // Initialize database connection
  if (isDrizzleDatabase(config.connection)) {
    db = config.connection as DrizzleDatabase<TSchema>;
  } else if (isD1Database(config.connection)) {
    db = createD1Adapter(
      config.connection as any,
      config.schema,
      config.config,
    );
  } else if (typeof Bun !== 'undefined') {
    db = await createBunSQLiteAdapter(
      config.connection as any,
      config.schema,
      config.config,
    );
  } else {
    db = await createBetterSQLite3Adapter(
      config.connection as any,
      config.schema,
      config.config,
    );
  }

  // D1 Time Travel implementation note:
  // Time Travel is primarily a CLI feature for database restoration.
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

  /**
   * Get table from schema
   */
  function getTable(resource: string): SQLiteTableWithColumns<any> {
    const table = config.schema[resource];
    if (!table) {
      throw new Error(`Table "${resource}" not found in schema`);
    }
    return table as SQLiteTableWithColumns<any>;
  }

  /**
   * Get list of records with filtering, sorting, and pagination
   */
  async function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<T>> {
    const table = getTable(params.resource);

    // Build WHERE clause from filters
    const where = filtersToWhere(params.filters, table);

    // Build ORDER BY clause from sorters
    const orderBy = sortersToOrderBy(params.sorters, table);

    // Calculate pagination
    const { offset, limit } = calculatePagination(params.pagination ?? {});

    // Execute query
    const query = db.select().from(table).$dynamic();

    if (where) {
      query.where(where);
    }

    if (orderBy.length > 0) {
      query.orderBy(...orderBy);
    }

    const data = await query.limit(limit).offset(offset);

    // Get total count using raw SQL
    const countResult: Array<Record<string, unknown>> = await (db as any)
      .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(table)
      .where(where || sql`1 = 1`);

    const total = Number(countResult[0]?.total ?? 0);

    return { data: data as T[], total };
  }

  /**
   * Get multiple records by IDs
   */
  async function getMany<T extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<T>> {
    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const data = await db
      .select()
      .from(table)
      .where(inArray(table[idColumn], params.ids));

    return { data: data as T[] };
  }

  /**
   * Get a single record by ID
   */
  async function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const [data] = await db
      .select()
      .from(table)
      .where(eq(table[idColumn], params.id));

    if (!data) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    return { data: data as T };
  }

  /**
   * Create a new record
   */
  async function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>,
  ): Promise<CreateResponse<T>> {
    const table = getTable(params.resource);

    const [result] = await db
      .insert(table)
      .values(params.variables as any)
      .returning();

    return { data: result as T };
  }

  /**
   * Create multiple records
   */
  async function createMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateManyParams<Variables>,
  ): Promise<CreateManyResponse<T>> {
    if (!params.variables || params.variables.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource);

    const data = await db
      .insert(table)
      .values(params.variables as any[])
      .returning();

    return { data: data as T[] };
  }

  /**
   * Update a record
   */
  async function update<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateParams<Variables>,
  ): Promise<UpdateResponse<T>> {
    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const [result] = await db
      .update(table)
      .set(params.variables as any)
      .where(eq(table[idColumn], params.id))
      .returning();

    if (!result) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    return { data: result as T };
  }

  /**
   * Update multiple records
   */
  async function updateMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateManyParams<Variables>,
  ): Promise<UpdateManyResponse<T>> {
    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const data = await db
      .update(table)
      .set(params.variables as any)
      .where(inArray(table[idColumn], params.ids))
      .returning();

    return { data: data as T[] };
  }

  /**
   * Delete a record
   */
  async function deleteOne<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<T>> {
    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const [result] = await db
      .delete(table)
      .where(eq(table[idColumn], params.id))
      .returning();

    if (!result) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    return { data: result as T };
  }

  /**
   * Delete multiple records
   */
  async function deleteMany<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteManyParams<TVariables>,
  ): Promise<DeleteManyResponse<T>> {
    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    const data = await db
      .delete(table)
      .where(inArray(table[idColumn], params.ids))
      .returning();

    return { data: data as T[] };
  }

  return {
    getList,
    getMany,
    getOne,
    create,
    createMany,
    update,
    updateMany,
    deleteOne,
    deleteMany,
    getApiUrl() {
      // SQL databases don't have a traditional API URL
      // Return a placeholder or configuration-based value
      return '';
    },
  };
}
