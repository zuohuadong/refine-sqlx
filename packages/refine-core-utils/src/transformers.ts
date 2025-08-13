import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type {
  FilterTransformResult,
  SortingTransformResult,
  PaginationTransformResult,
  TransformationContext,
  OperatorConfig,
  LogicalOperatorConfig,
} from './types.js';
import { SqlFilterTransformer, GenericFilterTransformer } from './filters.js';
import { SqlSortingTransformer, GenericSortingTransformer } from './sorting.js';
import {
  SqlPaginationTransformer,
  GenericPaginationTransformer,
} from './pagination.js';

/**
 * SQL query result interface
 */
export interface SqlQuery {
  sql: string;
  args: any[];
}

/**
 * Complete SQL transformer for refine-sqlx
 */
export class SqlTransformer {
  private filterTransformer: SqlFilterTransformer;
  private sortingTransformer: SqlSortingTransformer;
  private paginationTransformer: SqlPaginationTransformer;

  constructor() {
    this.filterTransformer = new SqlFilterTransformer();
    this.sortingTransformer = new SqlSortingTransformer();
    this.paginationTransformer = new SqlPaginationTransformer();
  }

  /**
   * Transform filters to SQL WHERE clause
   */
  transformFilters(
    filters?: CrudFilters,
    context?: TransformationContext
  ): SqlQuery | undefined {
    if (!filters || filters.length === 0) {
      return undefined;
    }

    const result = this.filterTransformer.transformFilters(filters, context);
    if (result.isEmpty) {
      return undefined;
    }

    return { sql: result.result, args: result.params || [] };
  }

  /**
   * Transform sorting to SQL ORDER BY clause
   */
  transformSorting(
    sorting?: CrudSorting,
    context?: TransformationContext
  ): SqlQuery | undefined {
    if (!sorting || sorting.length === 0) {
      return undefined;
    }

    const result = this.sortingTransformer.transform(sorting, context);
    if (result.isEmpty) {
      return undefined;
    }

    return { sql: result.result, args: [] };
  }

  /**
   * Transform pagination to SQL LIMIT/OFFSET clause
   */
  transformPagination(pagination?: Pagination): SqlQuery | undefined {
    const result = this.paginationTransformer.transform(pagination);
    if (result.isEmpty) {
      return undefined;
    }

    return { sql: result.result, args: result.params || [] };
  }

  /**
   * Build complete SELECT query
   */
  buildSelectQuery(
    table: string,
    options: {
      filters?: CrudFilters;
      sorting?: CrudSorting;
      pagination?: Pagination;
      context?: TransformationContext;
    } = {}
  ): SqlQuery {
    const { filters, sorting, pagination, context } = options;

    const sqlParts: string[] = ['SELECT * FROM', table];
    const allArgs: any[] = [];

    // Add WHERE clause
    const whereClause = this.transformFilters(filters, context);
    if (whereClause) {
      sqlParts.push('WHERE', whereClause.sql);
      allArgs.push(...whereClause.args);
    }

    // Add ORDER BY clause
    const orderClause = this.transformSorting(sorting, context);
    if (orderClause) {
      sqlParts.push('ORDER BY', orderClause.sql);
    }

    // Add LIMIT/OFFSET clause
    const limitClause = this.transformPagination(pagination);
    if (limitClause) {
      sqlParts.push(limitClause.sql);
      allArgs.push(...limitClause.args);
    }

    return { sql: sqlParts.join(' '), args: allArgs };
  }

  /**
   * Build INSERT query
   */
  buildInsertQuery<T extends Record<string, any>>(
    table: string,
    data: T
  ): SqlQuery {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ');

    return {
      sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
      args: Object.values(data),
    };
  }

  /**
   * Build UPDATE query
   */
  buildUpdateQuery<T extends Record<string, any>>(
    table: string,
    data: T,
    filters: CrudFilters,
    context?: TransformationContext
  ): SqlQuery {
    const columns = Object.keys(data);
    const placeholders = columns.map(key => `${key} = ?`).join(', ');
    const whereClause = this.transformFilters(filters, context);

    if (!whereClause) {
      throw new Error('UPDATE query requires WHERE conditions');
    }

    return {
      sql: `UPDATE ${table} SET ${placeholders} WHERE ${whereClause.sql}`,
      args: [...Object.values(data), ...whereClause.args],
    };
  }

  /**
   * Build DELETE query
   */
  buildDeleteQuery(
    table: string,
    filters: CrudFilters,
    context?: TransformationContext
  ): SqlQuery {
    const whereClause = this.transformFilters(filters, context);

    if (!whereClause) {
      throw new Error('DELETE query requires WHERE conditions');
    }

    return {
      sql: `DELETE FROM ${table} WHERE ${whereClause.sql}`,
      args: whereClause.args,
    };
  }

  /**
   * Build COUNT query
   */
  buildCountQuery(
    table: string,
    filters?: CrudFilters,
    context?: TransformationContext
  ): SqlQuery {
    const sqlParts: string[] = ['SELECT COUNT(*) FROM', table];
    const allArgs: any[] = [];

    const whereClause = this.transformFilters(filters, context);
    if (whereClause) {
      sqlParts.push('WHERE', whereClause.sql);
      allArgs.push(...whereClause.args);
    }

    return { sql: sqlParts.join(' '), args: allArgs };
  }
}

/**
 * Generic transformer for Drizzle ORM and other systems
 */
export class DrizzleTransformer<T> {
  private filterTransformer: GenericFilterTransformer<T>;
  private sortingTransformer: GenericSortingTransformer<T>;
  private paginationTransformer: GenericPaginationTransformer<T>;

  constructor(
    filterOperators: OperatorConfig<T>[],
    logicalOperators: LogicalOperatorConfig<T>[],
    sortingTransformer: (
      field: string,
      order: 'asc' | 'desc',
      context?: TransformationContext
    ) => T,
    sortingCombiner: (sortItems: T[]) => T,
    paginationTransformer: (limit?: number, offset?: number) => T
  ) {
    this.filterTransformer = new GenericFilterTransformer(
      filterOperators,
      logicalOperators
    );
    this.sortingTransformer = new GenericSortingTransformer(
      sortingTransformer,
      sortingCombiner
    );
    this.paginationTransformer = new GenericPaginationTransformer(
      paginationTransformer
    );
  }

  transformFilters(
    filters?: CrudFilters,
    context?: TransformationContext
  ): FilterTransformResult<T> {
    if (!filters || filters.length === 0) {
      throw new Error('No filters provided');
    }

    return this.filterTransformer.transformFilters(filters, context);
  }

  transformSorting(
    sorting?: CrudSorting,
    context?: TransformationContext
  ): SortingTransformResult<T> {
    return this.sortingTransformer.transform(sorting, context);
  }

  transformPagination(pagination?: Pagination): PaginationTransformResult<T> {
    return this.paginationTransformer.transform(pagination);
  }
}

/**
 * Factory function to create SQL transformer
 */
export function createSqlTransformer(): SqlTransformer {
  return new SqlTransformer();
}

/**
 * Factory function to create Drizzle transformer
 */
export function createDrizzleTransformer<T>(
  filterOperators: OperatorConfig<T>[],
  logicalOperators: LogicalOperatorConfig<T>[],
  sortingTransformer: (
    field: string,
    order: 'asc' | 'desc',
    context?: TransformationContext
  ) => T,
  sortingCombiner: (sortItems: T[]) => T,
  paginationTransformer: (limit?: number, offset?: number) => T
): DrizzleTransformer<T> {
  return new DrizzleTransformer(
    filterOperators,
    logicalOperators,
    sortingTransformer,
    sortingCombiner,
    paginationTransformer
  );
}
