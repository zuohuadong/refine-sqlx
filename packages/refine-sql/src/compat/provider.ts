/**
 * 兼容性数据提供器
 * 基于核心提供器，添加 refine-orm 兼容功能
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient } from '../client';
import type { TableSchema } from '../typed-methods';
import type { SQLiteOptions } from '../types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';

import { createCoreProvider, type CoreDataProvider } from '../core/provider';
import { CompatChainQuery } from './chain-query';

/**
 * 兼容性数据提供器接口
 */
export interface CompatDataProvider<TSchema extends TableSchema = TableSchema>
  extends Omit<
    CoreDataProvider<TSchema>,
    'from' | 'createMany' | 'updateMany' | 'deleteMany'
  > {
  // Schema 访问 (refine-orm 风格)
  schema: TSchema;

  // 兼容性链式查询
  from<T extends BaseRecord = BaseRecord>(
    tableName: string
  ): CompatChainQuery<T>;

  // 批量操作
  createMany<
    TRecord = BaseRecord,
    TVariables extends Record<string, any> = Record<string, any>,
  >(params: {
    resource: string;
    variables: TVariables[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }>;

  updateMany<TRecord = BaseRecord>(params: {
    resource: string;
    ids: any[];
    variables: Record<string, any>;
    batchSize?: number;
  }): Promise<{ data: TRecord[] }>;

  deleteMany<TRecord = BaseRecord>(params: {
    resource: string;
    ids: any[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }>;

  // 高级工具
  upsert<TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>;
    conflictColumns?: string[];
  }): Promise<{ data: TRecord; created: boolean }>;

  firstOrCreate<TRecord = BaseRecord>(params: {
    resource: string;
    where: Record<string, any>;
    defaults?: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }>;

  updateOrCreate<TRecord = BaseRecord>(params: {
    resource: string;
    where: Record<string, any>;
    values: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }>;

  // 关系查询
  getWithRelations<TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ): Promise<TRecord>;

  // 事务支持
  transaction<TResult>(
    callback: (tx: CompatDataProvider<TSchema>) => Promise<TResult>
  ): Promise<TResult>;

  // 性能监控
  enablePerformanceMonitoring(): void;
  getPerformanceMetrics(): {
    enabled: boolean;
    metrics: any[];
    summary: {
      totalQueries: number;
      averageDuration: number;
      successRate: number;
    };
  };
}

/**
 * 兼容性提供器配置
 */
export interface CompatProviderConfig<
  TSchema extends TableSchema = TableSchema,
> {
  connection:
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database;
  schema: TSchema;
  options?: SQLiteOptions & {
    enablePerformanceMonitoring?: boolean;
    debug?: boolean;
  };
}

/**
 * 创建 SQLite 兼容性提供器
 */
export function createSQLiteProvider<TSchema extends TableSchema = TableSchema>(
  config: CompatProviderConfig<TSchema>
): CompatDataProvider<TSchema> {
  // 创建核心提供器
  const coreProvider = createCoreProvider<TSchema>(
    config.connection,
    config.options
  );

  // 性能监控
  let performanceEnabled = false;
  const performanceMetrics: any[] = [];

  // 批量操作实现
  const createMany = async <TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> => {
    const batchSize = params.batchSize || 100;
    const results: TRecord[] = [];

    for (let i = 0; i < params.variables.length; i += batchSize) {
      const batch = params.variables.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(variables =>
          coreProvider.create({ resource: params.resource, variables })
        )
      );
      results.push(...batchResults.map((r: any) => r.data));
    }

    return { data: results };
  };

  const updateMany = async <TRecord = BaseRecord>(params: {
    resource: string;
    ids: any[];
    variables: Record<string, any>;
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> => {
    const batchSize = params.batchSize || 50;
    const results: TRecord[] = [];

    for (let i = 0; i < params.ids.length; i += batchSize) {
      const batch = params.ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id =>
          coreProvider.update({
            resource: params.resource,
            id,
            variables: params.variables,
          })
        )
      );
      results.push(...batchResults.map((r: any) => r.data));
    }

    return { data: results };
  };

  const deleteMany = async <TRecord = BaseRecord>(params: {
    resource: string;
    ids: any[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> => {
    const batchSize = params.batchSize || 50;
    const results: TRecord[] = [];

    for (let i = 0; i < params.ids.length; i += batchSize) {
      const batch = params.ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id =>
          coreProvider.deleteOne({ resource: params.resource, id })
        )
      );
      results.push(...batchResults.map((r: any) => r.data));
    }

    return { data: results };
  };

  // 高级工具实现
  const upsert = async <TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>;
    conflictColumns?: string[];
  }): Promise<{ data: TRecord; created: boolean }> => {
    const conflictColumn = params.conflictColumns?.[0] || 'id';
    const conflictValue = params.variables[conflictColumn];

    if (conflictValue) {
      try {
        const existing = await coreProvider.getOne({
          resource: params.resource,
          id: conflictValue,
        });
        if (existing?.data) {
          const updated = await coreProvider.update({
            resource: params.resource,
            id: conflictValue,
            variables: params.variables,
          });
          return { data: updated.data as TRecord, created: false };
        }
      } catch {
        // 记录不存在，继续创建
      }
    }

    const created = await coreProvider.create({
      resource: params.resource,
      variables: params.variables,
    });
    return { data: created.data as TRecord, created: true };
  };

  const firstOrCreate = async <TRecord = BaseRecord>(params: {
    resource: string;
    where: Record<string, any>;
    defaults?: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }> => {
    const filters = Object.entries(params.where).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const existing = await coreProvider.getList({
      resource: params.resource,
      filters,
      pagination: { currentPage: 1, pageSize: 1, mode: 'server' },
    });

    if (existing.data.length > 0) {
      return { data: existing.data[0] as TRecord, created: false };
    }

    const createData = { ...params.where, ...params.defaults };
    const created = await coreProvider.create({
      resource: params.resource,
      variables: createData,
    });

    return { data: created.data as TRecord, created: true };
  };

  const updateOrCreate = async <TRecord = BaseRecord>(params: {
    resource: string;
    where: Record<string, any>;
    values: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }> => {
    const filters = Object.entries(params.where).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const existing = await coreProvider.getList({
      resource: params.resource,
      filters,
      pagination: { currentPage: 1, pageSize: 1, mode: 'server' },
    });

    if (existing.data.length > 0) {
      const existingRecord = existing.data[0];
      if (existingRecord.id !== undefined) {
        const updated = await coreProvider.update({
          resource: params.resource,
          id: existingRecord.id,
          variables: params.values,
        });
        return { data: updated.data as TRecord, created: false };
      }
    }

    const createData = { ...params.where, ...params.values };
    const created = await coreProvider.create({
      resource: params.resource,
      variables: createData,
    });

    return { data: created.data as TRecord, created: true };
  };

  // 关系查询实现（简化版）
  const getWithRelations = async <TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ): Promise<TRecord> => {
    const baseRecord = await coreProvider.getOne({ resource, id });

    if (!relations?.length) return baseRecord.data as TRecord;

    // 简化的关系加载
    const recordWithRelations = { ...baseRecord.data } as any;

    await Promise.allSettled(
      relations.map(async relation => {
        try {
          if (relation.endsWith('s')) {
            // hasMany 关系
            const foreignKey = `${resource.slice(0, -1)}_id`;
            const relatedRecords = await coreProvider.getList({
              resource: relation,
              filters: [{ field: foreignKey, operator: 'eq', value: id }],
              pagination: { currentPage: 1, pageSize: 1000, mode: 'server' },
            });
            recordWithRelations[relation] = relatedRecords.data;
          } else {
            // belongsTo 关系
            const foreignKeyValue = (baseRecord.data as any)[`${relation}_id`];
            if (foreignKeyValue) {
              const relatedRecord = await coreProvider.getOne({
                resource: `${relation}s`,
                id: foreignKeyValue,
              });
              recordWithRelations[relation] = relatedRecord.data;
            } else {
              recordWithRelations[relation] = null;
            }
          }
        } catch {
          recordWithRelations[relation] = null;
        }
      })
    );

    return recordWithRelations as TRecord;
  };

  // 事务支持
  const transaction = async <TResult>(
    callback: (tx: CompatDataProvider<TSchema>) => Promise<TResult>
  ): Promise<TResult> => {
    // 简化实现：直接执行，不支持真正的事务
    console.warn('Transaction support is simplified in compat module');
    return callback(compatProvider);
  };

  // 性能监控
  const enablePerformanceMonitoring = (): void => {
    performanceEnabled = true;

    // 包装方法以进行性能跟踪
    const methodsToTrack = [
      'getList',
      'getOne',
      'create',
      'update',
      'deleteOne',
    ];
    methodsToTrack.forEach(methodName => {
      const originalMethod = (coreProvider as any)[methodName];
      (coreProvider as any)[methodName] = async function (...args: any[]) {
        const startTime = Date.now();
        try {
          const result = await originalMethod.apply(this, args);
          const endTime = Date.now();
          performanceMetrics.push({
            method: methodName,
            duration: endTime - startTime,
            timestamp: new Date().toISOString(),
            success: true,
          });
          return result;
        } catch (error) {
          const endTime = Date.now();
          performanceMetrics.push({
            method: methodName,
            duration: endTime - startTime,
            timestamp: new Date().toISOString(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      };
    });
  };

  const getPerformanceMetrics = () => ({
    enabled: performanceEnabled,
    metrics: performanceMetrics,
    summary: {
      totalQueries: performanceMetrics.length,
      averageDuration:
        performanceMetrics.length > 0 ?
          performanceMetrics.reduce((sum, m) => sum + m.duration, 0) /
          performanceMetrics.length
        : 0,
      successRate:
        performanceMetrics.length > 0 ?
          performanceMetrics.filter(m => m.success).length /
          performanceMetrics.length
        : 0,
    },
  });

  // 创建兼容性提供器
  const compatProvider: CompatDataProvider<TSchema> = {
    ...coreProvider,

    // Schema 访问
    schema: config.schema,

    // 重写 from 方法返回兼容性查询构建器
    from: <T extends BaseRecord = BaseRecord>(tableName: string) =>
      new CompatChainQuery<T>(coreProvider.client as SqlClient, tableName),

    // 批量操作
    createMany,
    updateMany,
    deleteMany,

    // 高级工具
    upsert,
    firstOrCreate,
    updateOrCreate,

    // 关系查询
    getWithRelations,

    // 事务支持
    transaction,

    // 性能监控
    enablePerformanceMonitoring,
    getPerformanceMetrics,
  };

  // 自动启用性能监控（如果配置）
  if (config.options?.enablePerformanceMonitoring) {
    compatProvider.enablePerformanceMonitoring();
  }

  // 调试日志
  if (config.options?.debug) {
    console.log(
      '[refine-sql/compat] SQLite provider created with refine-orm compatibility'
    );
    console.log(
      '[refine-sql/compat] Schema tables:',
      Object.keys(config.schema)
    );
  }

  return compatProvider;
}
