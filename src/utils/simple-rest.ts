/**
 * Simple REST parameter conversion utilities
 *
 * Converts simple-rest style query parameters to Refine DataProvider format
 */

import type { CrudFilters, CrudSorting } from '@refinedev/core';

type LogicalOperator = 'and' | 'or';

type LogicalFilterOperator = Exclude<import('@refinedev/core').CrudOperators, LogicalOperator>;

/**
 * Simple REST query parameters
 */
export interface SimpleRestQuery {
  _start?: number | string;
  _end?: number | string;
  _page?: number | string;
  _perPage?: number | string;
  _sort?: string;
  _order?: 'asc' | 'desc' | 'ASC' | 'DESC';
  _fields?: string;
  _embed?: string;
  [key: string]: unknown;
}

/**
 * Converted Refine parameters
 */
export interface ConvertedParams {
  pagination: {
    current: number;
    pageSize: number;
    mode?: 'off' | 'server' | 'client';
  };
  sorters: CrudSorting;
  filters: CrudFilters;
  meta?: {
    select?: string[];
    include?: string[];
  };
}

/**
 * Convert simple-rest style parameters to Refine DataProvider format
 *
 * @param query - Query parameters from simple-rest style request
 * @returns Converted parameters for Refine DataProvider
 *
 * @example
 * ```typescript
 * // From URL: /posts?_start=0&_end=10&_sort=title&_order=asc
 * const { pagination, sorters, filters } = convertSimpleRestParams(query);
 * // pagination: { current: 1, pageSize: 10 }
 * // sorters: [{ field: 'title', order: 'asc' }]
 *
 * // Use with dataProvider
 * const result = await dataProvider.getList({
 *   resource: 'posts',
 *   ...pagination,
 *   sorters,
 *   filters,
 * });
 * ```
 */
export function convertSimpleRestParams(query: SimpleRestQuery): ConvertedParams {
  const pagination = convertPagination(query);
  const sorters = convertSorters(query);
  const { filters, meta } = convertFiltersAndMeta(query);

  return { pagination, sorters, filters, meta };
}

/**
 * Convert pagination parameters
 *
 * Supports two formats:
 * - _start/_end: offset-based pagination
 * - _page/_perPage: page-based pagination
 */
function convertPagination(query: SimpleRestQuery): ConvertedParams['pagination'] {
  if (query._start !== undefined && query._end !== undefined) {
    const start = Number(query._start);
    const end = Number(query._end);
    const pageSize = end - start;
    const current = Math.floor(start / pageSize) + 1;

    return { current, pageSize };
  }

  if (query._page !== undefined && query._perPage !== undefined) {
    return {
      current: Number(query._page),
      pageSize: Number(query._perPage),
    };
  }

  return { current: 1, pageSize: 10 };
}

/**
 * Convert sort parameters
 */
function convertSorters(query: SimpleRestQuery): CrudSorting {
  if (!query._sort) {
    return [];
  }

  const order = (query._order?.toLowerCase() as 'asc' | 'desc') || 'asc';
  const sortFields = String(query._sort).split(',');

  return sortFields.map((field) => ({
    field: field.trim(),
    order,
  }));
}

/**
 * Convert filter parameters and meta options
 *
 * Filter format: field_operator=value
 * Examples:
 * - title=hello → { field: 'title', operator: 'eq', value: 'hello' }
 * - title_contains=hello → { field: 'title', operator: 'contains', value: 'hello' }
 * - status_in=active,pending → { field: 'status', operator: 'in', value: ['active', 'pending'] }
 */
function convertFiltersAndMeta(
  query: SimpleRestQuery,
): { filters: CrudFilters; meta?: ConvertedParams['meta'] } {
  const filters: CrudFilters = [];
  const select: string[] = [];
  const include: string[] = [];

  const reservedKeys = [
    '_start',
    '_end',
    '_page',
    '_perPage',
    '_sort',
    '_order',
    '_fields',
    '_embed',
  ];

  for (const [key, value] of Object.entries(query)) {
    if (reservedKeys.includes(key)) {
      continue;
    }

    if (key === '_fields' && typeof value === 'string') {
      select.push(...value.split(',').map((f) => f.trim()));
      continue;
    }

    if (key === '_embed' && typeof value === 'string') {
      include.push(...value.split(',').map((f) => f.trim()));
      continue;
    }

    const filter = parseFilter(key, value);
    if (filter) {
      filters.push(filter);
    }
  }

  const meta: ConvertedParams['meta'] | undefined =
    select.length > 0 || include.length > 0
      ? {
          ...(select.length > 0 && { select }),
          ...(include.length > 0 && { include }),
        }
      : undefined;

  return { filters, meta };
}

/**
 * Parse a single filter parameter
 */
function parseFilter(
  key: string,
  value: unknown,
): { field: string; operator: LogicalFilterOperator; value: unknown } | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const operatorPatterns: [RegExp, LogicalFilterOperator, (v: unknown) => unknown][] = [
    [/_neq$/i, 'ne', (v) => v],
    [/_ne$/i, 'ne', (v) => v],
    [/_gt$/i, 'gt', (v) => Number(v)],
    [/_gte$/i, 'gte', (v) => Number(v)],
    [/_lt$/i, 'lt', (v) => Number(v)],
    [/_lte$/i, 'lte', (v) => Number(v)],
    [/_contains$/i, 'contains', (v) => String(v)],
    [/_containss$/i, 'containss', (v) => String(v)],
    [/_ncontains$/i, 'ncontains', (v) => String(v)],
    [/_startswith$/i, 'startswith', (v) => String(v)],
    [/_nstartswith$/i, 'nstartswith', (v) => String(v)],
    [/_endswith$/i, 'endswith', (v) => String(v)],
    [/_nendswith$/i, 'nendswith', (v) => String(v)],
    [/_in$/i, 'in', parseArrayValue],
    [/_nin$/i, 'nin', parseArrayValue],
    [/_null$/i, 'null', () => true],
    [/_nnull$/i, 'nnull', () => true],
    [/_between$/i, 'between', parseArrayValue],
    [/_nbetween$/i, 'nbetween', parseArrayValue],
  ];

  for (const [pattern, operator, transform] of operatorPatterns) {
    if (pattern.test(key)) {
      const field = key.replace(pattern, '');
      return {
        field,
        operator,
        value: transform(value),
      };
    }
  }

  return {
    field: key,
    operator: 'eq',
    value,
  };
}

/**
 * Parse array value from comma-separated string
 */
function parseArrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim());
  }
  return [value];
}

/**
 * Convert Refine parameters back to simple-rest format
 *
 * Useful for generating URLs or query strings
 *
 * @param params - Refine DataProvider parameters
 * @returns Simple-rest style query parameters
 */
export function toSimpleRestParams(params: {
  pagination?: { current?: number; pageSize?: number };
  sorters?: CrudSorting;
  filters?: CrudFilters;
}): SimpleRestQuery {
  const query: SimpleRestQuery = {};

  if (params.pagination) {
    const { current = 1, pageSize = 10 } = params.pagination;
    const start = (current - 1) * pageSize;
    const end = start + pageSize;
    query._start = start;
    query._end = end;
  }

  if (params.sorters && params.sorters.length > 0) {
    query._sort = params.sorters.map((s) => s.field).join(',');
    query._order = params.sorters[0].order;
  }

  if (params.filters) {
    for (const filter of params.filters) {
      if ('field' in filter) {
        const key = filter.operator === 'eq' ? filter.field : `${filter.field}_${filter.operator}`;
        query[key] = Array.isArray(filter.value) ? filter.value.join(',') : filter.value;
      }
    }
  }

  return query;
}
