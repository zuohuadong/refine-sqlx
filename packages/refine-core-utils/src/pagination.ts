import type { Pagination } from '@refinedev/core';
import type { PaginationTransformResult } from './types.js';

/**
 * Calculate pagination offset and limit
 */
export function calculatePagination(pagination?: Pagination): {
  limit?: number;
  offset?: number;
  current: number;
  pageSize: number;
} {
  if (!pagination || pagination.mode === 'off') {
    return { current: 1, pageSize: 10 };
  }

  const { currentPage = 1, pageSize = 10 } = pagination;
  const current = currentPage;
  const limit = pageSize;
  const offset = (current - 1) * pageSize;

  return { limit, offset, current, pageSize };
}

/**
 * SQL pagination transformer
 */
export class SqlPaginationTransformer {
  transform(pagination?: Pagination): PaginationTransformResult<string> {
    const calc = calculatePagination(pagination);

    if (!calc.limit) {
      return { result: '', isEmpty: true, limit: undefined, offset: undefined };
    }

    return {
      result: `LIMIT ? OFFSET ?`,
      params: [calc.limit, calc.offset],
      isEmpty: false,
      limit: calc.limit,
      offset: calc.offset,
    };
  }
}

/**
 * Generic pagination transformer for other systems
 */
export class GenericPaginationTransformer<T> {
  constructor(private transformer: (limit?: number, offset?: number) => T) {}

  transform(pagination?: Pagination): PaginationTransformResult<T> {
    const calc = calculatePagination(pagination);

    return {
      result: this.transformer(calc.limit, calc.offset),
      isEmpty: !calc.limit,
      limit: calc.limit,
      offset: calc.offset,
    };
  }
}
