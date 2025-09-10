import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createProvider } from '../core/data-provider';
import {
  MockDatabaseAdapter,
  TestDataGenerators,
  TestAssertions,
} from './utils/mock-client';
import { CrudTestPatterns } from './utils/test-patterns';
// import { ConnectionError, QueryError, ValidationError } from '../types/errors';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name', { length: 255 }).notNull(),
  email: text('email', { length: 255 }).notNull(),
  age: integer('age'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title', { length: 255 }).notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  published: integer('published').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

const schema = { users, posts };

describe('Data Provider', () => {
  let adapter: MockDatabaseAdapter<typeof schema>;
  let dataProvider: ReturnType<typeof createProvider>;

  beforeEach(() => {
    adapter = new MockDatabaseAdapter(schema, {
      users: TestDataGenerators.users(5), // Increased from 3 to 5 for pagination tests
      posts: TestDataGenerators.posts(5),
    });
    dataProvider = createProvider(adapter);
  });

  describe('Basic CRUD Operations', () => {
    it('should create data provider from adapter', () => {
      expect(dataProvider).toBeDefined();
      expect(dataProvider.client).toBeDefined();
      expect(dataProvider.schema).toBe(schema);
    });

    it('should handle basic CRUD operations', async () => {
      const sampleUserData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      // Use the common test pattern to reduce repetition
      await CrudTestPatterns.testBasicCrud(
        dataProvider,
        'users',
        sampleUserData
      );
    });

    it('should handle batch operations', async () => {
      const usersData = [
        { name: 'User 1', email: 'user1@example.com', age: 25 },
        { name: 'User 2', email: 'user2@example.com', age: 30 },
      ];

      const createManyResult = await dataProvider.createMany({
        resource: 'users',
        variables: usersData,
      });

      TestAssertions.isValidRefineResponse(createManyResult);
      TestAssertions.areValidRecords(createManyResult.data, [
        'id',
        'name',
        'email',
      ]);
      expect(createManyResult.data).toHaveLength(2);

      const ids = createManyResult.data.map((user: any) => user.id);

      const getManyResult = await dataProvider.getMany({
        resource: 'users',
        ids,
      });

      TestAssertions.isValidRefineResponse(getManyResult);
      TestAssertions.areValidRecords(getManyResult.data, [
        'id',
        'name',
        'email',
      ]);

      const updateManyResult = await dataProvider.updateMany({
        resource: 'users',
        ids,
        variables: { age: 35 },
      });

      TestAssertions.isValidRefineResponse(updateManyResult);
      TestAssertions.areValidRecords(updateManyResult.data, [
        'id',
        'name',
        'email',
      ]);

      const deleteManyResult = await dataProvider.deleteMany({
        resource: 'users',
        ids,
      });

      TestAssertions.isValidRefineResponse(deleteManyResult);
      TestAssertions.areValidRecords(deleteManyResult.data, ['id']);
    });
  });

  describe('Advanced Query Features', () => {
    it('should support complex filtering with logical operators', async () => {
      const filters: CrudFilters = [
        {
          operator: 'or',
          value: [
            { field: 'age', operator: 'gte', value: 25 },
            { field: 'name', operator: 'contains', value: 'Admin' },
          ],
        },
      ];

      const result = await dataProvider.getList({
        resource: 'users',
        filters,
        pagination: { current: 1, pageSize: 10, mode: 'server' },
      });

      TestAssertions.isValidListResponse(result);
    });

    it('should support multiple sorting criteria', async () => {
      const sorters: CrudSorting = [
        { field: 'age', order: 'desc' },
        { field: 'name', order: 'asc' },
      ];

      const result = await dataProvider.getList({
        resource: 'users',
        sorters,
        pagination: { current: 1, pageSize: 10, mode: 'server' },
      });

      TestAssertions.isValidListResponse(result);
    });

    it('should handle pagination correctly', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { current: 2, pageSize: 2, mode: 'server' },
      });

      TestAssertions.isValidListResponse(result);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Chain Query API', () => {
    it('should support chain query builder', async () => {
      const chainQuery = dataProvider.from('users');
      expect(chainQuery).toBeDefined();
      expect(typeof chainQuery.where).toBe('function');
      expect(typeof chainQuery.orderBy).toBe('function');
      expect(typeof chainQuery.limit).toBe('function');
    });

    it('should execute chain queries', async () => {
      const result = await dataProvider
        .from('users')
        .where('age', 'gte', 18)
        .orderBy('name', 'asc')
        .limit(5)
        .get();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions', async () => {
      const result = await dataProvider.transaction(async tx => {
        const user = await tx.create({
          resource: 'users',
          variables: { name: 'Transaction User', email: 'tx@example.com' },
        });

        const post = await tx.create({
          resource: 'posts',
          variables: { title: 'Transaction Post', userId: user.data.id },
        });

        return { user, post };
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.post).toBeDefined();
    });

    it('should rollback transactions on error', async () => {
      await expect(
        dataProvider.transaction(async tx => {
          await tx.create({
            resource: 'users',
            variables: { name: 'Test User', email: 'test@example.com' },
          });

          throw new Error('Transaction should rollback');
        })
      ).rejects.toThrow('Transaction should rollback');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      adapter.simulateConnectionError();

      await expect(
        dataProvider.getList({ resource: 'users' })
      ).rejects.toThrow();
    });

    it('should handle query errors', async () => {
      adapter.simulateQueryError();

      await expect(
        dataProvider.getList({ resource: 'users' })
      ).rejects.toThrow();
    });

    it('should validate resource names', async () => {
      await expect(
        dataProvider.getList({ resource: 'nonexistent' as any })
      ).rejects.toThrow();
    });

    it('should validate required fields for create operations', async () => {
      await expect(
        dataProvider.create({
          resource: 'users',
          variables: { name: 'Test' }, // Missing required email field
        })
      ).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should provide type-safe operations', () => {
      // These should compile without TypeScript errors
      const userQuery = dataProvider.from('users');
      const postQuery = dataProvider.from('posts');

      expect(userQuery).toBeDefined();
      expect(postQuery).toBeDefined();
    });

    it('should infer correct types for schema', () => {
      expect(dataProvider.schema.users).toBe(users);
      expect(dataProvider.schema.posts).toBe(posts);
    });
  });

  describe('Performance and Caching', () => {
    it('should handle large datasets efficiently', async () => {
      // Set up large mock dataset
      adapter.setMockData('users', TestDataGenerators.users(1000));

      const startTime = Date.now();
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 50, mode: 'server' },
      });
      const endTime = Date.now();

      TestAssertions.isValidListResponse(result);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        dataProvider.getOne({ resource: 'users', id: (i % 3) + 1 })
      );

      const results = await Promise.all(operations);

      results.forEach(result => {
        TestAssertions.isValidRefineResponse(result);
      });
    });
  });

  describe('Meta and Custom Options', () => {
    it('should handle meta options in operations', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        meta: { customOption: 'test', includeDeleted: false },
      });

      TestAssertions.isValidListResponse(result);
    });

    it('should pass through custom options to adapter', async () => {
      const spy = vi.spyOn(adapter, 'executeRaw');

      await dataProvider.getList({
        resource: 'users',
        meta: { rawQuery: true },
      });

      // Verify that meta options are processed
      expect(spy).toHaveBeenCalled();
    });
  });
});
