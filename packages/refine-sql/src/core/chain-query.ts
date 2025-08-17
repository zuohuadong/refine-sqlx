/**
 * 核心链式查询构建器 - 简化版
 * 只包含基础查询功能，移除高级特性
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient, SqlQuery } from '../client';
import { LightweightSqlBuilder } from './sql-builder';
import { deserializeSqlResult } from '../utils';

export type FilterOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'contains' | 'startswith' | 'endswith'
  | 'null' | 'nnull' | 'between' | 'nbetween';

/**
 * 核心链式查询构建器
 */
export class CoreChainQuery<T extends BaseRecord = BaseRecord> {
  private filters: Array<{ field: string; operator: FilterOperator; value: any }> = [];
  private sorters: Array<{ field: string; order: 'asc' | 'desc' }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private builder: LightweightSqlBuilder;

  constructor(
    protected client: SqlClient,
    protected tableName: string
  ) {
    this.builder = new LightweightSqlBuilder();
  }

  /**
   * 添加 WHERE 条件
   */
  where(field: string, operator: FilterOperator, value: any): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * 添加 ORDER BY 条件
   */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sorters.push({ field, order: direction });
    return this;
  }

  /**
   * 设置 LIMIT
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * 设置 OFFSET
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * 设置分页
   */
  paginate(page: number, pageSize: number = 10): this {
    this.limitValue = pageSize;
    this.offsetValue = (page - 1) * pageSize;
    return this;
  }

  /**
   * 执行查询并返回结果
   */
  async get(): Promise<T[]> {
    const query = this.buildQuery();
    const result = await this.client.query(query);
    return deserializeSqlResult(result) as T[];
  }

  /**
   * 获取第一条记录
   */
  async first(): Promise<T | null> {
    const originalLimit = this.limitValue;
    this.limit(1);
    
    const results = await this.get();
    
    // 恢复原始 limit
    this.limitValue = originalLimit;
    
    return results[0] || null;
  }

  /**
   * 获取记录数量
   */
  async count(): Promise<number> {
    const query = this.builder.buildCountQuery(this.tableName, this.filters as any);
    const result = await this.client.query(query);
    const rows = deserializeSqlResult(result);
    return Number(rows[0]?.count) || 0;
  }

  /**
   * 检查是否存在匹配的记录
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * 克隆查询构建器
   */
  clone(): CoreChainQuery<T> {
    const cloned = new CoreChainQuery<T>(this.client, this.tableName);
    cloned.filters = [...this.filters];
    cloned.sorters = [...this.sorters];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    return cloned;
  }

  /**
   * 构建最终查询
   */
  private buildQuery(): SqlQuery {
    const pagination = this.limitValue || this.offsetValue ? {
      current: this.offsetValue ? Math.floor(this.offsetValue / (this.limitValue || 10)) + 1 : 1,
      pageSize: this.limitValue || 10,
      mode: 'server' as const,
    } : undefined;

    return this.builder.buildSelectQuery(this.tableName, {
      filters: this.filters.length > 0 ? this.filters as any : undefined,
      sorting: this.sorters.length > 0 ? this.sorters as any : undefined,
      pagination,
    });
  }
}