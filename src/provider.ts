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
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { createBetterSQLite3Adapter } from './adapters/better-sqlite3-drizzle';
import { createBunSQLiteAdapter } from './adapters/bun';
import { createD1Adapter } from './adapters/d1';
import { CacheManager } from './cache';
import { validateConfig, validateFeaturesConfig } from './config';
import { OptimisticLockError } from './errors';
import {
  AggregationsExecutor,
  JSONParser,
  RelationsExecutor,
  TransactionManager,
  ViewDetector,
} from './features';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from './filters';
import { isD1Database, isDrizzleDatabase } from './runtime';
import type { QueryLogEvent, RefineSQLConfig, TableName } from './types';
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
  // Validate configuration
  validateConfig(config);
  validateD1Options(config.d1Options);

  // Validate and apply feature configuration defaults
  const features = validateFeaturesConfig(config.features);

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

  // Initialize cache manager
  const cacheManager = new CacheManager(config.cache);

  // Initialize feature executors
  const jsonParser = new JSONParser(config.schema, features.json);
  const viewDetector = new ViewDetector(db, config.schema, features.views);
  const transactionManager = new TransactionManager(db, features.transactions);
  const relationsExecutor = new RelationsExecutor(
    db,
    config.schema,
    features.relations,
  );
  const aggregationsExecutor = new AggregationsExecutor(
    db,
    config.schema,
    features.aggregations,
  );

  // Initialize all features
  await Promise.all([
    jsonParser.initialize(),
    viewDetector.initialize(),
    transactionManager.initialize(),
    relationsExecutor.initialize(),
    aggregationsExecutor.initialize(),
  ]);

  // D1 Time Travel implementation note
  if (config.d1Options?.timeTravel?.enabled) {
    console.warn(
      '[refine-sqlx] D1 Time Travel is configured, but runtime historical queries are not supported by D1 API. ' +
        'Use wrangler CLI for database restoration: `wrangler d1 time-travel restore`',
    );
  }

  /**
   * Enhanced logger
   */
  function logQuery(event: Partial<QueryLogEvent>) {
    if (!config.logging?.enabled) return;

    const logLevel = config.logging.level ?? 'info';
    const logQueries = config.logging.logQueries ?? true;
    const logPerformance = config.logging.logPerformance ?? true;
    const slowQueryThreshold = config.logging.slowQueryThreshold ?? 1000;

    const duration = event.duration ?? 0;
    const isSlow = duration > slowQueryThreshold;

    if (logQueries && event.sql) {
      const level = isSlow ? 'warn' : logLevel;
      const prefix = `[refine-sqlx][${level.toUpperCase()}]`;

      if (level === 'debug' || (logPerformance && isSlow)) {
        console.log(
          `${prefix} [${duration}ms] ${event.operation}(${event.resource})`,
        );
        console.log(`${prefix} SQL:`, event.sql);
        if (event.params && event.params.length > 0) {
          console.log(`${prefix} Params:`, event.params);
        }
      }

      if (isSlow) {
        console.warn(
          `${prefix} Slow query detected: ${event.operation}(${event.resource}) took ${duration}ms`,
        );
      }
    }

    // Call custom logger if provided
    if (config.logging.onQuery && event.operation) {
      config.logging.onQuery(event as QueryLogEvent);
    }
  }

  /**
   * Validate data against schema
   */
  async function validateData(
    resource: string,
    data: any,
    operation: 'insert' | 'update' | 'select',
  ): Promise<any> {
    if (!config.validation?.enabled) return data;

    const schema = config.validation.schemas?.[resource]?.[operation];
    if (!schema) return data;

    try {
      // Parse with Zod schema
      const validated = await schema.parseAsync(data);
      return validated;
    } catch (error: any) {
      if (config.validation.throwOnError) {
        throw error;
      } else {
        console.error(`[refine-sqlx] Validation error for ${resource}:`, error);
        return data;
      }
    }
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
   * Apply multi-tenancy filter
   */
  function applyTenancyFilter(
    table: SQLiteTableWithColumns<any>,
    meta: any,
  ): any {
    if (!config.multiTenancy?.enabled) return null;

    const tenantField = config.multiTenancy.tenantField ?? 'tenant_id';
    const tenantId = meta?.tenantId ?? config.multiTenancy.tenantId;

    // Check if bypass is requested
    if (meta?.bypassTenancy) return null;

    // Validate tenant ID exists
    if (!tenantId) {
      throw new Error('Tenant ID is required in multi-tenancy mode');
    }

    // Check if table has tenant field
    if (!(tenantField in table)) {
      if (config.multiTenancy.strictMode !== false) {
        throw new Error(
          `Table "${table}" missing tenant field: ${tenantField}`,
        );
      }
      return null;
    }

    return eq(table[tenantField], tenantId);
  }

  /**
   * Add tenant field to data
   */
  function addTenantField(data: any, meta: any): any {
    if (!config.multiTenancy?.enabled) return data;
    if (meta?.bypassTenancy) return data;

    const tenantField = config.multiTenancy.tenantField ?? 'tenant_id';
    const tenantId = meta?.tenantId ?? config.multiTenancy.tenantId;

    if (!tenantId) {
      throw new Error('Tenant ID is required in multi-tenancy mode');
    }

    return {
      ...data,
      [tenantField]: tenantId,
    };
  }

  /**
   * Get list of records with filtering, sorting, and pagination
   * Integrated with: Relations, Aggregations, JSON parsing
   */
  async function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<T>> {
    const startTime = Date.now();
    const table = getTable(params.resource);

    // Check cache
    const cacheKey = cacheManager.generateKey('getList', params.resource, {
      filters: params.filters,
      sorters: params.sorters,
      pagination: params.pagination,
      meta: params.meta,
    });

    const cacheTTL = params.meta?.cache?.ttl;
    const cacheEnabled = params.meta?.cache?.enabled ?? cacheManager.isEnabled();

    if (cacheEnabled) {
      const cached = await cacheManager.get<GetListResponse<T>>(cacheKey);
      if (cached) {
        logQuery({
          operation: 'getList',
          resource: params.resource,
          duration: Date.now() - startTime,
          sql: '[CACHED]',
        });
        return cached;
      }
    }

    // Build WHERE clause from filters
    let where = filtersToWhere(params.filters, table);

    // Apply multi-tenancy filter
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = where ? and(where, tenancyFilter) : tenancyFilter;
    }

    // Build ORDER BY clause from sorters
    const orderBy = sortersToOrderBy(params.sorters, table);

    // Calculate pagination
    const { offset, limit } = calculatePagination(params.pagination ?? {});

    // Execute query with optional relation enhancement
    let query = db.select().from(table).$dynamic();

    // Feature: Relations enhancement
    if (features.relations.enabled) {
      query = await relationsExecutor.enhanceGetList(params, query);
    }

    // Feature: Aggregations enhancement
    if (features.aggregations.enabled) {
      query = await aggregationsExecutor.enhanceGetList(params, query);
    }

    if (where) {
      query.where(where);
    }

    if (orderBy.length > 0) {
      query.orderBy(...orderBy);
    }

    let data = await query.limit(limit).offset(offset);

    // Feature: JSON parsing
    if (features.json.enabled) {
      data = jsonParser.parseResults(params.resource, data);
    }

    // Get total count
    const countResult: Array<Record<string, unknown>> = await (db as any)
      .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(table)
      .where(where || sql`1 = 1`);

    const total = Number(countResult[0]?.total ?? 0);

    const result = { data: data as T[], total };

    // Cache result
    if (cacheEnabled) {
      await cacheManager.set(cacheKey, result, cacheTTL);
    }

    // Log query
    logQuery({
      operation: 'getList',
      resource: params.resource,
      duration: Date.now() - startTime,
      sql: query.toSQL?.().sql,
      timestamp: new Date(),
    });

    return result;
  }

  /**
   * Get multiple records by IDs
   * Integrated with: JSON parsing
   */
  async function getMany<T extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<T>> {
    const startTime = Date.now();

    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Apply multi-tenancy filter
    let where: any = inArray(table[idColumn], params.ids);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    let data = await db.select().from(table).where(where);

    // Feature: JSON parsing
    if (features.json.enabled) {
      data = jsonParser.parseResults(params.resource, data);
    }

    logQuery({
      operation: 'getMany',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: data as T[] };
  }

  /**
   * Get a single record by ID
   * Integrated with: Relations, JSON parsing
   */
  async function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    const startTime = Date.now();
    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Apply multi-tenancy filter
    let where: any = eq(table[idColumn], params.id);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    // Feature: Relations enhancement
    let query = db.select().from(table).$dynamic();
    if (features.relations.enabled) {
      query = await relationsExecutor.enhanceGetOne(params, query);
    }

    const [rawData] = await query.where(where);

    if (!rawData) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    // Feature: JSON parsing
    const data = features.json.enabled
      ? jsonParser.parseResult(params.resource, rawData)
      : rawData;

    logQuery({
      operation: 'getOne',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: data as T };
  }

  /**
   * Create a new record
   * Integrated with: JSON serialization, View validation
   */
  async function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>,
  ): Promise<CreateResponse<T>> {
    const startTime = Date.now();

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'create');
    }

    const table = getTable(params.resource);

    // Add tenant field
    let data: any = addTenantField(params.variables, params.meta);

    // Feature: JSON serialization
    if (features.json.enabled) {
      data = jsonParser.serializeData(params.resource, data);
    }

    // Validate data
    data = await validateData(params.resource, data, 'insert');

    const [result] = await db.insert(table).values(data as any).returning();

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'create',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: result as T };
  }

  /**
   * Create multiple records
   * Integrated with: JSON serialization, View validation
   */
  async function createMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateManyParams<Variables>,
  ): Promise<CreateManyResponse<T>> {
    const startTime = Date.now();

    if (!params.variables || params.variables.length === 0) {
      return { data: [] };
    }

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'createMany');
    }

    const table = getTable(params.resource);

    // Add tenant field to all records
    let dataWithTenant = params.variables.map((item) =>
      addTenantField(item, params.meta),
    );

    // Feature: JSON serialization
    if (features.json.enabled) {
      dataWithTenant = dataWithTenant.map((item) =>
        jsonParser.serializeData(params.resource, item),
      );
    }

    // Validate all data
    const validatedData = await Promise.all(
      dataWithTenant.map((item) =>
        validateData(params.resource, item, 'insert'),
      ),
    );

    const data = await db
      .insert(table)
      .values(validatedData as any[])
      .returning();

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'createMany',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: data as T[] };
  }

  /**
   * Update a record with optimistic locking support
   * Integrated with: JSON serialization, View validation
   */
  async function update<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateParams<Variables>,
  ): Promise<UpdateResponse<T>> {
    const startTime = Date.now();

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'update');
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Validate data
    let data: any = await validateData(params.resource, params.variables, 'update');

    // Feature: JSON serialization
    if (features.json.enabled) {
      data = jsonParser.serializeData(params.resource, data);
    }

    // Optimistic locking
    if (config.optimisticLocking?.enabled && params.meta?.version !== undefined) {
      const versionField =
        config.optimisticLocking.versionField ?? 'version';
      const strategy = config.optimisticLocking.strategy ?? 'version';

      let where: any;
      let updateData: any;

      if (strategy === 'version') {
        // Version-based locking
        where = and(
          eq(table[idColumn], params.id),
          eq(table[versionField], params.meta.version),
        );

        updateData = {
          ...data,
          [versionField]: sql`${table[versionField]} + 1`,
        };
      } else {
        // Timestamp-based locking
        const timestampField =
          config.optimisticLocking.timestampField ?? 'updated_at';
        where = and(
          eq(table[idColumn], params.id),
          eq(table[timestampField], params.meta.lastUpdated),
        );

        updateData = {
          ...data,
          [timestampField]: new Date(),
        };
      }

      // Apply multi-tenancy filter
      const tenancyFilter = applyTenancyFilter(table, params.meta);
      if (tenancyFilter) {
        where = and(where, tenancyFilter);
      }

      const [result] = await db
        .update(table)
        .set(updateData as any)
        .where(where)
        .returning();

      if (!result) {
        // Version mismatch - fetch current version
        const currentRecords = await (db as any)
          .select({ version: table[versionField] })
          .from(table)
          .where(eq(table[idColumn], params.id));

        const current = currentRecords[0];

        throw new OptimisticLockError(
          params.resource,
          params.id,
          params.meta.version,
          current?.version,
        );
      }

      // Invalidate cache
      await cacheManager.invalidate(params.resource);

      logQuery({
        operation: 'update',
        resource: params.resource,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });

      return { data: result as T };
    }

    // Standard update without optimistic locking
    let where: any = eq(table[idColumn], params.id);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    const [result] = await db
      .update(table)
      .set(data as any)
      .where(where)
      .returning();

    if (!result) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'update',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: result as T };
  }

  /**
   * Update multiple records
   * Integrated with: JSON serialization, View validation
   */
  async function updateMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateManyParams<Variables>,
  ): Promise<UpdateManyResponse<T>> {
    const startTime = Date.now();

    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'updateMany');
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Validate data
    let data: any = await validateData(params.resource, params.variables, 'update');

    // Feature: JSON serialization
    if (features.json.enabled) {
      data = jsonParser.serializeData(params.resource, data);
    }

    // Apply multi-tenancy filter
    let where: any = inArray(table[idColumn], params.ids);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    const result = await db
      .update(table)
      .set(data as any)
      .where(where)
      .returning();

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'updateMany',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: result as T[] };
  }

  /**
   * Delete a record
   * Integrated with: View validation
   */
  async function deleteOne<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<T>> {
    const startTime = Date.now();

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'deleteOne');
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Apply multi-tenancy filter
    let where: any = eq(table[idColumn], params.id);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    const [result] = await db.delete(table).where(where).returning();

    if (!result) {
      throw new Error(
        `Record with id ${params.id} not found in ${params.resource}`,
      );
    }

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'deleteOne',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: result as T };
  }

  /**
   * Delete multiple records
   * Integrated with: View validation
   */
  async function deleteMany<T extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteManyParams<TVariables>,
  ): Promise<DeleteManyResponse<T>> {
    const startTime = Date.now();

    if (!params.ids || params.ids.length === 0) {
      return { data: [] };
    }

    // Feature: View validation
    if (features.views.enabled) {
      viewDetector.validateWrite(params.resource, 'deleteMany');
    }

    const table = getTable(params.resource);
    const idColumn = params.meta?.idColumnName ?? 'id';

    // Apply multi-tenancy filter
    let where: any = inArray(table[idColumn], params.ids);
    const tenancyFilter = applyTenancyFilter(table, params.meta);
    if (tenancyFilter) {
      where = and(where, tenancyFilter);
    }

    const data = await db.delete(table).where(where).returning();

    // Invalidate cache
    await cacheManager.invalidate(params.resource);

    logQuery({
      operation: 'deleteMany',
      resource: params.resource,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    });

    return { data: data as T[] };
  }

  // Build base DataProvider
  const dataProvider: any = {
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

  // Feature: Transactions - add transaction method if enabled
  if (features.transactions.enabled) {
    dataProvider.transaction = async <T>(
      callback: (tx: any) => Promise<T>,
    ): Promise<T> => {
      return await transactionManager.execute(callback);
    };
  }

  // Feature: Aggregations - add aggregate method if enabled
  if (features.aggregations.enabled) {
    dataProvider.aggregate = async <T extends BaseRecord = BaseRecord>(
      params: any,
    ): Promise<any> => {
      return await aggregationsExecutor.aggregate<T>(params);
    };
  }

  return dataProvider as DataProvider;
}
