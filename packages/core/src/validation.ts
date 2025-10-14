import type { CrudFilters, Pagination } from '@refinedev/core';
import type { ValidationError, FilterOperator } from './types.js';

/**
 * Validate filter value based on operator requirements
 */
export function validateFilterValue(
  operator: FilterOperator,
  value: any,
  field?: string
): ValidationError | null {
  switch (operator) {
    case 'between':
    case 'nbetween':
      if (!Array.isArray(value) || value.length !== 2) {
        return {
          field,
          operator,
          value,
          message: `${operator} operator requires an array with exactly 2 values`,
        };
      }
      break;

    case 'in':
    case 'nin':
    case 'ina':
    case 'nina':
      if (!Array.isArray(value) || value.length === 0) {
        return {
          ...(field !== undefined && { field }),
          ...(operator !== undefined && { operator }),
          ...(value !== undefined && { value }),
          message: `${operator} operator requires a non-empty array`,
        };
      }
      break;

    case 'null':
    case 'nnull':
      // These operators don't need values
      break;

    default:
      if (value === undefined || value === null) {
        return {
          ...(field !== undefined && { field }),
          ...(operator !== undefined && { operator }),
          ...(value !== undefined && { value }),
          message: `${operator} operator requires a non-null value`,
        };
      }
      break;
  }

  return null;
}

/**
 * Validate field name
 */
export function validateFieldName(field: string): ValidationError | null {
  if (!field || typeof field !== 'string') {
    return { field, message: 'Field name must be a non-empty string' };
  }

  // Check for SQL injection patterns
  if (/[;'"\\]/.test(field)) {
    return { field, message: 'Field name contains invalid characters' };
  }

  return null;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  pagination?: Pagination
): ValidationError | null {
  if (!pagination) return null;

  const { currentPage, pageSize } = pagination;

  if (
    currentPage !== undefined &&
    (typeof currentPage !== 'number' || currentPage < 1)
  ) {
    return { message: 'Current page must be a positive number' };
  }

  if (
    pageSize !== undefined &&
    (typeof pageSize !== 'number' || pageSize < 1)
  ) {
    return { message: 'Page size must be a positive number' };
  }

  if (pageSize !== undefined && pageSize > 1000) {
    return { message: 'Page size cannot exceed 1000 records' };
  }

  return null;
}

/**
 * Validate entire filter structure
 */
export function validateFilters(filters: CrudFilters): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const filter of filters) {
    if ('field' in filter) {
      // Simple filter
      const fieldError = validateFieldName(filter.field);
      if (fieldError) {
        errors.push(fieldError);
        continue;
      }

      const valueError = validateFilterValue(
        filter.operator as FilterOperator,
        filter.value,
        filter.field
      );
      if (valueError) {
        errors.push(valueError);
      }
    } else if ('operator' in filter && filter.operator in ['and', 'or']) {
      // Logical filter
      if (!Array.isArray(filter.value) || filter.value.length === 0) {
        errors.push({
          operator: filter.operator,
          message: `${filter.operator} operator requires a non-empty array of filters`,
        });
      } else {
        // Recursively validate nested filters
        const nestedErrors = validateFilters(filter.value);
        errors.push(...nestedErrors);
      }
    } else {
      errors.push({ message: 'Invalid filter structure' });
    }
  }

  return errors;
}

/**
 * Sanitize string values to prevent SQL injection
 */
export function sanitizeStringValue(value: string): string {
  if (typeof value !== 'string') return value;

  // Remove or escape potentially dangerous characters
  return value.replace(/['"\\;]/g, '');
}

/**
 * Check if operator is supported
 */
export function isSupportedOperator(
  operator: string
): operator is FilterOperator {
  const supportedOperators: FilterOperator[] = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'ncontains',
    'containss',
    'ncontainss',
    'startswith',
    'nstartswith',
    'startswiths',
    'nstartswiths',
    'endswith',
    'nendswith',
    'endswiths',
    'nendswiths',
    'null',
    'nnull',
    'in',
    'nin',
    'ina',
    'nina',
    'between',
    'nbetween',
  ];

  return supportedOperators.includes(operator as FilterOperator);
}

/**
 * Normalize filter operator (handle aliases)
 */
export function normalizeOperator(operator: string): FilterOperator {
  const operatorMap: Record<string, FilterOperator> = {
    ina: 'in',
    nina: 'nin',
  };

  return (
    (operatorMap[operator] as FilterOperator) || (operator as FilterOperator)
  );
}
