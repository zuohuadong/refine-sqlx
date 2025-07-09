import type { CrudOperators } from '@refinedev/core';

export const opersAlise: Partial<Record<CrudOperators, string>> = {
  contains: 'LIKE',
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  nin: 'NOT IN',
  ne: 'IS NOT',
  nbetween: 'NOT BETWEEN',
  ncontains: 'NOT LIKE',
  nendswith: 'NOT LIKE',
  nstartswith: 'NOT LIKE',
  nina: 'NOT IN',
  nnull: 'IS NOT NULL',
  null: 'IS NULL',
};
