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
import type { MySQLTable } from 'drizzle-orm/mysql-core';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { createBetterSQLite3Adapter } from './adapters/better-sqlite3-drizzle';
import { createBunSQLiteAdapter } from './adapters/bun';
import { createD1Adapter } from './adapters/d1';
import { createMySQLAdapter } from './adapters/mysql';
import { createPostgreSQLAdapter } from './adapters/postgresql';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';
import { isD1Database, isDrizzleDatabase } from './runtime';
import type { TimeTravelSnapshot } from './time-travel-simple';
import { TimeTravelManager } from './time-travel-simple';
import type {
  CustomParams,
  CustomResponse,
  RefineSQLConfig,
  RefineSQLMeta,
  TableName,
} from './types';
import { detectDatabaseType, parseConnectionString } from './utils/connection';
import { validateD1Options } from './utils/validation';
import { UnsupportedOperatorError } from './errors';

type DrizzleDatabase<TSchema extends Record<string, unknown>> =
  | BunSQLiteDatabase<TSchema>
  | BetterSQLite3Database<TSchema>
  | DrizzleD1Database<TSchema>
  | MySql2Database<TSchema>
  | PostgresJsDatabase<TSchema>;

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

  let db: DrizzleDatabase<TSchema>;
  let dbPath: string | undefined;
  let dbType: string;

  // Initialize database connection based on type detection
  if (isDrizzleDatabase(config.connection)) {
    // Already a Drizzle instance - use directly
    db = config.connection as DrizzleDatabase<TSchema>;
    dbType = 'unknown';
  } else if (isD1Database(config.connection)) {
    // Cloudflare D1 database instance
    db = createD1Adapter(
      config.connection as any,
      config.schema,
      config.config,
    );
    dbType = 'd1';
  } else {
    // Detect database type from connection string or config
    dbType = detectDatabaseType(config.connection);

    switch (dbType) {
      case 'mysql':
        db = await createMySQLAdapter(
          config.connection as any,
          config.schema,
          config.config,
        );
        break;

      case 'postgresql':
        db = await createPostgreSQLAdapter(
          config.connection as any,
          config.schema,
          config.config,
        );
        break;

      case 'sqlite':
      case 'd1':
      default:
        // SQLite: auto-detect runtime (Bun, Node.js, better-sqlite3)
        // Store the database path for Time Travel
        if (
          typeof config.connection === 'string' &&
          config.connection !== ':memory:'
        ) {
          dbPath = config.connection;
        }

        if (typeof Bun !== 'undefined') {
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
        break;
    }
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
  function getTable(
    resource: string,
  ): SQLiteTableWithColumns<any> | MySQLTable<any> | PgTable<any> {
    const table = config.schema[resource];
    if (!table) {
      throw new Error(`Table "${resource}" not found in schema`);
    }
    return table as
      | SQLiteTableWithColumns<any>
      | MySQLTable<any>
      | PgTable<any>;
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

  /**
   * Execute custom SQL queries or complex database operations
   * @param params - Custom query parameters
   * @returns Query result
   */
  async function custom<T = any>(
    params: CustomParams,
  ): Promise<CustomResponse<T>> {
    const { url, payload } = params;

    // Execute raw SQL query (SELECT)
    if (url === 'query' && payload?.sql) {
      const result = await db.execute(sql.raw(payload.sql));
      return { data: result.rows as T };
    }

    // Execute raw SQL statement (INSERT/UPDATE/DELETE)
    if (url === 'execute' && payload?.sql) {
      const result = await db.execute(sql.raw(payload.sql));
      return { data: result as T };
    }

    // Execute Drizzle query builder
    if (url === 'drizzle' && payload?.query) {
      const result = await payload.query;
      return { data: result as T };
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
    custom,
    getApiUrl() {
      // SQL databases don't have a traditional API URL
      // Return a placeholder or configuration-based value
      return '';
    },
  };

  // Add Time Travel functionality for SQLite databases with file path
  if (config.timeTravel?.enabled && dbPath && dbType === 'sqlite') {
    const timeTravelManager = new TimeTravelManager(dbPath, config.timeTravel);

    return {
      ...dataProvider,
      listSnapshots: () => timeTravelManager.listSnapshots(),
      restoreToTimestamp: (timestamp: string) =>
        timeTravelManager.restoreToTimestamp(timestamp),
      restoreToDate: (date: Date) => timeTravelManager.restoreToDate(date),
      createSnapshot: (label?: string) =>
        timeTravelManager.createSnapshot(label),
      cleanupSnapshots: () => timeTravelManager.cleanupSnapshots(),
      stopAutoBackup: () => timeTravelManager.stopAutoBackup(),
    };
  }

  // Return base data provider without Time Travel
  return dataProvider;
}
