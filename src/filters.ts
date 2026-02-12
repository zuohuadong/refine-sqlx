import type { CrudFilters, CrudOperators } from '@refinedev/core';
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notBetween,
  notInArray,
  notLike,
  or,
  sql,
  type Column,
  type SQL,
} from 'drizzle-orm';

/**
 * Convert Refine filters to Drizzle WHERE conditions
 * Supports SQLite, MySQL, and PostgreSQL columns
 */
export function filtersToWhere<T extends Record<string, Column>>(
  filters: CrudFilters | undefined,
  columns: T,
): SQL | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }

  const conditions: SQL[] = [];

  for (const filter of filters) {
    // Handle logical operators (OR/AND with nested filters)
    if (
      'operator' in filter &&
      (filter.operator === 'or' || filter.operator === 'and')
    ) {
      if (!Array.isArray(filter.value)) {
        continue;
      }

      // Recursively process nested filters
      const nestedConditions = filter.value
        .filter((f): f is any => 'field' in f && 'operator' in f)
        .map((f) => {
          const column = columns[f.field as keyof T];
          if (!column) {
            throw new Error(`Column "${String(f.field)}" not found in schema`);
          }
          return filterToCondition(column, f.operator, f.value);
        });

      if (nestedConditions.length > 0) {
        if (filter.operator === 'or') {
          conditions.push(or(...nestedConditions)!);
        } else {
          conditions.push(and(...nestedConditions)!);
        }
      }
    } else if ('field' in filter && 'operator' in filter) {
      // Handle regular field filters
      const column = columns[filter.field as keyof T];
      if (!column) {
        throw new Error(`Column "${String(filter.field)}" not found in schema`);
      }

      conditions.push(filterToCondition(column, filter.operator, filter.value));
    }
  }

  if (conditions.length === 0) {
    return undefined;
  }

  // Combine all conditions with AND
  return and(...conditions);
}

/**
 * Convert a single filter to a Drizzle condition
 */
function filterToCondition(
  column: Column,
  operator: CrudOperators,
  value: any,
): SQL {
  switch (operator) {
    case 'eq':
      return eq(column, value);

    case 'ne':
      return ne(column, value);

    case 'lt':
      return lt(column, value);

    case 'lte':
      return lte(column, value);

    case 'gt':
      return gt(column, value);

    case 'gte':
      return gte(column, value);

    case 'in':
      return inArray(column, Array.isArray(value) ? value : [value]);

    case 'nin':
      return notInArray(column, Array.isArray(value) ? value : [value]);

    case 'contains':
      // case-insensitive (SQLite LIKE is case-insensitive by default)
      return like(column, `%${value}%`);

    case 'containss':
      // case-sensitive: use GLOB for SQLite, LIKE BINARY for MySQL
      return sql`${column} GLOB ${'*' + value + '*'}`;

    case 'ncontains':
      return notLike(column, `%${value}%`);

    case 'ncontainss':
      return not(sql`${column} GLOB ${'*' + value + '*'}`);

    case 'startswith':
      return like(column, `${value}%`);

    case 'nstartswith':
      return notLike(column, `${value}%`);

    case 'endswith':
      return like(column, `%${value}`);

    case 'nendswith':
      return notLike(column, `%${value}`);

    case 'null':
      return value ? isNull(column) : isNotNull(column);

    case 'nnull':
      return value ? isNotNull(column) : isNull(column);

    case 'between':
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('Between operator requires an array of two values');
      }
      return between(column, value[0], value[1]);

    case 'nbetween':
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error('Between operator requires an array of two values');
      }
      return notBetween(column, value[0], value[1]);

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Convert Refine sorters to Drizzle ORDER BY clauses
 */
export function sortersToOrderBy<T extends Record<string, Column>>(
  sorters: Array<{ field: string; order: 'asc' | 'desc' }> | undefined,
  columns: T,
): SQL[] {
  if (!sorters || sorters.length === 0) {
    return [];
  }

  return sorters.map((sorter) => {
    const column = columns[sorter.field as keyof T];
    if (!column) {
      throw new Error(`Column "${sorter.field}" not found in schema`);
    }

    if (sorter.order === 'desc') {
      return desc(column);
    }

    return asc(column);
  });
}

/**
 * Calculate pagination offset and limit
 */
export function calculatePagination(pagination: {
  current?: number;
  currentPage?: number;
  pageSize?: number;
  mode?: 'off' | 'server' | 'client';
}): { offset: number; limit: number } {
  // Handle pagination mode
  if (pagination?.mode === 'off' || pagination?.mode === 'client') {
    // No server-side pagination — fetch all
    return { offset: 0, limit: Number.MAX_SAFE_INTEGER };
  }

  const current = pagination?.current ?? pagination?.currentPage ?? 1;
  const pageSize = pagination?.pageSize ?? 10;

  return { offset: (current - 1) * pageSize, limit: pageSize };
}
