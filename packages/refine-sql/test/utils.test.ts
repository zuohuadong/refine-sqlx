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

  describe('basic operators', () => {
    it('should handle eq operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE name = ?', args: ['John'] });
    });

    it('should handle ne operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ne', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE name != ?', args: ['John'] });
    });

    it('should handle lt operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'lt', value: 30 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE age < ?', args: [30] });
    });

    it('should handle gt operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'gt', value: 18 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE age > ?', args: [18] });
    });

    it('should handle lte operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'lte', value: 65 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE age <= ?', args: [65] });
    });

    it('should handle gte operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'gte', value: 18 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE age >= ?', args: [18] });
    });
  });

  describe('array operators', () => {
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

    it('should handle ina operator', () => {
      const filters: CrudFilters = [
        { field: 'id', operator: 'ina', value: [1, 2, 3] },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE id IN (?, ?, ?)', args: [1, 2, 3] });
    });

    it('should handle nin operator', () => {
      const filters: CrudFilters = [
        { field: 'status', operator: 'nin', value: ['deleted', 'archived'] },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE status NOT IN (?, ?)',
        args: ['deleted', 'archived'],
      });
    });

    it('should handle nina operator', () => {
      const filters: CrudFilters = [
        { field: 'id', operator: 'nina', value: [1, 2] },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE id NOT IN (?, ?)', args: [1, 2] });
    });
  });

  describe('string operators', () => {
    it('should handle contains operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'contains', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE name LIKE ?', args: ['%John%'] });
    });

    it('should handle ncontains operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ncontains', value: 'spam' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE name NOT LIKE ?',
        args: ['%spam%'],
      });
    });

    it('should handle containss operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'containss', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(name) LIKE LOWER(?)',
        args: ['%John%'],
      });
    });

    it('should handle ncontainss operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ncontainss', value: 'spam' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(name) NOT LIKE LOWER(?)',
        args: ['%spam%'],
      });
    });
  });

  describe('null operators', () => {
    it('should handle null operator', () => {
      const filters: CrudFilters = [
        { field: 'deleted_at', operator: 'null', value: void 0 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE deleted_at IS NULL', args: [] });
    });

    it('should handle nnull operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nnull', value: void 0 },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE email IS NOT NULL', args: [] });
    });
  });

  describe('startswith operators', () => {
    it('should handle startswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'startswith', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE name LIKE ?', args: ['John%'] });
    });

    it('should handle nstartswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'nstartswith', value: 'spam' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({ sql: 'WHERE name NOT LIKE ?', args: ['spam%'] });
    });

    it('should handle startswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'startswiths', value: 'John' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(name) LIKE LOWER(?)',
        args: ['John%'],
      });
    });

    it('should handle nstartswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'nstartswiths', value: 'spam' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(name) NOT LIKE LOWER(?)',
        args: ['spam%'],
      });
    });
  });

  describe('endswith operators', () => {
    it('should handle endswith operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'endswith', value: '@example.com' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE email LIKE ?',
        args: ['%@example.com'],
      });
    });

    it('should handle nendswith operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nendswith', value: '@spam.com' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE email NOT LIKE ?',
        args: ['%@spam.com'],
      });
    });

    it('should handle endswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'endswiths', value: '@Example.com' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(email) LIKE LOWER(?)',
        args: ['%@Example.com'],
      });
    });

    it('should handle nendswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nendswiths', value: '@Spam.com' },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE LOWER(email) NOT LIKE LOWER(?)',
        args: ['%@Spam.com'],
      });
    });
  });

  describe('between operators', () => {
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

    it('should handle nbetween operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'nbetween', value: [0, 17] },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE age NOT BETWEEN ? AND ?',
        args: [0, 17],
      });
    });
  });

  describe('multiple filters', () => {
    it('should handle multiple filters', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
        { field: 'age', operator: 'gte', value: 18 },
        { field: 'status', operator: 'in', value: ['active', 'pending'] },
      ];
      const result = transformer.transformFilters(filters);
      expect(result).toEqual({
        sql: 'WHERE name = ? AND age >= ? AND status IN (?, ?)',
        args: ['John', 18, 'active', 'pending'],
      });
    });
  });
});
