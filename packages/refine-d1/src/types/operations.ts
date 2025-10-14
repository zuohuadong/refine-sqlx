// Modern operation types for refine-d1
import type { BaseRecord } from '@refinedev/core';

/**
 * Simplified query builder interface
 */
export interface QueryBuilder<T extends BaseRecord = BaseRecord> {
  // Core methods
  where(field: string, operator: string, value: any): this;
  orderBy(column: string, direction?: 'asc' | 'desc'): this;
  limit(count: number): this;
  offset(count: number): this;

  // Aggregation
  count(): Promise<number>;
  sum(column: string): Promise<number>;
  avg(column: string): Promise<number>;

  // Execution methods
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  exists(): Promise<boolean>;

  // Utility methods
  clone(): QueryBuilder<T>;
}

/**
 * Batch operation result
 */
export interface BatchResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
