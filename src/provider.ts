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
import {
  avg,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  min,
  sql,
  sum,
} from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { UnsupportedOperatorError } from './errors';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';
import type { TimeTravelSnapshot } from './time-travel-simple';
import { TimeTravelManager } from './time-travel-simple';
import type {
  CustomParams,
  CustomResponse,
  RefineSQLConfig,
  //  RefineSQLMeta,
  //  TableName,
} from './types';
import { validateD1Options } from './utils/validation';



/**
 * Extended DataProvider with Time Travel capabilities for SQLite
 */
export interface DataProviderWithTimeTravel extends DataProvider {
  /**
   * List all available snapshots
   */
  listSnapshots?(): Promise<TimeTravelSnapshot[]>;

  /**
   * Restore database to a specific snapshot
   * @param timestamp - ISO timestamp of the snapshot to restore
   */
  restoreToTimestamp?(timestamp: string): Promise<void>;

  /**
   * Restore database to the most recent snapshot before given date
   * @param date - Target date/time
   */
  restoreToDate?(date: Date): Promise<void>;

  /**
   * Create a manual snapshot
   * @param label - Optional label for the snapshot
   */
  createSnapshot?(label?: string): Promise<TimeTravelSnapshot>;

  /**
   * Cleanup old snapshots based on retention policy
   */
  cleanupSnapshots?(): Promise<number>;

  /**
   * Stop the automatic backup scheduler
   */
  stopAutoBackup?(): void;
}

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
): Promise<DataProviderWithTimeTravel> {
  // Validate D1-specific options if provided
  validateD1Options(config.d1Options);

  const db = config.connection;

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
  function getTable(
    resource: string,
  ): SQLiteTableWithColumns<any> | MySqlTable<any> | PgTable<any> {
    const table = config.schema[resource];
    if (!table) {
      throw new Error(`Table "${resource}" not found in schema`);
    }
    return table as
      | SQLiteTableWithColumns<any>
      | MySqlTable<any>
      | PgTable<any>;
  }

  /**
   * Get list of records with filtering, sorting, and pagination
   * Supports: field selection, aggregations, soft delete, relations
   */
  async function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<T>> {
    const table = getTable(params.resource) as any;
    const softDeleteField = config.softDelete?.field ?? 'deleted_at';

    // Handle aggregations
    if (params.meta?.aggregations) {
      const aggregations: Record<string, any> = {};

      // Build aggregation select
      for (const [key, agg] of Object.entries(params.meta.aggregations)) {
        const aggValue = agg as {
          sum?: string;
          avg?: string;
          count?: string | '*';
          min?: string;
          max?: string;
        };
        if (aggValue.sum)
          aggregations[key] = sum(table[aggValue.sum as string]);
        if (aggValue.avg)
          aggregations[key] = avg(table[aggValue.avg as string]);
        if (aggValue.count) {
          aggregations[key] =
            aggValue.count === '*' ?
              count()
              : count(table[aggValue.count as string]);
        }
        if (aggValue.min)
          aggregations[key] = min(table[aggValue.min as string]);
        if (aggValue.max)
          aggregations[key] = max(table[aggValue.max as string]);
      }

      // Add groupBy fields to select
      if (params.meta.groupBy) {
        for (const field of params.meta.groupBy) {
          aggregations[field] = table[field];
        }
      }

      const query = (db as any).select(aggregations).from(table).$dynamic();

      // Apply filters
      const where = filtersToWhere(params.filters, table);
      if (where) query.where(where);

      // Apply groupBy
      if (params.meta.groupBy) {
        const groupByColumns = params.meta.groupBy.map(
          (field: string) => table[field],
        );
        query.groupBy(...groupByColumns);
      }

      const data = await query;
      return { data: data as T[], total: data.length };
    }

    // Check if using relational queries
    if (params.meta?.include && (db as any).query) {
      const queryApi = (db as any).query[params.resource];
      if (!queryApi) {
        throw new Error(
          `Relational queries not available for resource: ${params.resource}. Make sure to define relations in your schema.`,
        );
      }

      // Build WHERE clause from filters
      const where = filtersToWhere(params.filters, table);

      // Build relational query
      const { offset, limit } = calculatePagination(params.pagination ?? {});

      const data = await queryApi.findMany({
        where,
        with: params.meta.include,
        limit,
        offset,
        orderBy: sortersToOrderBy(params.sorters, table),
      });

      // Get total count
      const countResult: Array<Record<string, unknown>> = await (db as any)
        .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(table)
        .where(where || sql`1 = 1`);

      const total = Number(countResult[0]?.total ?? 0);

      return { data: data as T[], total };
    }

    // Standard query with field selection
    let query: any;

    // Build select with specific fields or exclusions
    if (params.meta?.select) {
      const selectFields = params.meta.select.reduce(
        (acc: Record<string, any>, field: string) => {
          acc[field] = table[field];
          return acc;
        },
        {} as Record<string, any>,
      );
      query = (db as any).select(selectFields).from(table).$dynamic();
    } else if (params.meta?.exclude) {
      // Get all columns except excluded ones
      const allColumns = Object.keys(table).filter(
        (key) => !key.startsWith('_') && !params.meta!.exclude!.includes(key),
      );
      const selectFields = allColumns.reduce(
        (acc: Record<string, any>, field: string) => {
          acc[field] = table[field];
          return acc;
        },
        {} as Record<string, any>,
      );
      query = (db as any).select(selectFields).from(table).$dynamic();
    } else {
      query = (db as any).select().from(table).$dynamic();
    }

    // Build WHERE clause from filters
    const where = filtersToWhere(params.filters, table);

    // Apply soft delete filter
    if (config.softDelete?.enabled) {
      if (params.meta?.onlyDeleted) {
        // Only show deleted records
        const deletedWhere = isNotNull(table[softDeleteField]);
        query.where(where ? sql`${where} AND ${deletedWhere}` : deletedWhere);
      } else if (!params.meta?.includeDeleted) {
        // Exclude deleted records (default behavior)
        const notDeletedWhere = isNull(table[softDeleteField]);
        query.where(
          where ? sql`${where} AND ${notDeletedWhere}` : notDeletedWhere,
        );
      } else if (where) {
        // Include deleted records, just apply filters
        query.where(where);
      }
    } else if (where) {
      query.where(where);
    }

    // Build ORDER BY clause from sorters
    const orderBy = sortersToOrderBy(params.sorters, table);
    if (orderBy.length > 0) {
      query.orderBy(...orderBy);
    }

    // Calculate pagination
    const { offset, limit } = calculatePagination(params.pagination ?? {});

    const data = await query.limit(limit).offset(offset);

    // Get total count with same filters
    let countWhere = where;
    if (config.softDelete?.enabled && !params.meta?.includeDeleted) {
      const notDeletedWhere = isNull(table[softDeleteField]);
      countWhere =
        where ? sql`${where} AND ${notDeletedWhere}` : notDeletedWhere;
    }

    const countResult: Array<Record<string, unknown>> = await (db as any)
      .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(table)
      .where(countWhere || sql`1 = 1`);

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

    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';

    const data = await (db as any)
      .select()
      .from(table)
      .where(inArray(table[idColumn], params.ids));

    return { data: data as T[] };
  }

  /**
   * Get a single record by ID
   * Supports: field selection, relations, soft delete
   */
  async function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';
    const softDeleteField = config.softDelete?.field ?? 'deleted_at';

    // Check if using relational queries
    if (params.meta?.include && (db as any).query) {
      const queryApi = (db as any).query[params.resource];
      if (!queryApi) {
        throw new Error(
          `Relational queries not available for resource: ${params.resource}. Make sure to define relations in your schema.`,
        );
      }

      let where = eq(table[idColumn], params.id);

      // Apply soft delete filter
      if (config.softDelete?.enabled && !params.meta?.includeDeleted) {
        where = sql`${where} AND ${isNull(table[softDeleteField])}` as any;
      }

      const [data] = await queryApi.findMany({
        where,
        with: params.meta.include,
        limit: 1,
      });

      if (!data) {
        throw new Error(
          `Record with id ${params.id} not found in ${params.resource}`,
        );
      }

      return { data: data as T };
    }

    // Standard query with field selection
    let query: any;

    if (params.meta?.select) {
      const selectFields = params.meta.select.reduce(
        (acc: Record<string, any>, field: string) => {
          acc[field] = table[field];
          return acc;
        },
        {} as Record<string, any>,
      );
      query = (db as any).select(selectFields).from(table);
    } else if (params.meta?.exclude) {
      const allColumns = Object.keys(table).filter(
        (key) => !key.startsWith('_') && !params.meta!.exclude!.includes(key),
      );
      const selectFields = allColumns.reduce(
        (acc: Record<string, any>, field: string) => {
          acc[field] = table[field];
          return acc;
        },
        {} as Record<string, any>,
      );
      query = (db as any).select(selectFields).from(table);
    } else {
      query = (db as any).select().from(table);
    }

    // Build where clause
    let where = eq(table[idColumn], params.id);

    // Apply soft delete filter
    if (config.softDelete?.enabled && !params.meta?.includeDeleted) {
      where = sql`${where} AND ${isNull(table[softDeleteField])}` as any;
    }

    const [data] = await query.where(where);

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
    const table = getTable(params.resource) as any;

    const [result] = await (db as any)
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

    const table = getTable(params.resource) as any;

    const data = await (db as any)
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
    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';

    const [result] = await (db as any)
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

    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';

    const data = await (db as any)
      .update(table)
      .set(params.variables as any)
      .where(inArray(table[idColumn], params.ids))
      .returning();

    return { data: data as T[] };
  }

  /**
   * Delete a record
   * Supports soft delete
   */
  async function deleteOne<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<T>> {
    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';
    const softDeleteField =
      params.meta?.deletedAtField ?? config.softDelete?.field ?? 'deleted_at';

    // Check if soft delete is enabled
    const shouldSoftDelete =
      params.meta?.softDelete ?? config.softDelete?.enabled ?? false;

    if (shouldSoftDelete) {
      // Soft delete: update deleted_at field
      const [result] = await (db as any)
        .update(table)
        .set({ [softDeleteField]: new Date() } as any)
        .where(eq(table[idColumn], params.id))
        .returning();

      if (!result) {
        throw new Error(
          `Record with id ${params.id} not found in ${params.resource}`,
        );
      }

      return { data: result as T };
    }

    // Hard delete: actually remove the record
    const [result] = await (db as any)
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
   * Supports soft delete
   */
  async function deleteMany<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteManyParams<TVariables>,
  ): Promise<DeleteManyResponse<T>> {
    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource) as any;
    const idColumn = params.meta?.idColumnName ?? 'id';
    const softDeleteField =
      params.meta?.deletedAtField ?? config.softDelete?.field ?? 'deleted_at';

    // Check if soft delete is enabled
    const shouldSoftDelete =
      params.meta?.softDelete ?? config.softDelete?.enabled ?? false;

    if (shouldSoftDelete) {
      // Soft delete: update deleted_at field
      const data = await (db as any)
        .update(table)
        .set({ [softDeleteField]: new Date() } as any)
        .where(inArray(table[idColumn], params.ids))
        .returning();

      return { data: data as T[] };
    }

    // Hard delete: actually remove the records
    const data = await (db as any)
      .delete(table)
      .where(inArray(table[idColumn], params.ids))
      .returning();

    return { data: data as T[] };
  }

  /**
   * Execute custom SQL queries or complex database operations
   * @param params - Custom query parameters
   * @returns Query result
   */
  async function custom<TData extends BaseRecord = BaseRecord>(
    params: CustomParams,
  ): Promise<CustomResponse<TData>> {
    const { url, payload } = params;

    // Execute raw SQL query (SELECT)
    if (url === 'query' && payload?.sql) {
      // Use db.all() for SELECT queries
      const result = await (db as any).all(sql.raw(payload.sql));
      return { data: result as TData };
    }

    // Execute raw SQL statement (INSERT/UPDATE/DELETE)
    if (url === 'execute' && payload?.sql) {
      // Use db.run() for INSERT/UPDATE/DELETE
      const result = await (db as any).run(sql.raw(payload.sql));
      return { data: result as TData };
    }

    // Execute Drizzle query builder
    if (url === 'drizzle' && payload?.query) {
      const result = await payload.query;
      return { data: result as TData };
    }

    throw new UnsupportedOperatorError(
      `Unsupported custom operation: ${url}. Supported operations: 'query', 'execute', 'drizzle'`,
    );
  }

  // Create base data provider
  const dataProvider: DataProvider = {
    getList,
    getMany,
    getOne,
    create,
    createMany,
    update,
    updateMany,
    deleteOne,
    deleteMany,
    custom: custom as any, // Type cast to bypass Refine's strict generics
    getApiUrl() {
      // SQL databases don't have a traditional API URL
      // Return a placeholder or configuration-based value
      return '';
    },
  };



  // Return base data provider without Time Travel
  return dataProvider;
}
