/**
 * Comprehensive integration test suite for v0.3.0
 * Tests all CRUD operations with Drizzle ORM integration
 */
import { describe, expect, it, beforeAll, isRunningInBun } from './helpers/test-adapter';
import type { DataProvider } from '@refinedev/core';
import { createRefineSQL } from '../src/provider';
import { schema, users, posts, comments } from './fixtures/schema';
import { seedUsers, seedPosts, seedComments } from './fixtures/seed';

// Import appropriate database driver based on runtime using require for compatibility
const Database = isRunningInBun
  ? require('bun:sqlite').Database
  : require('better-sqlite3');

const drizzle = isRunningInBun
  ? require('drizzle-orm/bun-sqlite').drizzle
  : require('drizzle-orm/better-sqlite3').drizzle;

describe('refine-sqlx v0.3.0 Integration Tests', () => {
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
    dataProvider = await createRefineSQL({
      connection: db,
      schema,
    });

    // Seed data
    const insertedUsers = await db.insert(users).values(seedUsers).returning();

    const postsWithUserId = seedPosts.map((post, i) => ({
      ...post,
      userId: insertedUsers[i % insertedUsers.length].id,
    }));
    const insertedPosts = await db.insert(posts).values(postsWithUserId).returning();

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
        result.data.every((u: any) => ['active', 'pending'].includes(u.status))
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
      const result = await dataProvider.getOne({
        resource: 'users',
        id: 1,
      });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('Alice Johnson');
    });

    it('should throw error for non-existent id', async () => {
      await expect(
        dataProvider.getOne({
          resource: 'users',
          id: 9999,
        })
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
      const result = await dataProvider.getMany({
        resource: 'users',
        ids: [],
      });

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
        })
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
        dataProvider.getOne({
          resource: 'users',
          id: created.data.id,
        })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent id', async () => {
      await expect(
        dataProvider.deleteOne({
          resource: 'users',
          id: 9999,
        })
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
      const result = await dataProvider.deleteMany({
        resource: 'users',
        ids,
      });

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
      const result = await dataProvider.getList({
        resource: 'users',
      });

      // TypeScript should understand the structure
      const user = result.data[0];
      expect(typeof user.id).toBe('number');
      expect(typeof user.name).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(['active', 'inactive', 'pending']).toContain(user.status);
    });
  });
});
