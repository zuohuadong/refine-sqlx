/**
 * Comprehensive filter and sorter tests for v0.3.0
 * Tests all Refine filter operators and sorting combinations
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  calculatePagination,
  filtersToWhere,
  sortersToOrderBy,
} from '../src/filters';
import { describe, expect, it } from './helpers/test-adapter';

describe('Filters and Sorters - v0.3.0', () => {
  // Test table
  const testTable = sqliteTable('test', {
    id: integer('id').primaryKey(),
    name: text('name'),
    age: integer('age'),
    email: text('email'),
    status: text('status'),
  });

  describe('filtersToWhere', () => {
    it('should handle eq operator', () => {
      const result = filtersToWhere(
        [{ field: 'status', operator: 'eq', value: 'active' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle ne operator', () => {
      const result = filtersToWhere(
        [{ field: 'status', operator: 'ne', value: 'deleted' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle lt operator', () => {
      const result = filtersToWhere(
        [{ field: 'age', operator: 'lt', value: 30 }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle lte operator', () => {
      const result = filtersToWhere(
        [{ field: 'age', operator: 'lte', value: 30 }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle gt operator', () => {
      const result = filtersToWhere(
        [{ field: 'age', operator: 'gt', value: 18 }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle gte operator', () => {
      const result = filtersToWhere(
        [{ field: 'age', operator: 'gte', value: 18 }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle in operator', () => {
      const result = filtersToWhere(
        [{ field: 'status', operator: 'in', value: ['active', 'pending'] }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle nin operator', () => {
      const result = filtersToWhere(
        [{ field: 'status', operator: 'nin', value: ['deleted', 'banned'] }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle contains operator (case-insensitive)', () => {
      const result = filtersToWhere(
        [{ field: 'name', operator: 'contains', value: 'john' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle ncontains operator', () => {
      const result = filtersToWhere(
        [{ field: 'name', operator: 'ncontains', value: 'spam' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle containss operator (case-sensitive)', () => {
      const result = filtersToWhere(
        [{ field: 'name', operator: 'containss', value: 'John' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle startswith operator', () => {
      const result = filtersToWhere(
        [{ field: 'email', operator: 'startswith', value: 'admin' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle endswith operator', () => {
      const result = filtersToWhere(
        [{ field: 'email', operator: 'endswith', value: '@example.com' }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle null operator', () => {
      const result = filtersToWhere(
        [{ field: 'email', operator: 'null', value: true }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle nnull operator', () => {
      const result = filtersToWhere(
        [{ field: 'email', operator: 'nnull', value: true }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle between operator', () => {
      const result = filtersToWhere(
        [{ field: 'age', operator: 'between', value: [18, 65] }],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle multiple filters with AND', () => {
      const result = filtersToWhere(
        [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'age', operator: 'gte', value: 18 },
        ],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle empty filters', () => {
      const result = filtersToWhere([], testTable);

      expect(result).toBeUndefined();
    });

    it('should handle undefined filters', () => {
      const result = filtersToWhere(undefined, testTable);

      expect(result).toBeUndefined();
    });

    it('should handle or operator in filters', () => {
      const result = filtersToWhere(
        [
          {
            operator: 'or',
            value: [
              { field: 'status', operator: 'eq', value: 'active' },
              { field: 'status', operator: 'eq', value: 'pending' },
            ],
          },
        ],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle and operator in filters', () => {
      const result = filtersToWhere(
        [
          {
            operator: 'and',
            value: [
              { field: 'status', operator: 'eq', value: 'active' },
              { field: 'age', operator: 'gte', value: 18 },
            ],
          },
        ],
        testTable,
      );

      expect(result).toBeDefined();
    });
  });

  describe('sortersToOrderBy', () => {
    it('should handle ascending sort', () => {
      const result = sortersToOrderBy(
        [{ field: 'name', order: 'asc' }],
        testTable,
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
    });

    it('should handle descending sort', () => {
      const result = sortersToOrderBy(
        [{ field: 'age', order: 'desc' }],
        testTable,
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
    });

    it('should handle multiple sorters', () => {
      const result = sortersToOrderBy(
        [
          { field: 'status', order: 'asc' },
          { field: 'age', order: 'desc' },
          { field: 'name', order: 'asc' },
        ],
        testTable,
      );

      expect(result.length).toBe(3);
    });

    it('should handle empty sorters', () => {
      const result = sortersToOrderBy([], testTable);

      expect(result).toEqual([]);
    });

    it('should handle undefined sorters', () => {
      const result = sortersToOrderBy(undefined, testTable);

      expect(result).toEqual([]);
    });
  });

  describe('calculatePagination', () => {
    it('should calculate default pagination', () => {
      const result = calculatePagination({});

      expect(result).toEqual({ offset: 0, limit: 10 });
    });

    it('should calculate pagination for page 1', () => {
      const result = calculatePagination({ current: 1, pageSize: 20 });

      expect(result).toEqual({ offset: 0, limit: 20 });
    });

    it('should calculate pagination for page 2', () => {
      const result = calculatePagination({ current: 2, pageSize: 20 });

      expect(result).toEqual({ offset: 20, limit: 20 });
    });

    it('should calculate pagination for page 3', () => {
      const result = calculatePagination({ current: 3, pageSize: 15 });

      expect(result).toEqual({ offset: 30, limit: 15 });
    });

    it('should handle mode: "off"', () => {
      const result = calculatePagination({ mode: 'off' });

      expect(result).toEqual({ offset: 0, limit: 999999 });
    });

    it('should handle mode: "server"', () => {
      const result = calculatePagination({
        mode: 'server',
        current: 2,
        pageSize: 25,
      });

      expect(result).toEqual({ offset: 25, limit: 25 });
    });

    it('should handle mode: "client"', () => {
      const result = calculatePagination({
        mode: 'client',
        current: 1,
        pageSize: 50,
      });

      expect(result).toEqual({ offset: 0, limit: 999999 });
    });

    it('should handle undefined pagination', () => {
      const result = calculatePagination(undefined as any);

      expect(result).toEqual({ offset: 0, limit: 10 });
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should handle nested AND/OR operators', () => {
      const result = filtersToWhere(
        [
          { field: 'status', operator: 'eq', value: 'active' },
          {
            operator: 'or',
            value: [
              { field: 'age', operator: 'lt', value: 25 },
              { field: 'age', operator: 'gt', value: 60 },
            ],
          },
        ],
        testTable,
      );

      expect(result).toBeDefined();
    });

    it('should handle mixed operators', () => {
      const result = filtersToWhere(
        [
          { field: 'status', operator: 'in', value: ['active', 'pending'] },
          { field: 'age', operator: 'between', value: [18, 65] },
          { field: 'name', operator: 'contains', value: 'test' },
          { field: 'email', operator: 'nnull', value: true },
        ],
        testTable,
      );

      expect(result).toBeDefined();
    });
  });
});
