/**
 * Mock-based integration tests
 * Tests the full integration flow using mocked database clients
 * This provides comprehensive integration testing without requiring real database connections
 */

import { describe, it, expect, beforeEach } from '../test-utils.js';
import {
  createMockDrizzleClient,
  MockDatabaseAdapter,
  TestDataGenerators,
} from '../utils/mock-client.js';
import { createProvider } from '../../core/data-provider.js';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  age: integer('age'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  commentableType: text('commentable_type').notNull(),
  commentableId: integer('commentable_id').notNull(),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

const testSchema = { users, posts, comments };

describe('Mock Integration Tests', () => {
  let mockAdapter: MockDatabaseAdapter<typeof testSchema>;
  let dataProvider: ReturnType<typeof createProvider>;

  beforeEach(() => {
    // Create mock adapter with test data
    const mockData = {
      users: TestDataGenerators.users(5),
      posts: TestDataGenerators.posts(10),
      comments: TestDataGenerators.comments(15),
    };

    mockAdapter = new MockDatabaseAdapter(testSchema, mockData);
    dataProvider = createProvider(mockAdapter);
  });

  describe('End-to-End CRUD Operations', () => {
    it('should perform complete CRUD workflow', async () => {
      // Create a user
      const createResult = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Integration Test User',
          email: 'integration@test.com',
          age: 30,
          isActive: true,
        },
      });

      expect(createResult.data).toBeDefined();
      expect(createResult.data.id).toBeDefined();
      expect(createResult.data.name).toBe('Integration Test User');

      const userId = createResult.data.id;

      // Read the created user
      const getResult = await dataProvider.getOne({
        resource: 'users',
        id: userId,
      });

      expect(getResult.data).toBeDefined();
      expect(getResult.data.id).toBe(userId);
      expect(getResult.data.name).toBe('Integration Test User');

      // Update the user
      const updateResult = await dataProvider.update({
        resource: 'users',
        id: userId,
        variables: { name: 'Updated Integration User', age: 31 },
      });

      expect(updateResult.data).toBeDefined();
      expect(updateResult.data.name).toBe('Updated Integration User');
      expect(updateResult.data.age).toBe(31);

      // List users with filters
      const listResult = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'isActive', operator: 'eq', value: true }],
        sorters: [{ field: 'name', order: 'asc' }],
        pagination: { currentPage: 1, pageSize: 10 },
      });

      expect(listResult.data).toBeDefined();
      expect(Array.isArray(listResult.data)).toBe(true);
      expect(typeof listResult.total).toBe('number');

      // Delete the user
      const deleteResult = await dataProvider.deleteOne({
        resource: 'users',
        id: userId,
      });

      expect(deleteResult.data).toBeDefined();
      expect(deleteResult.data.id).toBe(userId);
    });

    it('should handle batch operations', async () => {
      const usersData = [
        { name: 'Batch User 1', email: 'batch1@test.com', age: 25 },
        { name: 'Batch User 2', email: 'batch2@test.com', age: 30 },
        { name: 'Batch User 3', email: 'batch3@test.com', age: 35 },
      ];

      // Create multiple users
      const createManyResult = await dataProvider.createMany({
        resource: 'users',
        variables: usersData,
      });

      expect(createManyResult.data).toHaveLength(3);
      createManyResult.data.forEach((user, index) => {
        expect(user.name).toBe(usersData[index].name);
        expect(user.email).toBe(usersData[index].email);
      });

      const userIds = createManyResult.data.map(user => user.id);

      // Get multiple users
      const getManyResult = await dataProvider.getMany({
        resource: 'users',
        ids: userIds,
      });

      expect(getManyResult.data).toHaveLength(3);

      // Update multiple users
      const updateManyResult = await dataProvider.updateMany({
        resource: 'users',
        ids: userIds,
        variables: { isActive: false },
      });

      expect(updateManyResult.data).toHaveLength(3);
      updateManyResult.data.forEach(user => {
        expect(user.isActive).toBe(false);
      });

      // Delete multiple users
      const deleteManyResult = await dataProvider.deleteMany({
        resource: 'users',
        ids: userIds,
      });

      expect(deleteManyResult.data).toHaveLength(3);
    });
  });

  describe('Transaction Integration', () => {
    it('should handle successful transactions', async () => {
      const result = await dataProvider.transaction(async tx => {
        // Create user within transaction
        const user = await tx.create({
          resource: 'users',
          variables: {
            name: 'Transaction User',
            email: 'transaction@test.com',
            age: 28,
          },
        });

        // Create post for the user
        const post = await tx.create({
          resource: 'posts',
          variables: {
            title: 'Transaction Post',
            content: 'Created in transaction',
            userId: user.data.id,
            published: true,
          },
        });

        return { user: user.data, post: post.data };
      });

      expect(result.user).toBeDefined();
      expect(result.post).toBeDefined();
      expect(result.post.userId).toBe(result.user.id);
    });

    it('should handle transaction rollbacks', async () => {
      await expect(
        dataProvider.transaction(async tx => {
          // Create user
          await tx.create({
            resource: 'users',
            variables: {
              name: 'Rollback User',
              email: 'rollback@test.com',
              age: 25,
            },
          });

          // Simulate error
          throw new Error('Transaction should rollback');
        })
      ).rejects.toThrow('Transaction should rollback');
    });
  });

  describe('Chain Query Integration', () => {
    it('should perform chain queries with filtering and sorting', async () => {
      const users = await dataProvider
        .from('users')
        .where('isActive', 'eq', true)
        .where('age', 'gte', 25)
        .orderBy('name', 'asc')
        .limit(5)
        .get();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeLessThanOrEqual(5);
    });

    it('should perform aggregation queries', async () => {
      const count = await dataProvider
        .from('users')
        .where('isActive', 'eq', true)
        .count();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);

      const avgAge = await dataProvider.from('users').avg('age');

      expect(typeof avgAge).toBe('number');
      expect(avgAge).toBeGreaterThanOrEqual(0);

      const sumAge = await dataProvider.from('users').sum('age');

      expect(typeof sumAge).toBe('number');
      expect(sumAge).toBeGreaterThanOrEqual(0);
    });

    it('should handle pagination in chain queries', async () => {
      const page1 = await dataProvider.from('users').paginate(1, 3).get();

      const page2 = await dataProvider.from('users').paginate(2, 3).get();

      expect(page1.length).toBeLessThanOrEqual(3);
      expect(page2.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Relationship Query Integration', () => {
    it('should load relationships using with() method', async () => {
      const users = await dataProvider
        .from('users')
        .with('posts')
        .limit(3)
        .get();

      expect(Array.isArray(users)).toBe(true);
      users.forEach(user => {
        expect(user.posts).toBeDefined();
        expect(Array.isArray(user.posts)).toBe(true);
      });
    });

    it('should load polymorphic relationships', async () => {
      const comments = await dataProvider
        .morphTo('comments', {
          typeField: 'commentableType',
          idField: 'commentableId',
          relationName: 'commentable',
          types: { post: 'posts', user: 'users' },
        })
        .get();

      expect(Array.isArray(comments)).toBe(true);
      comments.forEach(comment => {
        expect(comment.commentable).toBeDefined();
      });
    });

    it('should use getWithRelations method', async () => {
      const result = await dataProvider.getWithRelations('users', 1, [
        'posts',
        'comments',
      ]);

      expect(result.data).toBeDefined();
      expect(result.data.posts).toBeDefined();
      expect(result.data.comments).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle validation errors', async () => {
      await expect(
        dataProvider.create({
          resource: 'users',
          variables: {
            name: '', // Invalid empty name
            email: 'invalid-email',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle connection errors', async () => {
      // Simulate connection error
      mockAdapter.simulateConnectionError();

      await expect(dataProvider.getList({ resource: 'users' })).rejects.toThrow(
        'Connection lost'
      );

      // Reset for other tests
      mockAdapter.resetMocks();
    });

    it('should handle query errors', async () => {
      // Simulate query error
      mockAdapter.simulateQueryError();

      await expect(dataProvider.getList({ resource: 'users' })).rejects.toThrow(
        'SQL syntax error'
      );

      // Reset for other tests
      mockAdapter.resetMocks();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      // Set up large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`,
        age: 20 + (i % 50),
        isActive: i % 2 === 0,
        createdAt: new Date(),
      }));

      mockAdapter.setMockData('users', largeDataset);

      const startTime = Date.now();
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: 1, pageSize: 100 },
      });
      const duration = Date.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(1000);
      expect(duration).toBeLessThan(1000); // Should be fast with mocked data
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        dataProvider.create({
          resource: 'users',
          variables: {
            name: `Concurrent User ${i}`,
            email: `concurrent${i}@test.com`,
            age: 25 + i,
          },
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.data.name).toBe(`Concurrent User ${index}`);
      });
      expect(duration).toBeLessThan(2000); // Should handle concurrency well
    });
  });

  describe('Type Safety Integration', () => {
    it('should maintain type safety across operations', async () => {
      // This test verifies that TypeScript types are working correctly
      const user = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Type Safe User',
          email: 'typesafe@test.com',
          age: 30,
          isActive: true,
        },
      });

      // TypeScript should infer the correct types
      expect(typeof user.data.id).toBe('number');
      expect(typeof user.data.name).toBe('string');
      expect(typeof user.data.email).toBe('string');
      expect(typeof user.data.age).toBe('number');
      expect(typeof user.data.isActive).toBe('boolean');
    });

    it('should provide type-safe chain queries', async () => {
      const users = await dataProvider
        .from('users')
        .where('age', 'gte', 25) // TypeScript should validate field names and operators
        .orderBy('name', 'asc')
        .get();

      expect(Array.isArray(users)).toBe(true);
      users.forEach(user => {
        expect(typeof user.name).toBe('string');
        expect(typeof user.age).toBe('number');
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should work with different adapter configurations', async () => {
      // Test that the data provider works with different configurations
      const customAdapter = new MockDatabaseAdapter(testSchema, {
        users: TestDataGenerators.users(3),
        posts: [],
        comments: [],
      });

      const customProvider = createProvider(customAdapter);

      const result = await customProvider.getList({ resource: 'users' });
      expect(result.data).toHaveLength(3);
    });

    it('should handle schema validation', async () => {
      // Test that schema validation works correctly
      expect(dataProvider.schema).toBeDefined();
      expect(dataProvider.schema.users).toBeDefined();
      expect(dataProvider.schema.posts).toBeDefined();
      expect(dataProvider.schema.comments).toBeDefined();
    });
  });
});
