/**
 * 兼容性链式查询构建器
 * 基于核心查询构建器，添加 refine-orm 兼容功能
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient } from '../client';
import { CoreChainQuery } from '../core/chain-query';

/**
 * 兼容性链式查询构建器
 */
export class CompatChainQuery<
  T extends BaseRecord = BaseRecord,
> extends CoreChainQuery<T> {
  constructor(client: SqlClient, tableName: string) {
    super(client, tableName);
  }

  /**
   * 关系查询配置
   */
  withHasOne(
    relationName: string,
    relatedTable: string,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    // 简化实现：存储关系配置但不实际加载
    // 完整实现需要关系加载逻辑
    console.warn(
      `withHasOne(${relationName}) is not fully implemented in core module`
    );
    return this;
  }

  withHasMany(
    relationName: string,
    relatedTable: string,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    console.warn(
      `withHasMany(${relationName}) is not fully implemented in core module`
    );
    return this;
  }

  withBelongsTo(
    relationName: string,
    relatedTable: string,
    foreignKey?: string,
    relatedKey: string = 'id'
  ): this {
    console.warn(
      `withBelongsTo(${relationName}) is not fully implemented in core module`
    );
    return this;
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
    console.warn(
      `withBelongsToMany(${relationName}) is not fully implemented in core module`
    );
    return this;
  }

  /**
   * 多态关系
   */
  morphTo(morphField: string, morphTypes: Record<string, string>): this {
    if (morphTypes && Object.keys(morphTypes).length > 0) {
      const typeValues = Object.keys(morphTypes);
      this.where(morphField, 'in', typeValues);
    }
    return this;
  }

  /**
   * 批处理方法
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
   * 映射结果
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
   * 过滤结果
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
   * 查找第一个匹配的记录
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
   * 检查是否有记录匹配条件
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
   * 检查是否所有记录都匹配条件
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
   * 获取字段的唯一值
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
   * 按字段值分组
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
   * 获取字段最小值对应的记录
   */
  async minBy(field: keyof T): Promise<T | null> {
    const results = await this.get();
    if (results.length === 0) return null;
    return results.reduce((min, current) =>
      (current as any)[field] < (min as any)[field] ? current : min
    );
  }

  /**
   * 获取字段最大值对应的记录
   */
  async maxBy(field: keyof T): Promise<T | null> {
    const results = await this.get();
    if (results.length === 0) return null;
    return results.reduce((max, current) =>
      (current as any)[field] > (max as any)[field] ? current : max
    );
  }

  /**
   * 执行查询并返回执行时间
   */
  async timed(): Promise<{ data: T[]; executionTime: number }> {
    const startTime = Date.now();
    const data = await this.get();
    const executionTime = Date.now() - startTime;
    return { data, executionTime };
  }
}
