import { createCrudFilters, createCrudSorting } from '../src/utils';
import { describe, it, expect } from 'vitest';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

describe('createCrudSorting', () => {
  it('should return undefined for empty array', () => {
    const result = createCrudSorting([]);
    expect(result).toBeUndefined();
  });

  it('should handle single sort field', () => {
    const sort: CrudSorting = [{ field: 'name', order: 'asc' }];
    const result = createCrudSorting(sort);
    expect(result).toBe('name ASC');
  });

  it('should handle multiple sort fields', () => {
    const sort: CrudSorting = [
      { field: 'name', order: 'asc' },
      { field: 'created_at', order: 'desc' },
    ];
    const result = createCrudSorting(sort);
    expect(result).toBe('name ASC, created_at DESC');
  });

  it('should convert order to uppercase', () => {
    const sort: CrudSorting = [
      { field: 'name', order: 'asc' },
      { field: 'age', order: 'desc' },
    ];
    const result = createCrudSorting(sort);
    expect(result).toBe('name ASC, age DESC');
  });
});

describe('createCrudFilters', () => {
  it('should return undefined for empty array', () => {
    const result = createCrudFilters([]);
    expect(result).toBeUndefined();
  });

  describe('LogicalFilter operators', () => {
    it('should handle eq operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" = ?', values: ['John'] });
    });

    it('should handle ne operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ne', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" != ?', values: ['John'] });
    });

    it('should handle lt operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'lt', value: 30 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"age" < ?', values: [30] });
    });

    it('should handle gt operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'gt', value: 18 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"age" > ?', values: [18] });
    });

    it('should handle lte operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'lte', value: 65 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"age" <= ?', values: [65] });
    });

    it('should handle gte operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'gte', value: 18 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"age" >= ?', values: [18] });
    });

    it('should handle in operator', () => {
      const filters: CrudFilters = [
        { field: 'status', operator: 'in', value: ['active', 'pending'] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"status" IN (?, ?)',
        values: ['active', 'pending'],
      });
    });

    it('should handle ina operator', () => {
      const filters: CrudFilters = [
        { field: 'id', operator: 'ina', value: [1, 2, 3] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"id" IN (?, ?, ?)', values: [1, 2, 3] });
    });

    it('should handle nin operator', () => {
      const filters: CrudFilters = [
        { field: 'status', operator: 'nin', value: ['deleted', 'archived'] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"status" NOT IN (?, ?)',
        values: ['deleted', 'archived'],
      });
    });

    it('should handle nina operator', () => {
      const filters: CrudFilters = [
        { field: 'id', operator: 'nina', value: [1, 2] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"id" NOT IN (?, ?)', values: [1, 2] });
    });

    it('should handle contains operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'contains', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" LIKE ?', values: ['%John%'] });
    });

    it('should handle ncontains operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ncontains', value: 'spam' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" NOT LIKE ?',
        values: ['%spam%'],
      });
    });

    it('should handle containss operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'containss', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" LIKE ? COLLATE BINARY',
        values: ['%John%'],
      });
    });

    it('should handle ncontainss operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ncontainss', value: 'spam' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" NOT LIKE ? COLLATE BINARY',
        values: ['%spam%'],
      });
    });

    it('should handle null operator', () => {
      const filters: CrudFilters = [
        { field: 'deleted_at', operator: 'null', value: void 0 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"deleted_at" IS NULL', values: [] });
    });

    it('should handle nnull operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nnull', value: void 0 },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"email" IS NOT NULL', values: [] });
    });

    it('should handle startswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'startswith', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" LIKE ?', values: ['John%'] });
    });

    it('should handle nstartswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'nstartswith', value: 'spam' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" NOT LIKE ?', values: ['spam%'] });
    });

    it('should handle startswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'startswiths', value: 'John' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" LIKE ? COLLATE BINARY',
        values: ['John%'],
      });
    });

    it('should handle nstartswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'nstartswiths', value: 'spam' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" NOT LIKE ? COLLATE BINARY',
        values: ['spam%'],
      });
    });

    it('should handle endswith operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'endswith', value: '@example.com' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"email" LIKE ?',
        values: ['%@example.com'],
      });
    });

    it('should handle nendswith operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nendswith', value: '@spam.com' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"email" NOT LIKE ?',
        values: ['%@spam.com'],
      });
    });

    it('should handle endswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'endswiths', value: '@Example.com' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"email" LIKE ? COLLATE BINARY',
        values: ['%@Example.com'],
      });
    });

    it('should handle nendswiths operator', () => {
      const filters: CrudFilters = [
        { field: 'email', operator: 'nendswiths', value: '@Spam.com' },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"email" NOT LIKE ? COLLATE BINARY',
        values: ['%@Spam.com'],
      });
    });

    it('should handle between operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'between', value: [18, 65] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"age" BETWEEN ? AND ?',
        values: [18, 65],
      });
    });

    it('should handle nbetween operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'nbetween', value: [0, 17] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"age" NOT BETWEEN ? AND ?',
        values: [0, 17],
      });
    });

    it('should throw error for unknown operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'unknown' as any, value: 'test' },
      ];
      expect(() => createCrudFilters(filters)).toThrow(
        'Unknown filter operator: unknown',
      );
    });
  });

  describe('ConditionalFilter operators', () => {
    it('should handle AND operator with multiple conditions', () => {
      const filters: CrudFilters = [
        {
          operator: 'and',
          value: [
            { field: 'name', operator: 'eq', value: 'John' },
            { field: 'age', operator: 'gte', value: 18 },
          ],
        },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '("name" = ? AND "age" >= ?)',
        values: ['John', 18],
      });
    });

    it('should handle OR operator with multiple conditions', () => {
      const filters: CrudFilters = [
        {
          operator: 'or',
          value: [
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'status', operator: 'eq', value: 'pending' },
          ],
        },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '("status" = ? OR "status" = ?)',
        values: ['active', 'pending'],
      });
    });

    it('should handle single condition in conditional filter', () => {
      const filters: CrudFilters = [
        {
          operator: 'and',
          value: [{ field: 'name', operator: 'eq', value: 'John' }],
        },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({ where: '"name" = ?', values: ['John'] });
    });

    it('should handle nested conditional filters', () => {
      const filters: CrudFilters = [
        {
          operator: 'and',
          value: [
            { field: 'name', operator: 'eq', value: 'John' },
            {
              operator: 'or',
              value: [
                { field: 'age', operator: 'lt', value: 30 },
                { field: 'age', operator: 'gt', value: 60 },
              ],
            },
          ],
        },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '("name" = ? AND ("age" < ? OR "age" > ?))',
        values: ['John', 30, 60],
      });
    });
  });

  describe('Mixed filters', () => {
    it('should handle combination of logical and conditional filters', () => {
      const filters: CrudFilters = [
        { field: 'active', operator: 'eq', value: true },
        {
          operator: 'or',
          value: [
            { field: 'role', operator: 'eq', value: 'admin' },
            { field: 'role', operator: 'eq', value: 'moderator' },
          ],
        },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"active" = ? AND ("role" = ? OR "role" = ?)',
        values: [true, 'admin', 'moderator'],
      });
    });

    it('should handle multiple logical filters', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
        { field: 'age', operator: 'gte', value: 18 },
        { field: 'status', operator: 'in', value: ['active', 'pending'] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toEqual({
        where: '"name" = ? AND "age" >= ? AND "status" IN (?, ?)',
        values: ['John', 18, 'active', 'pending'],
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty conditional filter', () => {
      const filters: CrudFilters = [{ operator: 'and', value: [] }];
      const result = createCrudFilters(filters);
      expect(result).toBeUndefined();
    });

    it('should handle filters with no valid conditions', () => {
      const filters: CrudFilters = [
        { operator: 'and', value: [{ operator: 'or', value: [] }] },
      ];
      const result = createCrudFilters(filters);
      expect(result).toBeUndefined();
    });
  });
});
