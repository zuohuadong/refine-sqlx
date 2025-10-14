/**
 * Compatibility layer for smooth migration from refine-sqlx to refine-d1
 * Provides refine-sqlx compatible APIs while maintaining refine-d1's performance benefits
 *
 * Key compatibility features:
 * - All WHERE and ORDER BY methods available directly in SqlxChainQuery
 * - Relationship loading (withHasOne, withHasMany, withBelongsTo, withBelongsToMany)
 * - Polymorphic relationships (morphTo)
 * - Batch operations and advanced utilities
 * - Transaction support
 * - Raw SQL execution
 * - Performance monitoring hooks
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient } from './client';
import { SqlxChainQuery } from './chain-query';

/**
 * Extended chain query with refine-sqlx compatibility methods
 * Note: Most deprecated methods (whereEq, whereNe, etc.) are now available directly
 * from the base SqlxChainQuery class and should be used instead of this compatibility layer.
 */
export class CompatibleChainQuery<
  T extends BaseRecord = BaseRecord,
> extends SqlxChainQuery<T> {
  constructor(client: SqlClient, tableName: string) {
    super(client, tableName);
    // No need to initialize compatibility methods - they're now part of the base class
  }

  /**
   * Legacy relationship methods - use base class methods instead
   * These methods are kept for backward compatibility but delegate to the base class
   */
  withHasOne(
    relationName: string,
    relatedTable: string,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return super.withHasOne(relationName, relatedTable, localKey, relatedKey);
  }

  withHasMany(
    relationName: string,
    relatedTable: string,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return super.withHasMany(relationName, relatedTable, localKey, relatedKey);
  }

  withBelongsTo(
    relationName: string,
    relatedTable: string,
    foreignKey?: string,
    relatedKey: string = 'id'
  ): this {
    return super.withBelongsTo(
      relationName,
      relatedTable,
      foreignKey,
      relatedKey
    );
  }

  withBelongsToMany(
    relationName: string,
    relatedTable: string,
    pivotTable: string,
    localKey: string = 'id',
    relatedKey: string = 'id',
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this {
    return super.withBelongsToMany(
      relationName,
      relatedTable,
      pivotTable,
      localKey,
      relatedKey,
      pivotLocalKey,
      pivotRelatedKey
    );
  }

  /**
   * Configure polymorphic relationships
   */
  morphTo(morphField: string, morphTypes: Record<string, string>): this {
    // Add conditions to filter by morph type using the generic where method
    if (morphTypes && Object.keys(morphTypes).length > 0) {
      const typeValues = Object.keys(morphTypes);
      this.where(morphField, 'in', typeValues);
    }
    return this;
  }

  /**
   * Batch processing with chunks (refine-sqlx compatible)
   */
  async *chunk(size: number = 100): AsyncGenerator<T[], void, unknown> {
    if (size <= 0) throw new Error('Chunk size must be greater than 0');
    let offset = 0;
    while (true) {
      const results = await this.clone().offset(offset).limit(size).get();
      if (results.length === 0) break;
      yield results;
      offset += size;
      if (results.length < size) break;
    }
  }

  /**
   * Execute query and apply callback to each result
   */
  async each(
    callback: (record: T, index: number) => void | Promise<void>
  ): Promise<void> {
    const results = await this.get();
    for (let i = 0; i < results.length; i++) {
      await callback(results[i], i);
    }
  }

  /**
   * Execute query and map results
   */
  async map<U>(
    callback: (record: T, index: number) => U | Promise<U>
  ): Promise<U[]> {
    const results = await this.get();
    const mapped: U[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = await callback(results[i], i);
      mapped.push(result);
    }
    return mapped;
  }

  /**
   * Execute query and filter results
   */
  async filter(
    callback: (record: T, index: number) => boolean | Promise<boolean>
  ): Promise<T[]> {
    const results = await this.get();
    const filtered: T[] = [];
    for (let i = 0; i < results.length; i++) {
      const shouldInclude = await callback(results[i], i);
      if (shouldInclude) {
        filtered.push(results[i]);
      }
    }
    return filtered;
  }

  /**
   * Find first record matching condition
   */
  async find(
    callback: (record: T) => boolean | Promise<boolean>
  ): Promise<T | null> {
    const results = await this.get();
    for (const record of results) {
      const matches = await callback(record);
      if (matches) return record;
    }
    return null;
  }

  /**
   * Check if any record matches condition
   */
  async some(
    callback: (record: T) => boolean | Promise<boolean>
  ): Promise<boolean> {
    const results = await this.get();
    for (const record of results) {
      const matches = await callback(record);
      if (matches) return true;
    }
    return false;
  }

  /**
   * Check if all records match condition
   */
  async every(
    callback: (record: T) => boolean | Promise<boolean>
  ): Promise<boolean> {
    const results = await this.get();
    for (const record of results) {
      const matches = await callback(record);
      if (!matches) return false;
    }
    return true;
  }

  /**
   * Get distinct values for a field
   */
  async distinct(field: keyof T): Promise<any[]> {
    const results = await this.get();
    const values = new Set();
    for (const record of results) {
      values.add((record as any)[field]);
    }
    return Array.from(values);
  }

  /**
   * Group results by field value
   */
  async groupBy(field: keyof T): Promise<Record<string, T[]>> {
    const results = await this.get();
    const groups: Record<string, T[]> = {};
    for (const record of results) {
      const key = String((record as any)[field]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }
    return groups;
  }

  /**
   * Get minimum value for a field
   */
  async minBy(field: keyof T): Promise<T | null> {
    const results = await this.get();
    if (results.length === 0) return null;
    return results.reduce((min, current) =>
      (current as any)[field] < (min as any)[field] ? current : min
    );
  }

  /**
   * Get maximum value for a field
   */
  async maxBy(field: keyof T): Promise<T | null> {
    const results = await this.get();
    if (results.length === 0) return null;
    return results.reduce((max, current) =>
      (current as any)[field] > (max as any)[field] ? current : max
    );
  }

  /**
   * Execute query with performance timing
   */
  async timed(): Promise<{ data: T[]; executionTime: number }> {
    const startTime = Date.now();
    const data = await this.get();
    const executionTime = Date.now() - startTime;
    return { data, executionTime };
  }
}

/**
 * Compatibility wrapper for the data provider
 * Adds refine-sqlx compatible methods and behaviors
 */
export function addCompatibilityLayer<
  T extends {
    from: (table: string) => any;
    getOne?: (params: any) => Promise<any>;
  },
>(
  dataProvider: T
): T & {
  // Add refine-sqlx compatible methods
  getWithRelations<TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ): Promise<TRecord>;

  // Batch operations
  createMany<TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>[];
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

  // Advanced utilities
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

  // Raw SQL execution
  raw<TRecord = any>(sql: string, params?: any[]): Promise<TRecord[]>;

  // Transaction support
  transaction<TResult>(callback: (tx: T) => Promise<TResult>): Promise<TResult>;

  // Performance monitoring
  enablePerformanceMonitoring(): void;
  getPerformanceMetrics(): any;
} {
  // Override the from method to return CompatibleChainQuery
  const originalFrom = dataProvider.from.bind(dataProvider);

  (dataProvider as any).from = function (tableName: string) {
    const originalQuery = originalFrom(tableName);

    // Create compatible query that extends the original
    const compatibleQuery = new CompatibleChainQuery(
      originalQuery.client,
      tableName
    );

    // Copy any existing state from original query
    if (originalQuery.filters) {
      (compatibleQuery as any).filters = [...originalQuery.filters];
    }
    if (originalQuery.sorters) {
      (compatibleQuery as any).sorters = [...originalQuery.sorters];
    }

    return compatibleQuery;
  };

  // Add getWithRelations method
  (dataProvider as any).getWithRelations = async function <
    TRecord = BaseRecord,
  >(resource: string, id: any, relations: string[] = []): Promise<TRecord> {
    // Get the base record
    const record = await (dataProvider as any).getOne({ resource, id });

    if (!record.data || relations.length === 0) {
      return record.data;
    }

    // Load each relationship
    const result = { ...record.data };

    for (const _relationName of relations) {
      try {
        // Simple relationship loading - in practice this would be more sophisticated
        const relatedQuery = dataProvider.from(
          getRelatedTableName(_relationName)
        );
        const relatedData = await relatedQuery
          .where(getForeignKey(resource, _relationName), 'eq', id)
          .get();

        (result as any)[_relationName] = relatedData;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Failed to load relationship ${_relationName}:`, error);
        }
        (result as any)[_relationName] = [];
      }
    }

    return result as TRecord;
  };

  // Add batch operations
  (dataProvider as any).createMany = async function <
    TRecord = BaseRecord,
  >(params: {
    resource: string;
    variables: Record<string, any>[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> {
    const batchSize = params.batchSize || 100;
    const results: TRecord[] = [];

    for (let i = 0; i < params.variables.length; i += batchSize) {
      const batch = params.variables.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(variables =>
          (dataProvider as any).create({ resource: params.resource, variables })
        )
      );
      results.push(...batchResults.map((r: any) => r.data));
    }

    return { data: results };
  };

  (dataProvider as any).updateMany = async function <
    TRecord = BaseRecord,
  >(params: {
    resource: string;
    ids: any[];
    variables: Record<string, any>;
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> {
    const batchSize = params.batchSize || 50;
    const results: TRecord[] = [];

    for (let i = 0; i < params.ids.length; i += batchSize) {
      const batch = params.ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id =>
          (dataProvider as any).update({
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

  (dataProvider as any).deleteMany = async function <
    TRecord = BaseRecord,
  >(params: {
    resource: string;
    ids: any[];
    batchSize?: number;
  }): Promise<{ data: TRecord[] }> {
    const batchSize = params.batchSize || 50;
    const results: TRecord[] = [];

    for (let i = 0; i < params.ids.length; i += batchSize) {
      const batch = params.ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id =>
          (dataProvider as any).deleteOne({ resource: params.resource, id })
        )
      );
      results.push(...batchResults.map((r: any) => r.data));
    }

    return { data: results };
  };

  // Add advanced utilities
  (dataProvider as any).upsert = async function <TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>;
    conflictColumns?: string[];
  }): Promise<{ data: TRecord; created: boolean }> {
    const conflictColumn = params.conflictColumns?.[0] || 'id';
    const conflictValue = params.variables[conflictColumn];

    if (conflictValue) {
      try {
        const existing = await (dataProvider as any).getOne({
          resource: params.resource,
          id: conflictValue,
        });
        if (existing?.data) {
          const updated = await (dataProvider as any).update({
            resource: params.resource,
            id: conflictValue,
            variables: params.variables,
          });
          return { data: updated.data, created: false };
        }
      } catch {
        // Record doesn't exist, continue to create
      }
    }

    const created = await (dataProvider as any).create({
      resource: params.resource,
      variables: params.variables,
    });
    return { data: created.data, created: true };
  };

  (dataProvider as any).firstOrCreate = async function <
    TRecord = BaseRecord,
  >(params: {
    resource: string;
    where: Record<string, any>;
    defaults?: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }> {
    const filters = Object.entries(params.where).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const existing = await (dataProvider as any).getList({
      resource: params.resource,
      filters,
      pagination: { current: 1, pageSize: 1, mode: 'server' },
    });

    if (existing.data.length > 0) {
      return { data: existing.data[0], created: false };
    }

    const createData = { ...params.where, ...params.defaults };
    const created = await (dataProvider as any).create({
      resource: params.resource,
      variables: createData,
    });

    return { data: created.data, created: true };
  };

  (dataProvider as any).updateOrCreate = async function <
    TRecord = BaseRecord,
  >(params: {
    resource: string;
    where: Record<string, any>;
    values: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }> {
    const filters = Object.entries(params.where).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const existing = await (dataProvider as any).getList({
      resource: params.resource,
      filters,
      pagination: { current: 1, pageSize: 1, mode: 'server' },
    });

    if (existing.data.length > 0) {
      const updated = await (dataProvider as any).update({
        resource: params.resource,
        id: existing.data[0].id,
        variables: params.values,
      });
      return { data: updated.data, created: false };
    }

    const createData = { ...params.where, ...params.values };
    const created = await (dataProvider as any).create({
      resource: params.resource,
      variables: createData,
    });

    return { data: created.data, created: true };
  };

  // Add raw SQL execution
  (dataProvider as any).raw = async function <TRecord = any>(
    sql: string,
    params?: any[]
  ): Promise<TRecord[]> {
    if ((dataProvider as any).raw) {
      return (dataProvider as any).raw(sql, params);
    }
    throw new Error('Raw SQL execution not supported by this provider');
  };

  // Add transaction support
  (dataProvider as any).transaction = async function <TResult>(
    callback: (tx: T) => Promise<TResult>
  ): Promise<TResult> {
    if ((dataProvider as any).beginTransaction) {
      await (dataProvider as any).beginTransaction();
      try {
        const result = await callback(dataProvider as T);
        await (dataProvider as any).commitTransaction();
        return result;
      } catch (error) {
        await (dataProvider as any).rollbackTransaction();
        throw error;
      }
    } else {
      // If transactions not supported, execute directly
      return callback(dataProvider as T);
    }
  };

  // Add performance monitoring
  let performanceEnabled = false;
  const performanceMetrics: any[] = [];

  (dataProvider as any).enablePerformanceMonitoring = function (): void {
    performanceEnabled = true;

    // Wrap methods with performance tracking
    const methodsToTrack = [
      'getList',
      'getOne',
      'create',
      'update',
      'deleteOne',
    ];
    methodsToTrack.forEach(methodName => {
      const originalMethod = (dataProvider as any)[methodName];
      (dataProvider as any)[methodName] = async function (...args: any[]) {
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

  (dataProvider as any).getPerformanceMetrics = function (): any {
    return {
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
    };
  };

  return dataProvider as any;
}

/**
 * Helper functions for relationship loading
 */
function getRelatedTableName(relationName: string): string {
  // Simple pluralization - in practice this would be more sophisticated
  return relationName.endsWith('s') ? relationName : `${relationName}s`;
}

function getForeignKey(resource: string, _relationName: string): string {
  // Simple foreign key generation - in practice this would be configurable
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  return `${singular}_id`;
}

/**
 * Type definitions for compatibility
 */
export interface CompatibleDataProvider {
  // Standard refine methods
  getList: (params: any) => Promise<any>;
  getOne: (params: any) => Promise<any>;
  create: (params: any) => Promise<any>;
  update: (params: any) => Promise<any>;
  deleteOne: (params: any) => Promise<any>;

  // Chain query methods
  from: (table: string) => CompatibleChainQuery;

  // Compatibility methods
  getWithRelations: <TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ) => Promise<TRecord>;
}
