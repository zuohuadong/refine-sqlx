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
import type { SqlClient, SqlClientFactory, SqlResult } from './client';
import { SqlTransformer } from '@refine-orm/core-utils';
import {
  deserializeSqlResult,
  withClientCheck,
  withErrorHandling,
  handleErrors,
  dbOperation,
} from './utils';
import type { SQLiteOptions } from './types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';
import detectSqlite from './detect-sqlite';
import { SqlxChainQuery } from './chain-query';
import { SqlxMorphQuery, type MorphConfig } from './morph-query';
import { SqlxTypedMethods, type TableSchema } from './typed-methods';
import {
  TransactionManager,
  NativeQueryBuilders,
  AdvancedUtils,
  type TransactionContext,
} from './advanced-features';
import { CompatibleChainQuery } from './compatibility-layer';

/**
 * Enhanced data provider interface compatible with refine-orm
 */
export interface EnhancedDataProvider<TSchema extends TableSchema = TableSchema>
  extends DataProvider {
  // Client access
  client: SqlClient;

  // Chain query methods (refine-sql style)
  from<T extends BaseRecord = BaseRecord>(tableName: string): SqlxChainQuery<T>;

  // Polymorphic relationship methods (refine-sql style)
  morphTo<T extends BaseRecord = BaseRecord>(
    tableName: string,
    morphConfig: MorphConfig
  ): SqlxMorphQuery<T>;

  // Native query builders
  query: {
    select<T extends BaseRecord = BaseRecord>(
      resource: string
    ): SqlxChainQuery<T>;
    insert<T extends BaseRecord = BaseRecord>(
      resource: string
    ): SqlxChainQuery<T>;
    update<T extends BaseRecord = BaseRecord>(
      resource: string
    ): SqlxChainQuery<T>;
    delete<T extends BaseRecord = BaseRecord>(
      resource: string
    ): SqlxChainQuery<T>;
  };

  // Relationship queries
  getWithRelations<T extends BaseRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[],
    relationshipConfigs?: Record<string, any>
  ): Promise<GetOneResponse<T>>;

  // Advanced methods
  upsert<
    T extends BaseRecord = BaseRecord,
    Variables extends Record<string, any> = Record<string, any>,
  >(params: {
    resource: string;
    variables: Variables;
    conflictColumns?: string[];
    updateColumns?: string[];
  }): Promise<CreateResponse<T> | UpdateResponse<T>>;

  firstOrCreate<
    T extends BaseRecord = BaseRecord,
    Variables extends Record<string, any> = Record<string, any>,
  >(params: {
    resource: string;
    where: Record<string, any>;
    defaults?: Variables;
  }): Promise<{ data: T; created: boolean }>;

  updateOrCreate<T extends BaseRecord = BaseRecord, Variables = {}>(params: {
    resource: string;
    where: Record<string, any>;
    values: Variables;
  }): Promise<{ data: T; created: boolean }>;

  increment(params: {
    resource: string;
    id: any;
    column: string;
    amount?: number;
  }): Promise<UpdateResponse<BaseRecord>>;

  decrement(params: {
    resource: string;
    id: any;
    column: string;
    amount?: number;
  }): Promise<UpdateResponse<BaseRecord>>;

  raw<T = any>(sql: string, bindings?: any[]): Promise<T[]>;

  getTableInfo(tableName: string): Promise<any[]>;
  hasTable(tableName: string): Promise<boolean>;

  transaction<TResult>(
    callback: (provider: EnhancedDataProvider) => Promise<TResult>
  ): Promise<TResult>;

  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  // Type-safe methods
  getTyped: SqlxTypedMethods<TSchema>['getTyped'];
  getListTyped: SqlxTypedMethods<TSchema>['getListTyped'];
  getManyTyped: SqlxTypedMethods<TSchema>['getManyTyped'];
  createTyped: SqlxTypedMethods<TSchema>['createTyped'];
  updateTyped: SqlxTypedMethods<TSchema>['updateTyped'];
  deleteTyped: SqlxTypedMethods<TSchema>['deleteTyped'];
  createManyTyped: SqlxTypedMethods<TSchema>['createManyTyped'];
  updateManyTyped: SqlxTypedMethods<TSchema>['updateManyTyped'];
  deleteManyTyped: SqlxTypedMethods<TSchema>['deleteManyTyped'];
  queryTyped: SqlxTypedMethods<TSchema>['queryTyped'];
  executeTyped: SqlxTypedMethods<TSchema>['executeTyped'];
  existsTyped: SqlxTypedMethods<TSchema>['existsTyped'];
  findTyped: SqlxTypedMethods<TSchema>['findTyped'];
  findManyTyped: SqlxTypedMethods<TSchema>['findManyTyped'];
}

export default function (client: SqlClient): EnhancedDataProvider;
export default function (factory: SqlClientFactory): EnhancedDataProvider;
export default function (
  path: ':memory:',
  options?: SQLiteOptions
): EnhancedDataProvider;
export default function (
  path: string,
  options?: SQLiteOptions
): EnhancedDataProvider;
export default function (db: D1Database): EnhancedDataProvider;
export default function (db: BunDatabase): EnhancedDataProvider;
export default function (db: NodeDatabase): EnhancedDataProvider;
export default function (db: BetterSqlite3.Database): EnhancedDataProvider;
export default function <TSchema extends TableSchema = TableSchema>(
  db:
    | SqlClient
    | SqlClientFactory
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database,
  options?: SQLiteOptions
): EnhancedDataProvider<TSchema> {
  let client: SqlClient;
  const transformer = new SqlTransformer();
  let typedMethods: SqlxTypedMethods<TSchema>;

  // Helper functions - simplified with decorators

  const getTypedMethods = () => {
    if (!typedMethods) {
      if (!client) {
        throw new Error('Client not initialized');
      }
      typedMethods = new SqlxTypedMethods<TSchema>(client);
    }
    return typedMethods;
  };

  // Simplified helper functions

  const updateNumericField = async (
    resource: string,
    id: any,
    column: string,
    operation: '+' | '-',
    amount: number = 1
  ) => {
    const resolvedClient = await resolveClient();
    const query = {
      sql: `UPDATE ${resource} SET ${column} = ${column} ${operation} ? WHERE id = ?`,
      args: [amount, id],
    };
    await resolvedClient.execute(query);
    return getOne({ resource, id });
  };

  // Helper function: Find record by conditions
  const findByConditions = async (
    resource: string,
    conditions: Record<string, any>
  ) => {
    const filters = Object.entries(conditions).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const results = await getList({
      resource,
      filters,
      pagination: { currentPage: 1, pageSize: 1, mode: 'server' },
    });

    return results.data[0] || null;
  };

  // Helper function: Find created record by unique fields
  const findCreatedRecord = async <T extends BaseRecord = BaseRecord>(
    resource: string,
    variables: any,
    lastInsertId: any
  ): Promise<CreateResponse<T>> => {
    // First try using lastInsertId
    try {
      const result = await getOne({ resource, id: lastInsertId });
      // Verify the returned record matches our inserted data
      if (
        variables.email &&
        (result.data as any)['email'] === variables.email
      ) {
        return { data: result.data as T };
      }
      if (variables.name && (result.data as any)['name'] === variables.name) {
        return { data: result.data as T };
      }
    } catch {
      // lastInsertId lookup failed, try other methods
    }

    // If lastInsertId is unreliable, try finding by unique fields
    if (variables.email) {
      try {
        const emailResults = await getList({
          resource,
          filters: [{ field: 'email', operator: 'eq', value: variables.email }],
          pagination: { currentPage: 1, pageSize: 1, mode: 'server' },
        });
        if (emailResults.data.length > 0) {
          return { data: emailResults.data[0] as T };
        }
      } catch {
        // Continue to fallback
      }
    }

    // Fallback: return lastInsertId result, even if potentially inaccurate
    const result = await getOne({ resource, id: lastInsertId });
    return { data: result.data as T };
  };

  async function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>
  ): Promise<CreateResponse<T>> {
    const client = await resolveClient();
    const query = transformer.buildInsertQuery(
      params.resource,
      params.variables as any
    );
    const { lastInsertId } = await client.execute(query);
    if (lastInsertId === undefined || lastInsertId === null) {
      throw new Error('Create operation failed');
    }

    return findCreatedRecord<T>(
      params.resource,
      params.variables,
      lastInsertId
    );
  }

  // 使用函数包装器简化 getOne 方法
  const getOne = withErrorHandling(async (params: GetOneParams): Promise<GetOneResponse<T>> => {
    const client = await resolveClient();
    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildSelectQuery(params.resource, {
      filters: [{ field: idColumnName, operator: 'eq', value: params.id }],
    });

    const result = await client.query(query);
    const [data] = deserializeSqlResult(result);

    if (!data) {
      throw new Error(
        `Record with id "${params.id}" not found in "${params.resource}"`
      );
    }

    return { data: data as T };
  }, 'Failed to get record');

  // 使用函数包装器简化 getList 方法
  const getList = withErrorHandling(async (params: GetListParams): Promise<GetListResponse<T>> => {
    const client = await resolveClient();
    const query = transformer.buildSelectQuery(params.resource, {
      filters: params.filters,
      sorting: params.sorters,
      pagination: params.pagination,
    });

    const result = await client.query(query);
    const data = deserializeSqlResult(result);

    // Build count query
    const countQuery = transformer.buildCountQuery(
      params.resource,
      params.filters
    );
    const {
      rows: [[count]],
    } = await client.query(countQuery);

    return { data: data as T[], total: count as number };
  }, 'Failed to get list');

  // 使用函数包装器简化 getMany 方法
  const getMany = withErrorHandling(async (params: GetManyParams): Promise<GetManyResponse<T>> => {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildSelectQuery(params.resource, {
      filters: [{ field: idColumnName, operator: 'in', value: params.ids }],
    });

    const result = await client.query(query);
    const data = deserializeSqlResult(result);

    return { data: data as T[] };
  }, 'Failed to get records');

  // 使用函数包装器简化 update 方法
  const update = withErrorHandling(async (params: UpdateParams): Promise<UpdateResponse<T>> => {
    const client = await resolveClient();
    const query = transformer.buildUpdateQuery(
      params.resource,
      params.variables as any,
      { field: 'id', value: params.id }
    );

    await client.execute(query);
    const result = await getOne<T>(params);
    return { data: result.data as T };
  }, 'Failed to update record');

  // 使用函数包装器简化 updateMany 方法
  const updateMany = withErrorHandling(async (params: UpdateManyParams): Promise<UpdateManyResponse<T>> => {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const queries = params.ids.map(id =>
      transformer.buildUpdateQuery(params.resource, params.variables as any, {
        field: 'id',
        value: id,
      })
    );

    // Execute all queries in a batch
    await Promise.all(queries.map(query => client.execute(query)));

    const result = await getMany<T>({
      resource: params.resource,
      ids: params.ids,
    });
    return { data: result.data as T[] };
  }, 'Failed to update records');

  // 使用函数包装器简化 createMany 方法
  const createMany = withErrorHandling(async (params: CreateManyParams): Promise<CreateManyResponse<T>> => {
    const client = await resolveClient();
    if (!params.variables.length) return { data: [] };

    const queries = params.variables.map(variables =>
      transformer.buildInsertQuery(params.resource, variables as any)
    );

    let results: any[];

    // Try transaction first, then batch, then fall back to Promise.all
    if (client.transaction) {
      results = await client.transaction!(async tx => {
        const transactionResults = [];
        for (const query of queries) {
          const result = await tx.execute(query);
          transactionResults.push(result);
        }
        return transactionResults;
      });
    } else if (client.batch) {
      results = await client.batch!(queries);
    } else {
      // Execute all queries in parallel
      results = await Promise.all(queries.map(query => client.execute(query)));
    }

    const ids = results
      .map(result => result?.lastInsertId)
      .filter((id): id is number => typeof id === 'number' && id !== undefined);

    const result = await getMany<T>({ resource: params.resource, ids });
    return { data: result.data as T[] };
  }, 'Failed to create records');

  // 使用函数包装器简化 deleteOne 方法
  const deleteOne = withErrorHandling(async (params: DeleteOneParams): Promise<DeleteOneResponse<T>> => {
    const client = await resolveClient();
    const result = await getOne<T>(params);

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildDeleteQuery(params.resource, {
      field: idColumnName,
      value: params.id,
    });

    await client.execute(query);
    return { data: result.data as T };
  }, 'Failed to delete record');

  // 使用函数包装器简化 deleteMany 方法
  const deleteMany = withErrorHandling(async (params: DeleteManyParams): Promise<DeleteManyResponse<T>> => {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const result = await getMany<T>({
      resource: params.resource,
      ids: params.ids,
    });

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildDeleteQuery(params.resource, {
      field: idColumnName,
      value: params.ids,
    });

    await client.execute(query);
    return { data: result.data as T[] };
  }, 'Failed to delete records');

  return {
    get client() {
      return resolveClient();
    },
    getList,
    getMany,
    getOne,
    create,
    createMany,
    update,
    updateMany,
    deleteOne,
    deleteMany,
    getApiUrl: () => '',

    // Chain query methods - simplified with client check
    from: withClientCheck(
      (tableName: string) => new SqlxChainQuery(client, tableName),
      () => client
    ),

    // Polymorphic relationship methods
    morphTo: withClientCheck(
      (tableName: string, morphConfig: MorphConfig) =>
        new SqlxMorphQuery(client, tableName, morphConfig),
      () => client
    ),

    // Native query builders
    query: {
      select: withClientCheck(
        (resource: string) => new SqlxChainQuery(client, resource),
        () => client
      ),
      insert: withClientCheck(
        <T extends BaseRecord = BaseRecord>(resource: string) =>
          new SqlxChainQuery<T>(client, resource),
        () => client
      ),
      update: withClientCheck(
        <T extends BaseRecord = BaseRecord>(resource: string) =>
          new SqlxChainQuery<T>(client, resource),
        () => client
      ),
      delete: withClientCheck(
        <T extends BaseRecord = BaseRecord>(resource: string) =>
          new SqlxChainQuery<T>(client, resource),
        () => client
      ),
    },

    // Relationship queries
    async getWithRelations<T extends BaseRecord = BaseRecord>(
      resource: string,
      id: any,
      relations?: string[],
      _relationshipConfigs?: Record<string, any>
    ): Promise<GetOneResponse<T>> {
      // Get base record first
      const baseRecord = await getOne<T>({ resource, id });

      if (!relations?.length) return baseRecord as GetOneResponse<T>;

      // Simplified relationship loading implementation
      const recordWithRelations = { ...baseRecord.data } as any;

      // Load all relations in parallel for better performance
      await Promise.allSettled(
        relations.map(async relation => {
          try {
            if (relation.endsWith('s')) {
              // Assume hasMany relationship
              const foreignKey = `${resource.slice(0, -1)}_id`;
              const relatedRecords = await getList({
                resource: relation,
                filters: [{ field: foreignKey, operator: 'eq', value: id }],
                pagination: { currentPage: 1, pageSize: 1000, mode: 'server' },
              });
              recordWithRelations[relation] = relatedRecords.data;
            } else {
              // Assume belongsTo relationship
              const foreignKeyValue = (baseRecord.data as any)[
                `${relation}_id`
              ];
              if (foreignKeyValue) {
                const relatedRecord = await getOne({
                  resource: `${relation  }s`, // Assume table name is plural
                  id: foreignKeyValue,
                });
                recordWithRelations[relation] = relatedRecord.data;
              } else {
                recordWithRelations[relation] = null;
              }
            }
          } catch {
            // Set to null on relationship loading failure instead of throwing error
            recordWithRelations[relation] = null;
          }
        })
      );

      return { data: recordWithRelations as T };
    },

    // Type-safe methods (lazy initialization)
    get getTyped() {
      return getTypedMethods().getTyped.bind(getTypedMethods());
    },
    get getListTyped() {
      return getTypedMethods().getListTyped.bind(getTypedMethods());
    },
    get getManyTyped() {
      return getTypedMethods().getManyTyped.bind(getTypedMethods());
    },
    get createTyped() {
      return getTypedMethods().createTyped.bind(getTypedMethods());
    },
    get updateTyped() {
      return getTypedMethods().updateTyped.bind(getTypedMethods());
    },
    get deleteTyped() {
      return getTypedMethods().deleteTyped.bind(getTypedMethods());
    },
    get createManyTyped() {
      return getTypedMethods().createManyTyped.bind(getTypedMethods());
    },
    get updateManyTyped() {
      return getTypedMethods().updateManyTyped.bind(getTypedMethods());
    },
    get deleteManyTyped() {
      return getTypedMethods().deleteManyTyped.bind(getTypedMethods());
    },
    get queryTyped() {
      return getTypedMethods().queryTyped.bind(getTypedMethods());
    },
    get executeTyped() {
      return getTypedMethods().executeTyped.bind(getTypedMethods());
    },
    get existsTyped() {
      return getTypedMethods().existsTyped.bind(getTypedMethods());
    },
    get findTyped() {
      return getTypedMethods().findTyped.bind(getTypedMethods());
    },
    get findManyTyped() {
      return getTypedMethods().findManyTyped.bind(getTypedMethods());
    },

    // ===== Advanced Methods =====

    /**
     * Create or update record
     */
    async upsert<T extends BaseRecord = BaseRecord, Variables = {}>(params: {
      resource: string;
      variables: Variables;
      conflictColumns?: string[];
      updateColumns?: string[];
    }): Promise<CreateResponse<T> | UpdateResponse<T>> {
      // Simple upsert implementation: try to find first, then decide to create or update
      const conflictColumn = params.conflictColumns?.[0] || 'id';
      const conflictValue = (params.variables as any)[conflictColumn];

      if (conflictValue) {
        try {
          const existing = await getOne<T>({
            resource: params.resource,
            id: conflictValue,
          });
          if (existing?.data) {
            return update<T>({
              resource: params.resource,
              id: conflictValue,
              variables: params.variables as any,
            });
          }
        } catch {
          // Record doesn't exist, continue to create
        }
      }

      return create<T>({
        resource: params.resource,
        variables: params.variables as any,
      });
    },

    /**
     * Find or create record
     */
    async firstOrCreate<
      T extends BaseRecord = BaseRecord,
      Variables = {},
    >(params: {
      resource: string;
      where: Record<string, any>;
      defaults?: Variables;
    }): Promise<{ data: T; created: boolean }> {
      const existing = await findByConditions(params.resource, params.where);

      if (existing) {
        return { data: existing as T, created: false };
      }

      // Create new record
      const createData = { ...params.where, ...params.defaults };
      const created = await create<T>({
        resource: params.resource,
        variables: createData as any,
      });

      return { data: created.data as T, created: true };
    },

    /**
     * Update or create record
     */
    async updateOrCreate<
      T extends BaseRecord = BaseRecord,
      Variables = {},
    >(params: {
      resource: string;
      where: Record<string, any>;
      values: Variables;
    }): Promise<{ data: T; created: boolean }> {
      const existing = await findByConditions(params.resource, params.where);

      if (existing) {
        const updated = await update<T>({
          resource: params.resource,
          id: existing.id!,
          variables: params.values as any,
        });
        return { data: updated.data as T, created: false };
      }

      // Create new record
      const createData = { ...params.where, ...params.values };
      const created = await create<T>({
        resource: params.resource,
        variables: createData as any,
      });

      return { data: created.data as T, created: true };
    },

    /**
     * Increment a numeric field
     */
    async increment(params: {
      resource: string;
      id: any;
      column: string;
      amount?: number;
    }): Promise<UpdateResponse<BaseRecord>> {
      return updateNumericField(
        params.resource,
        params.id,
        params.column,
        '+',
        params.amount
      );
    },

    /**
     * Decrement a numeric field
     */
    async decrement(params: {
      resource: string;
      id: any;
      column: string;
      amount?: number;
    }): Promise<UpdateResponse<BaseRecord>> {
      return updateNumericField(
        params.resource,
        params.id,
        params.column,
        '-',
        params.amount
      );
    },

    /**
     * Execute raw SQL query
     */
    async raw<T = any>(sql: string, bindings?: any[]): Promise<T[]> {
      const resolvedClient = await resolveClient();
      const query = { sql, args: bindings || [] };
      const result = await resolvedClient.query(query);
      return deserializeSqlResult(result) as T[];
    },

    /**
     * Get table information
     */
    async getTableInfo(tableName: string): Promise<any[]> {
      const resolvedClient = await resolveClient();
      const query = { sql: `PRAGMA table_info(${tableName})`, args: [] };
      const result = await resolvedClient.query(query);
      return deserializeSqlResult(result);
    },

    /**
     * Check if table exists
     */
    async hasTable(tableName: string): Promise<boolean> {
      const resolvedClient = await resolveClient();
      const query = {
        sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        args: [tableName],
      };
      const result = await resolvedClient.query(query);
      return deserializeSqlResult(result).length > 0;
    },

    /**
     * Execute operations in a transaction
     */
    async transaction<TResult>(
      callback: (provider: EnhancedDataProvider) => Promise<TResult>
    ): Promise<TResult> {
      const resolvedClient = await resolveClient();

      if (resolvedClient.transaction) {
        return resolvedClient.transaction(async () => {
          // Create a temporary data provider using the transaction client
          const txProvider = { ...this } as EnhancedDataProvider;
          // Here we need to replace the internal client with the transaction client
          // Simplified implementation, should actually create a new provider instance
          return callback(txProvider);
        });
      } else {
        // If transactions are not supported, execute directly
        return callback(this as EnhancedDataProvider);
      }
    },

    /**
     * Begin a transaction manually
     */
    async beginTransaction(): Promise<void> {
      const resolvedClient = await resolveClient();
      await resolvedClient.execute({ sql: 'BEGIN TRANSACTION', args: [] });
    },

    /**
     * Commit a transaction manually
     */
    async commitTransaction(): Promise<void> {
      const resolvedClient = await resolveClient();
      await resolvedClient.execute({ sql: 'COMMIT', args: [] });
    },

    /**
     * Rollback a transaction manually
     */
    async rollbackTransaction(): Promise<void> {
      const resolvedClient = await resolveClient();
      await resolvedClient.execute({ sql: 'ROLLBACK', args: [] });
    },
  } as unknown as EnhancedDataProvider<TSchema>;

  async function resolveClient() {
    if (client) return client;

    // Check if db is already a SqlClient (has query and execute methods)
    if (typeof db === 'object' && db && 'query' in db && 'execute' in db) {
      client = db as SqlClient;
      return client;
    }

    // Check if db is a SqlClientFactory (has connect method)
    const factory =
      typeof db === 'object' && 'connect' in db ?
        db
      : detectSqlite(db as any, options as any);
    client = await factory.connect();

    return client;
  }
}

/**
 * Enhanced data provider with all refine-orm compatible features
 */
export interface FullyCompatibleDataProvider<
  TSchema extends TableSchema = TableSchema,
> extends Omit<
    EnhancedDataProvider<TSchema>,
    | 'from'
    | 'query'
    | 'morphTo'
    | 'upsert'
    | 'firstOrCreate'
    | 'updateOrCreate'
    | 'increment'
    | 'decrement'
    | 'getWithRelations'
    | 'transaction'
  > {
  // Transaction support
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  // Native query builders
  query: {
    select(tableName: string): import('./advanced-features').SelectChain;
    insert(tableName: string): import('./advanced-features').InsertChain;
    update(tableName: string): import('./advanced-features').UpdateChain;
    delete(tableName: string): import('./advanced-features').DeleteChain;
  };

  // Advanced utilities
  upsert<T = BaseRecord>(
    tableName: string,
    data: Record<string, any>,
    conflictColumns?: string[]
  ): Promise<T>;

  firstOrCreate<T = BaseRecord>(
    tableName: string,
    where: Record<string, any>,
    defaults?: Record<string, any>
  ): Promise<{ data: T; created: boolean }>;

  updateOrCreate<T = BaseRecord>(
    tableName: string,
    where: Record<string, any>,
    values: Record<string, any>
  ): Promise<{ data: T; created: boolean }>;

  increment(
    tableName: string,
    where: Record<string, any>,
    column: string,
    amount?: number
  ): Promise<void>;

  decrement(
    tableName: string,
    where: Record<string, any>,
    column: string,
    amount?: number
  ): Promise<void>;

  batchInsert<T = BaseRecord>(
    tableName: string,
    data: Record<string, any>[],
    batchSize?: number,
    onConflict?: 'ignore' | 'replace'
  ): Promise<T[]>;

  executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]>;

  // Enhanced relationship loading
  getWithRelations<TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ): Promise<TRecord>;

  // Enhanced chain query that returns compatible query builder
  from(tableName: string): CompatibleChainQuery;

  // Polymorphic relationships
  morphTo(
    tableName: string,
    config: {
      typeField: string;
      idField: string;
      relationName: string;
      types: Record<string, string>;
    }
  ): CompatibleChainQuery;
}

/**
 * Create a fully compatible data provider with all refine-orm features
 */
export function createFullyCompatibleProvider<
  TSchema extends TableSchema = TableSchema,
>(
  baseProvider: EnhancedDataProvider<TSchema>
): FullyCompatibleDataProvider<TSchema> {
  const client = (baseProvider as any).client as SqlClient;

  // Initialize advanced features
  const transactionManager = new TransactionManager(client);
  const nativeQueryBuilders = new NativeQueryBuilders(client);
  const advancedUtils = new AdvancedUtils(client);

  // Create enhanced provider
  const enhancedProvider: FullyCompatibleDataProvider<TSchema> = {
    // Inherit all base provider methods
    ...baseProvider,

    // Transaction support
    async transaction<T>(
      fn: (tx: TransactionContext) => Promise<T>
    ): Promise<T> {
      return transactionManager.transaction(fn);
    },

    // Native query builders
    query: {
      select: (tableName: string) => nativeQueryBuilders.select(tableName),
      insert: (tableName: string) => nativeQueryBuilders.insert(tableName),
      update: (tableName: string) => nativeQueryBuilders.update(tableName),
      delete: (tableName: string) => nativeQueryBuilders.delete(tableName),
    },

    // Advanced utilities
    async upsert<T = BaseRecord>(
      tableName: string,
      data: Record<string, any>,
      conflictColumns?: string[]
    ): Promise<T> {
      return advancedUtils.upsert<T>(tableName, data, conflictColumns);
    },

    async firstOrCreate<T = BaseRecord>(
      tableName: string,
      where: Record<string, any>,
      defaults: Record<string, any> = {}
    ): Promise<{ data: T; created: boolean }> {
      return advancedUtils.firstOrCreate<T>(tableName, where, defaults);
    },

    async updateOrCreate<T = BaseRecord>(
      tableName: string,
      where: Record<string, any>,
      values: Record<string, any>
    ): Promise<{ data: T; created: boolean }> {
      return advancedUtils.updateOrCreate<T>(tableName, where, values);
    },

    async increment(
      tableName: string,
      where: Record<string, any>,
      column: string,
      amount: number = 1
    ): Promise<void> {
      return advancedUtils.increment(tableName, where, column, amount);
    },

    async decrement(
      tableName: string,
      where: Record<string, any>,
      column: string,
      amount: number = 1
    ): Promise<void> {
      return advancedUtils.decrement(tableName, where, column, amount);
    },

    async batchInsert<T = BaseRecord>(
      tableName: string,
      data: Record<string, any>[],
      batchSize: number = 100,
      onConflict: 'ignore' | 'replace' = 'ignore'
    ): Promise<T[]> {
      return advancedUtils.batchInsert<T>(
        tableName,
        data,
        batchSize,
        onConflict
      );
    },

    async executeRaw<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      return advancedUtils.executeRaw<T>(sql, params);
    },

    // Enhanced relationship loading
    async getWithRelations<TRecord = BaseRecord>(
      resource: string,
      id: any,
      relations: string[] = []
    ): Promise<TRecord> {
      // Get the base record
      const record = await baseProvider.getOne({ resource, id });

      if (!record.data || relations.length === 0) {
        return record.data as TRecord;
      }

      // Load each relationship
      const result = { ...record.data };

      for (const relationName of relations) {
        try {
          // Simple relationship loading - in practice this would be more sophisticated
          const relatedQuery = nativeQueryBuilders.select(
            getRelatedTableName(relationName)
          );
          const relatedData = await relatedQuery
            .where(getForeignKey(resource), 'eq', id)
            .get();

          (result as any)[relationName] = relatedData;
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Failed to load relationship ${relationName}:`, error);
          }
          (result as any)[relationName] = [];
        }
      }

      return result as TRecord;
    },

    // Enhanced chain query
    from(tableName: string): CompatibleChainQuery {
      return new CompatibleChainQuery(client, tableName);
    },

    // Polymorphic relationships
    morphTo(
      tableName: string,
      config: {
        typeField: string;
        idField: string;
        relationName: string;
        types: Record<string, string>;
      }
    ): CompatibleChainQuery {
      const query = new CompatibleChainQuery(client, tableName);

      // Add morph conditions
      if (config.types && Object.keys(config.types).length > 0) {
        const typeValues = Object.keys(config.types);
        query.where(config.typeField, 'in', typeValues);
      }

      return query;
    },
  };

  return enhancedProvider;
}

/**
 * Helper functions for relationship loading
 */
function getRelatedTableName(relationName: string): string {
  // Simple pluralization - in practice this would be more sophisticated
  return relationName.endsWith('s') ? relationName : `${relationName}s`;
}

function getForeignKey(resource: string): string {
  // Simple foreign key generation - in practice this would be configurable
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  return `${singular}_id`;
}

/**
 * Type definitions for enhanced compatibility
 */
export interface EnhancedCompatibilityConfig {
  /** Enable all advanced features */
  enableAdvancedFeatures?: boolean;
  /** Enable transaction support */
  enableTransactions?: boolean;
  /** Enable native query builders */
  enableNativeQueryBuilders?: boolean;
  /** Enable advanced utilities (upsert, firstOrCreate, etc.) */
  enableAdvancedUtils?: boolean;
  /** Enable enhanced relationship loading */
  enableEnhancedRelationships?: boolean;
  /** Show performance metrics */
  showPerformanceMetrics?: boolean;
}

/**
 * Create enhanced provider with configuration options
 */
export function createEnhancedProvider<
  TSchema extends TableSchema = TableSchema,
>(
  baseProvider: EnhancedDataProvider<TSchema>,
  config: EnhancedCompatibilityConfig = {}
): FullyCompatibleDataProvider<TSchema> {
  const { enableAdvancedFeatures = true } = config;

  if (!enableAdvancedFeatures) {
    // Return base provider with minimal enhancements
    return baseProvider as unknown as FullyCompatibleDataProvider<TSchema>;
  }

  const enhancedProvider = createFullyCompatibleProvider(baseProvider);

  // Add performance monitoring if enabled
  if (config.showPerformanceMetrics) {
    wrapWithPerformanceMonitoring(enhancedProvider);
  }

  return enhancedProvider;
}

/**
 * Wrap provider methods with performance monitoring
 */
function wrapWithPerformanceMonitoring(provider: any) {
  const originalMethods = [
    'getList',
    'getOne',
    'create',
    'update',
    'deleteOne',
  ];

  originalMethods.forEach(methodName => {
    const originalMethod = provider[methodName];
    provider[methodName] = async function (...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const endTime = Date.now();
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[RefineSQL] ${methodName} completed in ${endTime - startTime}ms`
          );
        }
        return result;
      } catch (error) {
        const endTime = Date.now();
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `[RefineSQL] ${methodName} failed in ${endTime - startTime}ms:`,
            error
          );
        }
        throw error;
      }
    };
  });
}
