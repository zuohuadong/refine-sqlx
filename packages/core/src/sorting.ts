import type { CrudSorting } from '@refinedev/core';
import type { SortingTransformResult, TransformationContext } from './types.js';
import { validateFieldName } from './validation.js';

/**
 * SQL sorting transformer
 */
export class SqlSortingTransformer {
  transform(
    sorting?: CrudSorting,
    context?: TransformationContext
  ): SortingTransformResult<string> {
    if (!sorting || sorting.length === 0) {
      return { result: '', isEmpty: true };
    }

    const sortClauses: string[] = [];

    for (const sorter of sorting) {
      const { field, order } = sorter;

      // Validate field name
      const fieldError = validateFieldName(field);
      if (fieldError) {
        throw new Error(`Invalid sort field: ${fieldError.message}`);
      }

      // Apply field mapping if provided
      const actualField = context?.fieldMapping?.[field] ?? field;

      // Quote field name to prevent SQL injection
      const quotedField = `"${actualField}"`;
      const direction = order.toUpperCase();

      sortClauses.push(`${quotedField} ${direction}`);
    }

    return { result: sortClauses.join(', '), isEmpty: false };
  }
}

/**
 * Generic sorting transformer
 */
export class GenericSortingTransformer<T> {
  constructor(
    private fieldTransformer: (
      field: string,
      order: 'asc' | 'desc',
      context?: TransformationContext
    ) => T,
    private combiner: (sortItems: T[]) => T
  ) {}

  transform(
    sorting?: CrudSorting,
    context?: TransformationContext
  ): SortingTransformResult<T> {
    if (!sorting || sorting.length === 0) {
      return { result: this.combiner([]), isEmpty: true };
    }

    const sortItems: T[] = [];

    for (const sorter of sorting) {
      const { field, order } = sorter;

      // Validate field name
      const fieldError = validateFieldName(field);
      if (fieldError) {
        throw new Error(`Invalid sort field: ${fieldError.message}`);
      }

      const sortItem = this.fieldTransformer(field, order, context);
      sortItems.push(sortItem);
    }

    return { result: this.combiner(sortItems), isEmpty: false };
  }
}
