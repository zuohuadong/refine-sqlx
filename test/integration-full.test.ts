/**
 * Comprehensive integration test suite for v0.4.0
 * Tests all CRUD operations with Drizzle ORM integration
 */
import type { DataProvider } from '@refinedev/core';
import { createRefineSQL } from '../src/provider';
import { comments, posts, schema, users } from './fixtures/schema';
import { seedComments, seedPosts, seedUsers } from './fixtures/seed';
import {
  beforeAll,
  describe,
  expect,
  isRunningInBun,
  it,
} from './helpers/test-adapter';

// Import appropriate database driver based on runtime
let Database: any;
let drizzle: any;

if (isRunningInBun) {
  Database = require('bun:sqlite').Database;
  drizzle = require('drizzle-orm/bun-sqlite').drizzle;
} else {
  Database = require('better-sqlite3');
  drizzle = require('drizzle-orm/better-sqlite3').drizzle;
}

describe('refine-sqlx v0.4.0 Integration Tests', () => {
  let dataProvider: DataProvider;
  let db: any;
  let sqlite: any;

  beforeAll(async () => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    // Create tables
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        view_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Create data provider
    dataProvider = await createRefineSQL({ connection: db, schema });

    // Seed data
    const insertedUsers = await db.insert(users).values(seedUsers).returning();

    const postsWithUserId = seedPosts.map((post, i) => ({
      ...post,
      userId: insertedUsers[i % insertedUsers.length].id,
    }));
    const insertedPosts = await db
      .insert(posts)
      .values(postsWithUserId)
      .returning();

    const commentsWithIds = seedComments.map((comment, i) => ({
      ...comment,
      postId: insertedPosts[i % insertedPosts.length].id,
      userId: insertedUsers[i % insertedUsers.length].id,
    }));
    await db.insert(comments).values(commentsWithIds);
  });

  describe('getList', () => {
    it('should get list of users', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBe(5);
      expect(result.total).toBe(5);
    });

    it('should support pagination', async () => {
      const page1 = await dataProvider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 2 },
      });

      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);

      const page2 = await dataProvider.getList({
        resource: 'users',
        pagination: { current: 2, pageSize: 2 },
      });

      expect(page2.data.length).toBe(2);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
    });

    it('should filter by equality', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      });

      expect(result.data.length).toBe(3);
      expect(result.data.every((u: any) => u.status === 'active')).toBe(true);
    });

    it('should filter by comparison operators', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'age', operator: 'gte', value: 30 }],
      });

      expect(result.data.length).toBe(3);
      expect(result.data.every((u: any) => u.age >= 30)).toBe(true);
    });

    it('should filter by contains operator', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'name', operator: 'contains', value: 'Smith' }],
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toContain('Smith');
    });

    it('should filter by in operator', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [
          { field: 'status', operator: 'in', value: ['active', 'pending'] },
        ],
      });

      expect(result.data.length).toBe(4);
      expect(
        result.data.every((u: any) => ['active', 'pending'].includes(u.status)),
      ).toBe(true);
    });

    it('should sort ascending', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        sorters: [{ field: 'age', order: 'asc' }],
      });

      const ages = result.data.map((u: any) => u.age);
      expect(ages).toEqual([...ages].sort((a, b) => a - b));
    });

    it('should sort descending', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        sorters: [{ field: 'age', order: 'desc' }],
      });

      const ages = result.data.map((u: any) => u.age);
      expect(ages).toEqual([...ages].sort((a, b) => b - a));
    });

    it('should combine filters and sorting', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
        sorters: [{ field: 'age', order: 'asc' }],
      });

      expect(result.data.length).toBe(3);
      expect(result.data.every((u: any) => u.status === 'active')).toBe(true);
      const ages = result.data.map((u: any) => u.age);
      expect(ages).toEqual([...ages].sort((a, b) => a - b));
    });
  });

  describe('getOne', () => {
    it('should get single user by id', async () => {
      const result = await dataProvider.getOne({ resource: 'users', id: 1 });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('Alice Johnson');
    });

    it('should throw error for non-existent id', async () => {
      await expect(
        dataProvider.getOne({ resource: 'users', id: 9999 }),
      ).rejects.toThrow();
    });
  });

  describe('getMany', () => {
    it('should get multiple users by ids', async () => {
      const result = await dataProvider.getMany({
        resource: 'users',
        ids: [1, 2, 3],
      });

      expect(result.data.length).toBe(3);
      expect(result.data.map((u: any) => u.id)).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty ids', async () => {
      const result = await dataProvider.getMany({ resource: 'users', ids: [] });

      expect(result.data).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const newUser = {
        name: 'Frank Miller',
        email: 'frank@example.com',
        age: 40,
        status: 'active' as const,
        createdAt: new Date(),
      };

      const result = await dataProvider.create({
        resource: 'users',
        variables: newUser,
      });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe(newUser.name);
      expect(result.data.email).toBe(newUser.email);
    });
  });

  describe('createMany', () => {
    it('should create multiple users', async () => {
      const newUsers = [
        {
          name: 'George Clark',
          email: 'george@example.com',
          age: 27,
          status: 'active' as const,
          createdAt: new Date(),
        },
        {
          name: 'Hannah Lee',
          email: 'hannah@example.com',
          age: 29,
          status: 'pending' as const,
          createdAt: new Date(),
        },
      ];

      const result = await dataProvider.createMany({
        resource: 'users',
        variables: newUsers,
      });

      expect(result.data.length).toBe(2);
      expect(result.data[0].name).toBe(newUsers[0].name);
      expect(result.data[1].name).toBe(newUsers[1].name);
    });

    it('should return empty array for empty variables', async () => {
      const result = await dataProvider.createMany({
        resource: 'users',
        variables: [],
      });

      expect(result.data).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const result = await dataProvider.update({
        resource: 'users',
        id: 1,
        variables: { age: 26, status: 'inactive' },
      });

      expect(result.data.id).toBe(1);
      expect(result.data.age).toBe(26);
      expect(result.data.status).toBe('inactive');
    });

    it('should throw error for non-existent id', async () => {
      await expect(
        dataProvider.update({
          resource: 'users',
          id: 9999,
          variables: { age: 30 },
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateMany', () => {
    it('should update multiple users', async () => {
      const result = await dataProvider.updateMany({
        resource: 'users',
        ids: [2, 3],
        variables: { status: 'active' },
      });

      expect(result.data.length).toBe(2);
      expect(result.data.every((u: any) => u.status === 'active')).toBe(true);
    });

    it('should return empty array for empty ids', async () => {
      const result = await dataProvider.updateMany({
        resource: 'users',
        ids: [],
        variables: { status: 'active' },
      });

      expect(result.data).toEqual([]);
    });
  });

  describe('deleteOne', () => {
    it('should delete a user', async () => {
      // Create a user to delete
      const created = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'To Delete',
          email: 'delete@example.com',
          status: 'pending' as const,
          createdAt: new Date(),
        },
      });

      const result = await dataProvider.deleteOne({
        resource: 'users',
        id: created.data.id,
      });

      expect(result.data.id).toBe(created.data.id);

      // Verify deleted
      await expect(
        dataProvider.getOne({ resource: 'users', id: created.data.id }),
      ).rejects.toThrow();
    });

    it('should throw error for non-existent id', async () => {
      await expect(
        dataProvider.deleteOne({ resource: 'users', id: 9999 }),
      ).rejects.toThrow();
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple users', async () => {
      // Create users to delete
      const created = await dataProvider.createMany({
        resource: 'users',
        variables: [
          {
            name: 'Delete 1',
            email: 'delete1@example.com',
            status: 'pending' as const,
            createdAt: new Date(),
          },
          {
            name: 'Delete 2',
            email: 'delete2@example.com',
            status: 'pending' as const,
            createdAt: new Date(),
          },
        ],
      });

      const ids = created.data.map((u: any) => u.id);
      const result = await dataProvider.deleteMany({ resource: 'users', ids });

      expect(result.data.length).toBe(2);
      expect(result.data.map((u: any) => u.id)).toEqual(ids);
    });

    it('should return empty array for empty ids', async () => {
      const result = await dataProvider.deleteMany({
        resource: 'users',
        ids: [],
      });

      expect(result.data).toEqual([]);
    });
  });

  describe('Type Safety', () => {
    it('should infer types from schema', async () => {
      const result = await dataProvider.getList({ resource: 'users' });

      // TypeScript should understand the structure
      const user = result.data[0];
      expect(typeof user.id).toBe('number');
      expect(typeof user.name).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(['active', 'inactive', 'pending']).toContain(user.status);
    });
  });

  // v0.4.0 Features
  describe('custom() method - v0.4.0', () => {
    it('should execute raw SQL query', async () => {
      const result = await dataProvider.custom({
        url: 'query',
        method: 'post',
        payload: { sql: 'SELECT * FROM users WHERE age > 30' },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((u: any) => u.age > 30)).toBe(true);
    });

    it('should execute raw SQL with parameters', async () => {
      const result = await dataProvider.custom({
        url: 'query',
        method: 'post',
        payload: {
          sql: 'SELECT * FROM users WHERE status = ? AND age >= ?',
          args: ['active', 30],
        },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.every((u: any) => u.status === 'active')).toBe(true);
    });

    it('should execute INSERT/UPDATE/DELETE statements', async () => {
      const result = await dataProvider.custom({
        url: 'execute',
        method: 'post',
        payload: {
          sql: 'UPDATE users SET status = ? WHERE id = ?',
          args: ['active', 1],
        },
      });

      expect(result.data).toBeDefined();
    });

    it('should throw error for unsupported operations', async () => {
      await expect(
        dataProvider.custom({
          url: 'unsupported',
          method: 'post',
          payload: {},
        }),
      ).rejects.toThrow(/Unsupported custom operation/);
    });
  });

  describe('Field Selection - v0.4.0', () => {
    it('should select specific fields', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        meta: { select: ['id', 'name', 'email'] },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      const user = result.data[0];
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      // age should not be present
      expect(user.age).toBeUndefined();
    });

    it('should exclude specific fields', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        meta: { exclude: ['age', 'status'] },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      const user = result.data[0];
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      // age and status should not be present
      expect(user.age).toBeUndefined();
      expect(user.status).toBeUndefined();
    });
  });

  describe('Aggregation Queries - v0.4.0', () => {
    it('should perform basic aggregations', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        meta: {
          aggregations: {
            totalUsers: { count: '*' },
            avgAge: { avg: 'age' },
            minAge: { min: 'age' },
            maxAge: { max: 'age' },
          },
        },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBe(1);
      const stats = result.data[0];
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(Number(stats.avgAge)).toBeGreaterThan(0);
      expect(stats.minAge).toBeDefined();
      expect(stats.maxAge).toBeDefined();
    });

    it('should perform aggregations with groupBy', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        meta: {
          aggregations: { count: { count: '*' }, avgAge: { avg: 'age' } },
          groupBy: ['status'],
        },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(1);
      // Each group should have status and aggregation results
      result.data.forEach((group: any) => {
        expect(group.status).toBeDefined();
        expect(group.count).toBeGreaterThan(0);
        if (group.avgAge !== null) {
          expect(Number(group.avgAge)).toBeGreaterThan(0);
        }
      });
    });

    it('should perform aggregations with filters', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
        meta: {
          aggregations: { totalActive: { count: '*' }, avgAge: { avg: 'age' } },
        },
      });

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBe(1);
      const stats = result.data[0];
      // Should count active users only
      expect(stats.totalActive).toBeGreaterThan(0);
      expect(Number(stats.avgAge)).toBeGreaterThan(0);
    });
  });
});
