/**
 * 核心数据提供器 - 简化版
 * 只包含基础 CRUD 操作，移除高级功能
 */

import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
  DataProvider,
} from '@refinedev/core';

import type { SqlClient, SqlClientFactory } from '../client';
import type { TableSchema } from '../typed-methods';
import type { SQLiteOptions } from '../types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';

import { LightweightSqlBuilder } from './sql-builder';
import { CoreChainQuery } from './chain-query';
import { deserializeSqlResult } from '../utils';
import detectSqlite from '../detect-sqlite';

/**
 * 核心数据提供器接口
 */
export interface CoreDataProvider<TSchema extends TableSchema = TableSchema>
  extends DataProvider {
  // 客户端访问
  client: SqlClient;

  // 链式查询
  from<T extends BaseRecord = BaseRecord>(tableName: string): CoreChainQuery<T>;

  // 原生 SQL
  raw<T = any>(sql: string, bindings?: any[]): Promise<T[]>;
}

/**
 * 创建核心数据提供器
 */
export function createCoreProvider<TSchema extends TableSchema = TableSchema>(
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
): CoreDataProvider<TSchema> {
  let client: SqlClient;
  const builder = new LightweightSqlBuilder();

  // 解析客户端
  async function resolveClient() {
    if (client) return client;

    // 检查是否已经是 SqlClient
    if (typeof db === 'object' && db && 'query' in db && 'execute' in db) {
      client = db as SqlClient;
      return client;
    }

    // 检查是否是 SqlClientFactory
    const factory =
      typeof db === 'object' && 'connect' in db ?
        db
      : detectSqlite(db as any, options as any);
    const connectedClient = await factory.connect();
    client = connectedClient;

    return client;
  }

  // 辅助函数：查找创建的记录
  const findCreatedRecord = async <T extends BaseRecord = BaseRecord>(
    resource: string,
    variables: any,
    lastInsertId: any
  ): Promise<CreateResponse<T>> => {
    try {
      const result = await getOne({ resource, id: lastInsertId });
      return { data: result.data as T };
    } catch {
      // 如果通过 ID 查找失败，尝试通过唯一字段查找
      if (variables.email) {
        try {
          const results = await getList({
            resource,
            filters: [
              { field: 'email', operator: 'eq', value: variables.email },
            ],
            pagination: { currentPage: 1, pageSize: 1, mode: 'server' },
          });
          if (results.data.length > 0) {
            return { data: results.data[0] as T };
          }
        } catch {
          // 继续到后备方案
        }
      }

      // 后备方案：返回 lastInsertId 结果
      const result = await getOne({ resource, id: lastInsertId });
      return { data: result.data as T };
    }
  };

  // CRUD 操作
  const getOne = async <T extends BaseRecord = BaseRecord>(
    params: GetOneParams
  ): Promise<GetOneResponse<T>> => {
    const resolvedClient = await resolveClient();
    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = builder.buildSelectQuery(params.resource, {
      filters: [{ field: idColumnName, operator: 'eq', value: params.id }],
    });

    const result = await resolvedClient.query(query);
    const [data] = deserializeSqlResult(result);

    if (!data) {
      throw new Error(
        `Record with id "${params.id}" not found in "${params.resource}"`
      );
    }

    return { data: data as T };
  };

  const getList = async <T extends BaseRecord = BaseRecord>(
    params: GetListParams
  ): Promise<GetListResponse<T>> => {
    const resolvedClient = await resolveClient();
    const query = builder.buildSelectQuery(params.resource, {
      filters: params.filters,
      sorting: params.sorters,
      pagination: params.pagination,
    });

    const result = await resolvedClient.query(query);
    const data = deserializeSqlResult(result);

    // 构建计数查询
    const countQuery = builder.buildCountQuery(params.resource, params.filters);
    const countResult = await resolvedClient.query(countQuery);
    const countRows = deserializeSqlResult(countResult);
    const total = Number(countRows[0]?.count) || 0;

    return { data: data as T[], total };
  };

  const getMany = async <T extends BaseRecord = BaseRecord>(
    params: GetManyParams
  ): Promise<GetManyResponse<T>> => {
    const resolvedClient = await resolveClient();
    if (!params.ids.length) return { data: [] };

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = builder.buildSelectQuery(params.resource, {
      filters: [{ field: idColumnName, operator: 'in', value: params.ids }],
    });

    const result = await resolvedClient.query(query);
    const data = deserializeSqlResult(result);

    return { data: data as T[] };
  };

  const create = async <T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>
  ): Promise<CreateResponse<T>> => {
    const resolvedClient = await resolveClient();
    const query = builder.buildInsertQuery(
      params.resource,
      params.variables as any
    );
    const { lastInsertId } = await resolvedClient.execute(query);

    if (lastInsertId === undefined || lastInsertId === null) {
      throw new Error('Create operation failed');
    }

    return findCreatedRecord<T>(
      params.resource,
      params.variables,
      lastInsertId
    );
  };

  const update = async <T extends BaseRecord = BaseRecord>(
    params: UpdateParams
  ): Promise<UpdateResponse<T>> => {
    const resolvedClient = await resolveClient();
    const query = builder.buildUpdateQuery(
      params.resource,
      params.variables as any,
      { field: 'id', value: params.id }
    );

    await resolvedClient.execute(query);
    const result = await getOne<T>(params);
    return { data: result.data as T };
  };

  const deleteOne = async <T extends BaseRecord = BaseRecord>(
    params: DeleteOneParams
  ): Promise<DeleteOneResponse<T>> => {
    const resolvedClient = await resolveClient();
    const result = await getOne<T>(params);

    const idColumnName = params.meta?.idColumnName ?? 'id';
    const query = builder.buildDeleteQuery(params.resource, {
      field: idColumnName,
      value: params.id,
    });

    await resolvedClient.execute(query);
    return { data: result.data as T };
  };

  // 创建一个代理客户端来处理异步初始化
  const proxyClient = new Proxy({} as SqlClient, {
    get(target, prop) {
      if (prop === 'query' || prop === 'execute') {
        return async (...args: any[]) => {
          const resolvedClient = await resolveClient();
          return (resolvedClient as any)[prop](...args);
        };
      }
      return (target as any)[prop];
    },
  });

  return {
    client: proxyClient,

    // 标准 DataProvider 方法
    getList,
    getMany,
    getOne,
    create,
    update,
    deleteOne,
    getApiUrl: () => '',

    // 链式查询
    from: <T extends BaseRecord = BaseRecord>(tableName: string) =>
      new CoreChainQuery<T>(client, tableName),

    // 原生 SQL
    raw: async <T = any>(sql: string, bindings: any[] = []): Promise<T[]> => {
      const resolvedClient = await resolveClient();
      const query = { sql, args: bindings };
      const result = await resolvedClient.query(query);
      return deserializeSqlResult(result) as T[];
    },
  } as CoreDataProvider<TSchema>;
}
