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
import { deserializeSqlResult, withClientCheck, withErrorHandling, handleErrors, dbOperation } from './utils';
import type { SQLiteOptions } from './types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';
import detectSqlite from './detect-sqlite';
import { SqlxChainQuery } from './chain-query';
import { SqlxMorphQuery, type MorphConfig } from './morph-query';
import { SqlxTypedMethods, type TableSchema } from './typed-methods';

/**
 * Enhanced data provider interface compatible with refine-orm
 */
export interface EnhancedDataProvider<TSchema extends TableSchema = TableSchema>
  extends DataProvider {
  // Chain query methods (refine-sqlx style)
  from<T extends BaseRecord = BaseRecord>(tableName: string): SqlxChainQuery<T>;

  // Polymorphic relationship methods (refine-sqlx style)
  morphTo<T extends BaseRecord = BaseRecord>(
    tableName: string,
    morphConfig: MorphConfig
  ): SqlxMorphQuery<T>;

  // Native query builders
  query: {
    select<T extends BaseRecord = BaseRecord>(resource: string): SqlxChainQuery<T>;
    insert<T extends BaseRecord = BaseRecord>(resource: string): SqlxChainQuery<T>;
    update<T extends BaseRecord = BaseRecord>(resource: string): SqlxChainQuery<T>;
    delete<T extends BaseRecord = BaseRecord>(resource: string): SqlxChainQuery<T>;
  };

  // Relationship queries
  getWithRelations<T extends BaseRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[],
    relationshipConfigs?: Record<string, any>
  ): Promise<GetOneResponse<T>>;

  // Advanced methods
  upsert<T extends BaseRecord = BaseRecord, Variables = {}>(params: {
    resource: string;
    variables: Variables;
    conflictColumns?: string[];
    updateColumns?: string[];
  }): Promise<CreateResponse<T> | UpdateResponse<T>>;

  firstOrCreate<T extends BaseRecord = BaseRecord, Variables = {}>(params: {
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
      args: [amount, id]
    };
    await resolvedClient.execute(query);
    return getOne({ resource, id });
  };

  // Helper function: Find record by conditions
  const findByConditions = async (resource: string, conditions: Record<string, any>) => {
    const filters = Object.entries(conditions).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const results = await getList({
      resource,
      filters,
      pagination: { current: 1, pageSize: 1, mode: 'server' },
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
      if (variables.email && (result.data as any)['email'] === variables.email) {
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
          pagination: { current: 1, pageSize: 1, mode: 'server' },
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

    return findCreatedRecord<T>(params.resource, params.variables, lastInsertId);
  }

  // 使用函数包装器简化 getOne 方法
  const getOne = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: GetOneParams): Promise<GetOneResponse<T>> {
    const client = await resolveClient();
    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildSelectQuery(params.resource, {
      filters: [
        {
          field: idColumnName,
          operator: 'eq',
          value: params.id,
        },
      ],
    });

    const result = await client.query(query);
    const [data] = deserializeSqlResult(result);

    if (!data) {
      throw new Error(`Record with id "${params.id}" not found in "${params.resource}"`);
    }

    return { data: data as T };
  }, 'Failed to get record');

  // 使用函数包装器简化 getList 方法
  const getList = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: GetListParams): Promise<GetListResponse<T>> {
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

    return {
      data: data as T[],
      total: count as number,
    };
  }, 'Failed to get list');

  // 使用函数包装器简化 getMany 方法
  const getMany = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: GetManyParams): Promise<GetManyResponse<T>> {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildSelectQuery(params.resource, {
      filters: [
        {
          field: idColumnName,
          operator: 'in',
          value: params.ids,
        },
      ],
    });

    const result = await client.query(query);
    const data = deserializeSqlResult(result);

    return { data: data as T[] };
  }, 'Failed to get records');

  // 使用函数包装器简化 update 方法
  const update = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: UpdateParams): Promise<UpdateResponse<T>> {
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
  const updateMany = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: UpdateManyParams): Promise<UpdateManyResponse<T>> {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const queries = params.ids.map(id =>
      transformer.buildUpdateQuery(
        params.resource,
        params.variables as any,
        { field: 'id', value: id }
      )
    );

    // Execute all queries in a batch
    await Promise.all(queries.map(query => client.execute(query)));

    const result = await getMany<T>({ resource: params.resource, ids: params.ids });
    return { data: result.data as T[] };
  }, 'Failed to update records');

  // 使用函数包装器简化 createMany 方法
  const createMany = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: CreateManyParams): Promise<CreateManyResponse<T>> {
    const client = await resolveClient();
    if (!params.variables.length) return { data: [] };

    const queries = params.variables.map(variables =>
      transformer.buildInsertQuery(params.resource, variables as any)
    );

    // Execute all queries in a batch
    const results = await Promise.all(
      queries.map(query => client.execute(query))
    );

    const ids = results
      .map(result => result.lastInsertId)
      .filter((id): id is number => id !== undefined);

    const result = await getMany<T>({ resource: params.resource, ids });
    return { data: result.data as T[] };
  }, 'Failed to create records');

  // 使用函数包装器简化 deleteOne 方法
  const deleteOne = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: DeleteOneParams): Promise<DeleteOneResponse<T>> {
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
  const deleteMany = withErrorHandling(async function <T extends BaseRecord = BaseRecord>(params: DeleteManyParams): Promise<DeleteManyResponse<T>> {
    const client = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const result = await getMany<T>({ resource: params.resource, ids: params.ids });

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = transformer.buildDeleteQuery(params.resource, {
      field: idColumnName,
      value: params.ids,
    });

    await client.execute(query);
    return { data: result.data as T[] };
  }, 'Failed to delete records');

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
    getApiUrl: () => '',

    // Chain query methods - simplified with client check
    from: withClientCheck((tableName: string) => new SqlxChainQuery(client, tableName), () => client),

    // Polymorphic relationship methods
    morphTo: withClientCheck((tableName: string, morphConfig: MorphConfig) => 
      new SqlxMorphQuery(client, tableName, morphConfig), () => client),

    // Native query builders
    query: {
      select: withClientCheck((resource: string) => new SqlxChainQuery(client, resource), () => client),
      insert: withClientCheck(<T extends BaseRecord = BaseRecord>(resource: string) => 
        new SqlxChainQuery<T>(client, resource), () => client),
      update: withClientCheck(<T extends BaseRecord = BaseRecord>(resource: string) => 
        new SqlxChainQuery<T>(client, resource), () => client),
      delete: withClientCheck(<T extends BaseRecord = BaseRecord>(resource: string) => 
        new SqlxChainQuery<T>(client, resource), () => client),
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
        relations.map(async (relation) => {
          try {
            if (relation.endsWith('s')) {
              // Assume hasMany relationship
              const foreignKey = `${resource.slice(0, -1)}_id`;
              const relatedRecords = await getList({
                resource: relation,
                filters: [{ field: foreignKey, operator: 'eq', value: id }],
                pagination: { current: 1, pageSize: 1000, mode: 'server' },
              });
              recordWithRelations[relation] = relatedRecords.data;
            } else {
              // Assume belongsTo relationship
              const foreignKeyValue = (baseRecord.data as any)[`${relation}_id`];
              if (foreignKeyValue) {
                const relatedRecord = await getOne({
                  resource: relation + 's', // Assume table name is plural
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
    get getTyped() { return getTypedMethods().getTyped.bind(getTypedMethods()); },
    get getListTyped() { return getTypedMethods().getListTyped.bind(getTypedMethods()); },
    get getManyTyped() { return getTypedMethods().getManyTyped.bind(getTypedMethods()); },
    get createTyped() { return getTypedMethods().createTyped.bind(getTypedMethods()); },
    get updateTyped() { return getTypedMethods().updateTyped.bind(getTypedMethods()); },
    get deleteTyped() { return getTypedMethods().deleteTyped.bind(getTypedMethods()); },
    get createManyTyped() { return getTypedMethods().createManyTyped.bind(getTypedMethods()); },
    get updateManyTyped() { return getTypedMethods().updateManyTyped.bind(getTypedMethods()); },
    get deleteManyTyped() { return getTypedMethods().deleteManyTyped.bind(getTypedMethods()); },
    get queryTyped() { return getTypedMethods().queryTyped.bind(getTypedMethods()); },
    get executeTyped() { return getTypedMethods().executeTyped.bind(getTypedMethods()); },
    get existsTyped() { return getTypedMethods().existsTyped.bind(getTypedMethods()); },
    get findTyped() { return getTypedMethods().findTyped.bind(getTypedMethods()); },
    get findManyTyped() { return getTypedMethods().findManyTyped.bind(getTypedMethods()); },





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

      return create<T>({ resource: params.resource, variables: params.variables as any });
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
      return updateNumericField(params.resource, params.id, params.column, '+', params.amount);
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
      return updateNumericField(params.resource, params.id, params.column, '-', params.amount);
    },

    /**
     * Execute raw SQL query
     */
    async raw<T = any>(sql: string, bindings?: any[]): Promise<T[]> {
      const resolvedClient = await resolveClient();
      const query = {
        sql: sql,
        args: bindings || []
      };
      const result = await resolvedClient.query(query);
      return deserializeSqlResult(result) as T[];
    },

    /**
     * Get table information
     */
    async getTableInfo(tableName: string): Promise<any[]> {
      const resolvedClient = await resolveClient();
      const query = {
        sql: `PRAGMA table_info(${tableName})`,
        args: []
      };
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
        args: [tableName]
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
  } as EnhancedDataProvider<TSchema>;

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
