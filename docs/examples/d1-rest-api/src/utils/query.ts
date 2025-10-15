import type { CrudFilter, CrudSort, Pagination } from '@refinedev/core';

export function parsePagination(params: URLSearchParams): Pagination {
  const page = parseInt(params.get('page') || '1');
  const pageSize = parseInt(params.get('pageSize') || '10');

  return {
    current: page,
    pageSize: Math.min(pageSize, 100), // Max 100 items per page
  };
}

export function parseFilters(params: URLSearchParams): CrudFilter[] {
  const filters: CrudFilter[] = [];

  for (const [key, value] of params.entries()) {
    // Skip pagination and sorting params
    if (['page', 'pageSize', 'sort'].includes(key)) continue;

    // Handle operator suffix (e.g., name_contains, age_gte)
    const parts = key.split('_');
    const operator = parts.length > 1 ? parts.pop() : 'eq';
    const field = parts.join('_');

    // Map common operators
    const operatorMap: Record<string, string> = {
      eq: 'eq',
      ne: 'ne',
      lt: 'lt',
      lte: 'lte',
      gt: 'gt',
      gte: 'gte',
      contains: 'contains',
      startswith: 'startswith',
      endswith: 'endswith',
      in: 'in',
    };

    const refinOperator = operatorMap[operator || 'eq'] || 'eq';

    filters.push({
      field: field || key,
      operator: refinOperator as any,
      value: refinOperator === 'in' ? value.split(',') : value,
    });
  }

  return filters;
}

export function parseSorters(params: URLSearchParams): CrudSort[] {
  const sortParam = params.get('sort');
  if (!sortParam) return [];

  const sorters: CrudSort[] = [];

  // Support multiple sorts: ?sort=-createdAt,name
  const sortFields = sortParam.split(',');

  for (const field of sortFields) {
    const trimmed = field.trim();
    if (trimmed.startsWith('-')) {
      sorters.push({
        field: trimmed.substring(1),
        order: 'desc',
      });
    } else {
      sorters.push({
        field: trimmed,
        order: 'asc',
      });
    }
  }

  return sorters;
}
