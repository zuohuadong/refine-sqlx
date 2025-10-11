import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
  test,
} from './test-utils.js';
import { SqlTransformer } from 'refine-core-utils';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

describe('SqlTransformer.sortingToSql', () => {
  const transformer = new SqlTransformer();

  it('should return empty string for empty array', () => {
    const result = transformer.sortingToSql([]);
    expect(result).toBe('');
  });

  it('should handle single sort field', () => {
    const sort: CrudSorting = [{ field: 'name', order: 'asc' }];
    const result = transformer.sortingToSql(sort);
    expect(result).toBe('ORDER BY name ASC');
  });

  it('should handle multiple sort fields', () => {
    const sort: CrudSorting = [
      { field: 'name', order: 'asc' },
      { field: 'created_at', order: 'desc' },
    ];
    const result = transformer.sortingToSql(sort);
    expect(result).toBe('ORDER BY name ASC, created_at DESC');
  });

  it('should convert order to uppercase', () => {
    const sort: CrudSorting = [
      { field: 'name', order: 'asc' },
      { field: 'age', order: 'desc' },
    ];
    const result = transformer.sortingToSql(sort);
    expect(result).toBe('ORDER BY name ASC, age DESC');
  });
});

describe('SqlTransformer.transformFilters', () => {
  const transformer = new SqlTransformer();

  it('should return empty result for empty array', () => {
    const result = transformer.transformFilters([]);
    expect(result).toEqual({ sql: '', args: [] });
  });

  it('should handle eq operator', () => {
    const filters: CrudFilters = [
      { field: 'name', operator: 'eq', value: 'John' },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({ sql: 'WHERE name = ?', args: ['John'] });
  });

  it('should handle multiple filters', () => {
    const filters: CrudFilters = [
      { field: 'name', operator: 'eq', value: 'John' },
      { field: 'age', operator: 'gte', value: 18 },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({
      sql: 'WHERE name = ? AND age >= ?',
      args: ['John', 18],
    });
  });

  it('should handle in operator', () => {
    const filters: CrudFilters = [
      { field: 'status', operator: 'in', value: ['active', 'pending'] },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({
      sql: 'WHERE status IN (?, ?)',
      args: ['active', 'pending'],
    });
  });

  it('should handle contains operator', () => {
    const filters: CrudFilters = [
      { field: 'name', operator: 'contains', value: 'John' },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({ sql: 'WHERE name LIKE ?', args: ['%John%'] });
  });

  it('should handle null operator', () => {
    const filters: CrudFilters = [
      { field: 'deleted_at', operator: 'null', value: void 0 },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({ sql: 'WHERE deleted_at IS NULL', args: [] });
  });

  it('should handle between operator', () => {
    const filters: CrudFilters = [
      { field: 'age', operator: 'between', value: [18, 65] },
    ];
    const result = transformer.transformFilters(filters);
    expect(result).toEqual({
      sql: 'WHERE age BETWEEN ? AND ?',
      args: [18, 65],
    });
  });
});
