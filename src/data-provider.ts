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
import {
  createCrudFilters,
  createCrudSorting,
  createDeleteQuery,
  createInsertQuery,
  createPagination,
  createSelectQuery,
  createUpdateQuery,
  deserializeSqlResult,
} from './utils';
import type { SQLiteOptions } from './detect-sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';
import detectSqlite from './detect-sqlite';

export default function (client: SqlClient): DataProvider;
export default function (factory: SqlClientFactory): DataProvider;
export default function (
  path: ':memory:',
  options?: SQLiteOptions,
): DataProvider;
export default function (path: string, options?: SQLiteOptions): DataProvider;
export default function (db: D1Database): DataProvider;
export default function (db: BunDatabase): DataProvider;
export default function (db: NodeDatabase): DataProvider;
export default function (db: BetterSqlite3.Database): DataProvider;
export default function (
  db:
    | SqlClient
    | SqlClientFactory
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database,
  options?: SQLiteOptions,
): DataProvider {
  let client: SqlClient;

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
  } as DataProvider;

  async function resolveClient() {
    if (client) return client;

    const factory =
      typeof db === 'object' && 'connect' in db ?
        db
      : detectSqlite(db as any, options as any);
    client = await factory.connect();

    return client;
  }

  async function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<T>> {
    const client = await resolveClient();
    const sqlParts: string[] = ['SELECT * FROM', params.resource];
    const sqlValues: unknown[] = [];

    const where = createCrudFilters(params.filters);
    if (where?.sql) {
      sqlParts.push('WHERE', where.sql);
      sqlValues.push(...where.args);
    }

    const sort = createCrudSorting(params.sorters);
    if (sort) sqlParts.push('ORDER BY', sort.sql);

    const pagination = createPagination(params.pagination);
    if (pagination?.sql) {
      sqlParts.push(pagination.sql);
      sqlValues.push(...pagination.args);
    }

    const result = await client.query({
      sql: sqlParts.join(' '),
      args: sqlValues,
    });
    const data = deserializeSqlResult(result);

    const {
      rows: [[count]],
    } = await client.query({
      sql: `SELECT COUNT(*) FROM ${params.resource}`,
      args: [],
    });

    return { total: count as number, data: data as T[] };
  }

  async function getMany<T extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<T>> {
    if (!params.ids.length) return { data: [] };

    const client = await resolveClient();
    const query = createSelectQuery(params.resource, {
      field: params.meta?.idColumnName ?? 'id',
      operator: 'in',
      value: params.ids,
    });
    const result = await client.query(query);

    return { data: deserializeSqlResult(result) as T[] };
  }

  async function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    const client = await resolveClient();
    const query = createSelectQuery(params.resource, {
      field: params.meta?.idColumnName ?? 'id',
      operator: 'eq',
      value: params.id,
    });
    const result = await client.query(query);
    const [data] = deserializeSqlResult(result);

    return { data: data as T };
  }

  async function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>,
  ): Promise<CreateResponse<T>> {
    const client = await resolveClient();
    const query = createInsertQuery(params.resource, params.variables as any);
    const { lastInsertId } = await client.execute(query);
    if (!lastInsertId) {
      throw new Error('Create operation failed');
    }

    return getOne({ resource: params.resource, id: lastInsertId });
  }

  async function createMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateManyParams<Variables>,
  ): Promise<CreateManyResponse<T>> {
    if (!params.variables.length) return { data: [] };
    const client = await resolveClient();

    if (client.transaction) {
      const ids = await client.transaction!(async (tx) => {
        return Promise.all(
          params.variables.map(async (e) => {
            const query = createInsertQuery(
              params.resource,
              params.variables as any,
            );
            const { lastInsertId } = await tx.execute(query);
            if (!lastInsertId) {
              throw new Error('Failed to create record');
            }

            return lastInsertId;
          }),
        );
      });

      return getMany({ resource: params.resource, ids });
    } else if (client.batch) {
      const query = params.variables.map((e) =>
        createInsertQuery(params.resource, e as any),
      );
      const result = await client.batch!(query);
      const data = result
        .map((e) => {
          if ('changes' in e || 'lastInsertId' in e) return void 0;
          return deserializeSqlResult(e as SqlResult);
        })
        .filter(Boolean);
      return { data: data as unknown as T[] };
    }

    const result = await Promise.all(
      params.variables.map((e) =>
        create({ resource: params.resource, variables: e }),
      ),
    );
    return { data: result.map((e) => e.data as T) };
  }

  async function update<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateParams<Variables>,
  ): Promise<UpdateResponse<T>> {
    const client = await resolveClient();
    const query = createUpdateQuery(
      params.resource,
      {
        field: params.meta?.idColumnName ?? 'id',
        operator: 'eq',
        value: params.id,
      },
      params.variables as any,
    );
    await client.execute(query);
    return getOne(params);
  }

  async function updateMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateManyParams<Variables>,
  ): Promise<UpdateManyResponse<T>> {
    if (!params.ids.length) return { data: [] };

    const client = await resolveClient();
    const query = createUpdateQuery(
      params.resource,
      {
        field: params.meta?.idColumnName ?? 'id',
        operator: 'in',
        value: params.ids,
      },
      params.variables as any,
    );
    await client.execute(query);
    return getMany(params);
  }

  async function deleteOne<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteOneParams<Variables>,
  ): Promise<DeleteOneResponse<T>> {
    const client = await resolveClient();
    const result = await getOne<T>(params);
    const query = createDeleteQuery(params.resource, {
      field: params.meta?.idColumnName ?? 'id',
      operator: 'eq',
      value: params.id,
    });
    await client.execute(query);
    return result;
  }

  async function deleteMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteManyParams<Variables>,
  ): Promise<DeleteManyResponse<T>> {
    if (!params.ids.length) return Promise.resolve({ data: [] });

    const result = getMany<T>(params);
    const client = await resolveClient();
    const query = createDeleteQuery(params.resource, {
      field: params.meta?.idColumnName ?? 'id',
      operator: 'in',
      value: params.ids,
    });
    await client.execute(query);
    return result;
  }
}
