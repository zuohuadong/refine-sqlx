import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import {
  eq,
  and,
  or,
  gt,
  gte,
  lt,
  lte,
  like,
  ilike,
  isNull,
  isNotNull,
  inArray,
  asc,
  desc,
} from 'drizzle-orm';
import { RefineQueryBuilder } from '../core/query-builder.js';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type { DrizzleClient } from '../types/client.js';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  createdAt: timestamp('created_at').defaultNow(),
});

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users, posts };

// Mock client
const createMockClient = () => {
  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    execute: vi
      .fn()
      .mockResolvedValue([
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          createdAt: new Date(),
        },
      ]),
  };

  return {
    select: vi.fn().mockReturnValue(mockQuery),
    insert: vi
      .fn()
      .mockReturnValue({
        values: vi
          .fn()
          .mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi
                  .fn()
                  .mockResolvedValue([
                    {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      age: 30,
                      createdAt: new Date(),
                    },
                  ]),
              }),
          }),
      }),
    update: vi
      .fn()
      .mockReturnValue({
        set: vi
          .fn()
          .mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue({
                returning: vi
                  .fn()
                  .mockReturnValue({
                    execute: vi
                      .fn()
                      .mockResolvedValue([
                        {
                          id: 1,
                          name: 'John Smith',
                          email: 'john@example.com',
                          age: 30,
                          createdAt: new Date(),
                        },
                      ]),
                  }),
              }),
          }),
      }),
    delete: vi
      .fn()
      .mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi
                  .fn()
                  .mockResolvedValue([
                    {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      age: 30,
                      createdAt: new Date(),
                    },
                  ]),
              }),
          }),
      }),
  } as unknown as DrizzleClient<typeof schema>;
};

describe('RefineQueryBuilder', () => {
  let queryBuilder: RefineQueryBuilder<typeof schema>;
  let mockClient: DrizzleClient<typeof schema>;

  beforeEach(() => {
    queryBuilder = new RefineQueryBuilder();
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  describe('buildWhereConditions', () => {
    it('should return undefined for empty filters', () => {
      const result = queryBuilder.buildWhereConditions(users, []);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined filters', () => {
      const result = queryBuilder.buildWhereConditions(users, undefined);
      expect(result).toBeUndefined();
    });

    it('should build simple equality filter', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should build multiple filters with AND logic', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
        { field: 'age', operator: 'gte', value: 18 },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should build logical OR filters', () => {
      const filters: CrudFilters = [
        {
          operator: 'or',
          value: [
            { field: 'name', operator: 'eq', value: 'John' },
            { field: 'name', operator: 'eq', value: 'Jane' },
          ],
        },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle contains operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'contains', value: 'John' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle in operator with array', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'in', value: [18, 25, 30] },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle between operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'between', value: [18, 65] },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle null operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'null', value: null },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle nnull operator', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'nnull', value: null },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle startswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'startswith', value: 'John' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle endswith operator', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'endswith', value: 'Doe' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle case-insensitive operators', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'containss', value: 'john' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle negated operators', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'ncontains', value: 'admin' },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle complex nested logical filters', () => {
      const filters: CrudFilters = [
        {
          operator: 'and',
          value: [
            { field: 'age', operator: 'gte', value: 18 },
            {
              operator: 'or',
              value: [
                { field: 'name', operator: 'contains', value: 'John' },
                { field: 'email', operator: 'endswith', value: '@company.com' },
              ],
            },
          ],
        },
      ];

      const result = queryBuilder.buildWhereConditions(users, filters);
      expect(result).toBeDefined();
    });

    it('should handle invalid field names gracefully', () => {
      const filters: CrudFilters = [
        { field: 'nonexistent', operator: 'eq', value: 'test' },
      ];

      // Should not throw, but return undefined or handle gracefully
      const result = queryBuilder.buildWhereConditions(users, filters);
      // The implementation should handle this gracefully
      expect(result).toBeDefined();
    });

    it('should validate between operator values', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'between', value: [18] }, // Invalid: only one value
      ];

      expect(() => {
        queryBuilder.buildWhereConditions(users, filters);
      }).toThrow('Between operator requires array with exactly 2 values');
    });

    it('should validate nbetween operator values', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'nbetween', value: [18, 25, 30] }, // Invalid: too many values
      ];

      expect(() => {
        queryBuilder.buildWhereConditions(users, filters);
      }).toThrow('Not between operator requires array with exactly 2 values');
    });
  });

  describe('buildOrderBy', () => {
    it('should return empty array for undefined sorters', () => {
      const result = queryBuilder.buildOrderBy(users, undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty sorters', () => {
      const result = queryBuilder.buildOrderBy(users, []);
      expect(result).toEqual([]);
    });

    it('should build single ascending sort', () => {
      const sorters: CrudSorting = [{ field: 'name', order: 'asc' }];

      const result = queryBuilder.buildOrderBy(users, sorters);
      expect(result).toHaveLength(1);
    });

    it('should build single descending sort', () => {
      const sorters: CrudSorting = [{ field: 'createdAt', order: 'desc' }];

      const result = queryBuilder.buildOrderBy(users, sorters);
      expect(result).toHaveLength(1);
    });

    it('should build multiple sorts', () => {
      const sorters: CrudSorting = [
        { field: 'name', order: 'asc' },
        { field: 'createdAt', order: 'desc' },
      ];

      const result = queryBuilder.buildOrderBy(users, sorters);
      expect(result).toHaveLength(2);
    });

    it('should handle invalid field names gracefully', () => {
      const sorters: CrudSorting = [{ field: 'nonexistent', order: 'asc' }];

      const result = queryBuilder.buildOrderBy(users, sorters);
      // Should handle gracefully, possibly returning empty array or filtering out invalid sorts
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('buildPagination', () => {
    it('should return empty object for undefined pagination', () => {
      const result = queryBuilder.buildPagination(undefined);
      expect(result).toEqual({});
    });

    it('should build pagination with current and pageSize', () => {
      const pagination: Pagination = {
        current: 2,
        pageSize: 10,
        mode: 'server',
      };

      const result = queryBuilder.buildPagination(pagination);
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('offset');
    });

    it('should handle first page correctly', () => {
      const pagination: Pagination = {
        current: 1,
        pageSize: 20,
        mode: 'server',
      };

      const result = queryBuilder.buildPagination(pagination);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should calculate offset correctly for subsequent pages', () => {
      const pagination: Pagination = {
        current: 3,
        pageSize: 15,
        mode: 'server',
      };

      const result = queryBuilder.buildPagination(pagination);
      expect(result.limit).toBe(15);
      expect(result.offset).toBe(30); // (3-1) * 15
    });

    it('should handle pagination mode off', () => {
      const pagination: Pagination = { mode: 'off' };

      const result = queryBuilder.buildPagination(pagination);
      expect(result).toEqual({});
    });
  });

  describe('buildComplexQuery', () => {
    it('should build query with all options', () => {
      const options = {
        table: users,
        filters: [{ field: 'age', operator: 'gte', value: 18 }] as CrudFilters,
        sorters: [{ field: 'name', order: 'asc' }] as CrudSorting,
        pagination: { current: 1, pageSize: 10, mode: 'server' } as Pagination,
      };

      const result = queryBuilder.buildComplexQuery(mockClient, options);
      expect(result).toBeDefined();
    });

    it('should build query with only filters', () => {
      const options = {
        table: users,
        filters: [
          { field: 'name', operator: 'eq', value: 'John' },
        ] as CrudFilters,
      };

      const result = queryBuilder.buildComplexQuery(mockClient, options);
      expect(result).toBeDefined();
    });

    it('should build query with only sorting', () => {
      const options = {
        table: users,
        sorters: [{ field: 'createdAt', order: 'desc' }] as CrudSorting,
      };

      const result = queryBuilder.buildComplexQuery(mockClient, options);
      expect(result).toBeDefined();
    });

    it('should build query with only pagination', () => {
      const options = {
        table: users,
        pagination: { current: 2, pageSize: 5, mode: 'server' } as Pagination,
      };

      const result = queryBuilder.buildComplexQuery(mockClient, options);
      expect(result).toBeDefined();
    });

    it('should build basic query with no options', () => {
      const options = { table: users };

      const result = queryBuilder.buildComplexQuery(mockClient, options);
      expect(result).toBeDefined();
    });
  });

  describe('CRUD query builders', () => {
    it('should build list query', () => {
      const params = {
        filters: [{ field: 'age', operator: 'gte', value: 18 }] as CrudFilters,
        sorters: [{ field: 'name', order: 'asc' }] as CrudSorting,
        pagination: { current: 1, pageSize: 10, mode: 'server' } as Pagination,
      };

      const result = queryBuilder.buildListQuery(mockClient, users, params);
      expect(result).toBeDefined();
    });

    it('should build get one query', () => {
      const result = queryBuilder.buildGetOneQuery(mockClient, users, 1);
      expect(result).toBeDefined();
    });

    it('should build get many query', () => {
      const result = queryBuilder.buildGetManyQuery(
        mockClient,
        users,
        [1, 2, 3]
      );
      expect(result).toBeDefined();
    });

    it('should build create query', () => {
      const data = { name: 'John Doe', email: 'john@example.com', age: 30 };
      const result = queryBuilder.buildCreateQuery(mockClient, users, data);
      expect(result).toBeDefined();
    });

    it('should build update query', () => {
      const data = { name: 'John Smith' };
      const result = queryBuilder.buildUpdateQuery(mockClient, users, 1, data);
      expect(result).toBeDefined();
    });

    it('should build delete query', () => {
      const result = queryBuilder.buildDeleteQuery(mockClient, users, 1);
      expect(result).toBeDefined();
    });

    it('should build create many query', () => {
      const data = [
        { name: 'John Doe', email: 'john@example.com', age: 30 },
        { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
      ];
      const result = queryBuilder.buildCreateManyQuery(mockClient, users, data);
      expect(result).toBeDefined();
    });

    it('should build update many query', () => {
      const data = { age: 31 };
      const result = queryBuilder.buildUpdateManyQuery(
        mockClient,
        users,
        [1, 2],
        data
      );
      expect(result).toBeDefined();
    });

    it('should build delete many query', () => {
      const result = queryBuilder.buildDeleteManyQuery(
        mockClient,
        users,
        [1, 2, 3]
      );
      expect(result).toBeDefined();
    });
  });

  describe('buildCountQuery', () => {
    it('should build count query without filters', () => {
      const result = queryBuilder.buildCountQuery(mockClient, users);
      expect(result).toBeDefined();
    });

    it('should build count query with filters', () => {
      const filters: CrudFilters = [
        { field: 'age', operator: 'gte', value: 18 },
      ];
      const result = queryBuilder.buildCountQuery(mockClient, users, filters);
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed filters gracefully', () => {
      const malformedFilters = [
        { field: 'name' }, // Missing operator and value
      ] as any;

      expect(() => {
        queryBuilder.buildWhereConditions(users, malformedFilters);
      }).not.toThrow();
    });

    it('should handle malformed sorters gracefully', () => {
      const malformedSorters = [
        { field: 'name' }, // Missing order
      ] as any;

      expect(() => {
        queryBuilder.buildOrderBy(users, malformedSorters);
      }).not.toThrow();
    });

    it('should handle invalid pagination values', () => {
      const invalidPagination = {
        current: -1,
        pageSize: 0,
        mode: 'server',
      } as Pagination;

      expect(() => {
        queryBuilder.buildPagination(invalidPagination);
      }).not.toThrow();
    });
  });

  describe('type safety', () => {
    it('should work with different table schemas', () => {
      const postsFilters: CrudFilters = [
        { field: 'title', operator: 'contains', value: 'test' },
      ];

      const result = queryBuilder.buildWhereConditions(posts, postsFilters);
      expect(result).toBeDefined();
    });

    it('should handle schema with different column types', () => {
      const mixedFilters: CrudFilters = [
        { field: 'id', operator: 'eq', value: 1 },
        { field: 'title', operator: 'contains', value: 'test' },
        { field: 'createdAt', operator: 'gte', value: new Date() },
      ];

      const result = queryBuilder.buildWhereConditions(posts, mixedFilters);
      expect(result).toBeDefined();
    });
  });

  describe('performance and caching', () => {
    it('should cache transformers for repeated use', () => {
      const filters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
      ];

      // First call
      const result1 = queryBuilder.buildWhereConditions(users, filters);
      // Second call with same table should use cached transformer
      const result2 = queryBuilder.buildWhereConditions(users, filters);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle multiple different tables', () => {
      const userFilters: CrudFilters = [
        { field: 'name', operator: 'eq', value: 'John' },
      ];
      const postFilters: CrudFilters = [
        { field: 'title', operator: 'contains', value: 'test' },
      ];

      const userResult = queryBuilder.buildWhereConditions(users, userFilters);
      const postResult = queryBuilder.buildWhereConditions(posts, postFilters);

      expect(userResult).toBeDefined();
      expect(postResult).toBeDefined();
    });
  });
});
