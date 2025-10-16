/**
 * v0.5.0 - Aggregations Executor
 *
 * Handles aggregation queries (count, sum, avg, min, max, group by)
 */

import type { BaseRecord, CrudFilter, GetListParams } from '@refinedev/core';
import { and, avg, between, count, eq, gt, gte, lt, lte, max, min, ne, notBetween, or, sql, sum, type SQL } from 'drizzle-orm';
import type { AggregationsConfig } from '../../config';
import { filtersToWhere } from '../../filters';
import type { FeatureExecutor } from '../index';

/**
 * Aggregation function specification
 */
export interface AggregateFunction {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string; // Required for sum, avg, min, max
  alias?: string; // Optional alias for result
}

/**
 * HAVING clause operators (similar to CrudOperators but for aggregates)
 */
export type HavingOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'between' | 'nbetween';

/**
 * HAVING clause condition
 * Filters aggregate results after GROUP BY
 */
export interface HavingCondition {
  /**
   * Aggregate field alias to filter on
   * Must match an alias from AggregateFunction
   * @example 'total' (for count with alias 'total')
   * @example 'revenue' (for sum with alias 'revenue')
   */
  field: string;

  /**
   * Comparison operator
   */
  operator: HavingOperator;

  /**
   * Value to compare against
   */
  value: any;
}

/**
 * Logical HAVING condition (AND/OR)
 */
export interface HavingLogical {
  operator: 'and' | 'or';
  conditions: (HavingCondition | HavingLogical)[];
}

/**
 * Aggregation query parameters
 */
export interface AggregateParams {
  resource: string;
  functions: AggregateFunction[];
  filters?: CrudFilter[];
  groupBy?: string[];
  having?: (HavingCondition | HavingLogical)[];
}

/**
 * Aggregation response
 */
export interface AggregateResponse<T = any> {
  data: T[];
}

/**
 * Aggregations executor
 */
export class AggregationsExecutor implements FeatureExecutor {
  readonly name = 'aggregations';
  readonly enabled: boolean;

  private readonly allowedFunctions: Set<string>;
  private readonly havingEnabled: boolean;

  constructor(
    private db: any,
    private schema: Record<string, unknown>,
    private config: AggregationsConfig,
  ) {
    this.enabled = config.enabled;
    this.allowedFunctions = new Set(
      config.functions ?? ['count', 'sum', 'avg', 'min', 'max', 'group'],
    );
    this.havingEnabled = config.having ?? true;
  }

  /**
   * Initialize aggregations executor
   */
  async initialize(): Promise<void> {
    // No initialization needed
  }

  /**
   * Enhance getList query with aggregations
   */
  async enhanceGetList<T extends BaseRecord>(
    params: GetListParams,
    baseQuery: any,
  ): Promise<any> {
    if (!this.enabled) return baseQuery;

    // Check if aggregations are requested
    const aggregate = params.meta?.aggregate;
    if (!aggregate) return baseQuery;

    // TODO: Apply aggregations to base query
    // This requires modifying the SELECT clause
    // For now, return base query

    return baseQuery;
  }

  /**
   * Execute standalone aggregation query
   *
   * @example
   * ```typescript
   * const result = await aggregationsExecutor.aggregate({
   *   resource: 'orders',
   *   functions: [
   *     { type: 'count', alias: 'total' },
   *     { type: 'sum', field: 'amount', alias: 'revenue' }
   *   ],
   *   groupBy: ['status']
   * });
   * ```
   */
  async aggregate<T extends BaseRecord = BaseRecord>(
    params: AggregateParams,
  ): Promise<AggregateResponse<T>> {
    if (!this.enabled) {
      throw new Error('[refine-sqlx] Aggregations are not enabled');
    }

    const table = this.schema[params.resource];
    if (!table) {
      throw new Error(`[refine-sqlx] Table '${params.resource}' not found`);
    }

    // Build aggregation functions and GROUP BY fields
    const aggregates = this.buildAggregates(
      table as any,
      params.functions,
      params.groupBy,
    );

    // Start query with aggregations
    let query = this.db.select(aggregates).from(table);

    // Apply filters
    if (params.filters) {
      const where = filtersToWhere(params.filters, table as any);
      if (where) {
        query = query.where(where);
      }
    }

    // Apply GROUP BY
    if (params.groupBy && params.groupBy.length > 0) {
      const groupByColumns = params.groupBy.map(
        (field) => (table as any)[field],
      );
      query = query.groupBy(...groupByColumns);
    }

    // Apply HAVING clause
    if (params.having && this.havingEnabled) {
      const havingCondition = this.havingToCondition(params.having, aggregates);
      if (havingCondition) {
        query = query.having(havingCondition);
      }
    }

    // Execute query
    const results = await query;

    return { data: results as T[] };
  }

  /**
   * Build aggregation functions object
   */
  private buildAggregates(
    table: any,
    functions: AggregateFunction[],
    groupBy?: string[],
  ): any {
    const aggregates: Record<string, any> = {};

    // Add GROUP BY fields first (they must be in SELECT when using GROUP BY)
    if (groupBy && groupBy.length > 0) {
      for (const field of groupBy) {
        aggregates[field] = table[field];
      }
    }

    // Add aggregation functions
    for (const func of functions) {
      // Validate function is allowed
      this.validateFunction(func.type);

      const alias = func.alias ?? `${func.type}_${func.field ?? 'all'}`;

      switch (func.type) {
        case 'count':
          aggregates[alias] = count();
          break;

        case 'sum':
          if (!func.field) {
            throw new Error('[refine-sqlx] sum() requires a field');
          }
          aggregates[alias] = sum(table[func.field]);
          break;

        case 'avg':
          if (!func.field) {
            throw new Error('[refine-sqlx] avg() requires a field');
          }
          aggregates[alias] = avg(table[func.field]);
          break;

        case 'min':
          if (!func.field) {
            throw new Error('[refine-sqlx] min() requires a field');
          }
          aggregates[alias] = min(table[func.field]);
          break;

        case 'max':
          if (!func.field) {
            throw new Error('[refine-sqlx] max() requires a field');
          }
          aggregates[alias] = max(table[func.field]);
          break;
      }
    }

    return aggregates;
  }

  /**
   * Validate aggregation function is allowed
   */
  private validateFunction(type: string): void {
    if (!this.allowedFunctions.has(type)) {
      throw new Error(
        `[refine-sqlx] Aggregation function '${type}' is not enabled. ` +
          `Allowed functions: ${Array.from(this.allowedFunctions).join(', ')}`,
      );
    }
  }

  /**
   * Convert HAVING conditions to Drizzle SQL conditions
   *
   * HAVING clause filters aggregate results after GROUP BY.
   * Unlike WHERE (which filters rows before aggregation), HAVING filters
   * on the computed aggregate values.
   *
   * @param having - Array of HAVING conditions
   * @param aggregates - Map of aggregate aliases to their SQL expressions
   * @returns SQL condition for HAVING clause, or undefined if no conditions
   *
   * @example
   * ```typescript
   * // Filter groups with count > 10
   * having: [{ field: 'total', operator: 'gt', value: 10 }]
   *
   * // Multiple conditions
   * having: [
   *   { field: 'total', operator: 'gt', value: 10 },
   *   { field: 'revenue', operator: 'gte', value: 1000 }
   * ]
   * ```
   */
  private havingToCondition(
    having: (HavingCondition | HavingLogical)[] | undefined,
    aggregates: Record<string, any>,
  ): SQL | undefined {
    if (!having || having.length === 0) {
      return undefined;
    }

    const conditions: SQL[] = [];

    for (const condition of having) {
      // Handle logical operators (AND/OR)
      if ('conditions' in condition) {
        const nestedConditions: SQL[] = [];

        for (const nested of condition.conditions) {
          if ('field' in nested) {
            // Simple condition
            const condSql = this.buildHavingCondition(nested, aggregates);
            if (condSql) nestedConditions.push(condSql);
          } else if ('conditions' in nested) {
            // Nested logical condition (recursive)
            const recursiveSql = this.havingToCondition([nested], aggregates);
            if (recursiveSql) nestedConditions.push(recursiveSql);
          }
        }

        if (nestedConditions.length > 0) {
          if (condition.operator === 'or') {
            conditions.push(or(...nestedConditions)!);
          } else {
            conditions.push(and(...nestedConditions)!);
          }
        }
      } else if ('field' in condition) {
        // Simple condition
        const condSql = this.buildHavingCondition(condition, aggregates);
        if (condSql) conditions.push(condSql);
      }
    }

    if (conditions.length === 0) {
      return undefined;
    }

    // Combine all conditions with AND
    return and(...conditions);
  }

  /**
   * Build a single HAVING condition
   */
  private buildHavingCondition(
    condition: HavingCondition,
    aggregates: Record<string, any>,
  ): SQL | undefined {
    // Get the aggregate expression by alias
    const aggregateExpr = aggregates[condition.field];

    if (!aggregateExpr) {
      throw new Error(
        `[refine-sqlx] HAVING clause references unknown aggregate alias '${condition.field}'. ` +
          `Available aliases: ${Object.keys(aggregates).join(', ')}`,
      );
    }

    // Build SQL condition based on operator
    switch (condition.operator) {
      case 'eq':
        return eq(aggregateExpr, condition.value);

      case 'ne':
        return ne(aggregateExpr, condition.value);

      case 'lt':
        return lt(aggregateExpr, condition.value);

      case 'lte':
        return lte(aggregateExpr, condition.value);

      case 'gt':
        return gt(aggregateExpr, condition.value);

      case 'gte':
        return gte(aggregateExpr, condition.value);

      case 'between':
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          throw new Error(
            '[refine-sqlx] HAVING between operator requires an array of two values',
          );
        }
        return between(aggregateExpr, condition.value[0], condition.value[1]);

      case 'nbetween':
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          throw new Error(
            '[refine-sqlx] HAVING nbetween operator requires an array of two values',
          );
        }
        return notBetween(aggregateExpr, condition.value[0], condition.value[1]);

      default:
        throw new Error(
          `[refine-sqlx] Unsupported HAVING operator: ${condition.operator}`,
        );
    }
  }
}
