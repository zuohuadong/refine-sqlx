import type { CrudFilters, CrudSorting } from '@refinedev/core';

export function createCrudSorting(sort: CrudSorting) {
  if (!sort.length) return void 0;

  return sort
    .map(({ field, order }) => `${field} ${order.toUpperCase()}`)
    .join(' ');
}

export function createCrudFilters(filters: CrudFilters) {}
