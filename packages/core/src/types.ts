import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';

// Base interfaces for parameter transformation
export interface TransformResult<T> {
  result: T;
  params?: any[];
}

export interface FilterTransformResult<T> extends TransformResult<T> {
  isEmpty: boolean;
}

export interface SortingTransformResult<T> extends TransformResult<T> {
  isEmpty: boolean;
}

export interface PaginationTransformResult<T> extends TransformResult<T> {
  limit?: number;
  offset?: number;
  isEmpty: boolean;
}

// Abstract transformer interface
export abstract class BaseParameterTransformer<TFilter, TSorting, TPagination> {
  abstract transformFilter(
    filter: CrudFilters[0]
  ): FilterTransformResult<TFilter>;
  abstract transformFilters(
    filters: CrudFilters
  ): FilterTransformResult<TFilter>;
  abstract transformSorting(
    sorting: CrudSorting
  ): SortingTransformResult<TSorting>;
  abstract transformPagination(
    pagination?: Pagination
  ): PaginationTransformResult<TPagination>;
}

// Common validation and utility functions
export interface ValidationError {
  field?: string;
  operator?: string;
  value?: any;
  message: string;
}

export interface TransformationContext {
  tableName?: string;
  fieldMapping?: Record<string, string>;
  customOperators?: Record<string, (field: string, value: any) => any>;
}

// Operator mapping types
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'ncontains'
  | 'containss'
  | 'ncontainss'
  | 'startswith'
  | 'nstartswith'
  | 'startswiths'
  | 'nstartswiths'
  | 'endswith'
  | 'nendswith'
  | 'endswiths'
  | 'nendswiths'
  | 'null'
  | 'nnull'
  | 'in'
  | 'nin'
  | 'ina'
  | 'nina'
  | 'between'
  | 'nbetween';

export type LogicalOperator = 'and' | 'or';

export interface OperatorConfig<T> {
  operator: FilterOperator;
  transform: (field: string, value: any, context?: TransformationContext) => T;
  validate?: (value: any) => ValidationError | null;
}

export interface LogicalOperatorConfig<T> {
  operator: LogicalOperator;
  combine: (conditions: T[]) => T;
}
