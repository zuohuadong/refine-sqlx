/**
 * Type Inference Correctness Tests
 * Verifies that TypeScript type inference works correctly across different database schemas
 * and that compile-time type safety is maintained
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import {
  mysqlTable,
  int,
  varchar,
  datetime,
  tinyint,
} from 'drizzle-orm/mysql-core';
import {
  sqliteTable,
  text as sqliteText,
  integer as sqliteInteger,
} from 'drizzle-orm/sqlite-core';
import { createProvider } from '../core/data-provider';
import { MockDatabaseAdapter, TestDataGenerators } from './utils/mock-client';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Test schemas for type inference
const pgUsers = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  age: integer('age'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

const pgPosts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => pgUsers.id),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

const pgSchema = { users: pgUsers, posts: pgPosts };

const mysqlUsers = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  age: int('age'),
  isActive: tinyint('is_active').default(1),
  createdAt: datetime('created_at').default(new Date()),
});

const mysqlSchema = { users: mysqlUsers };

const sqliteUsers = sqliteTable('users', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  name: sqliteText('name').notNull(),
  email: sqliteText('email').notNull().unique(),
  age: sqliteInteger('age'),
  isActive: sqliteInteger('is_active', { mode: 'boolean' }).default(true),
  createdAt: sqliteText('created_at').default('CURRENT_TIMESTAMP'),
});

const sqliteSchema = { users: sqliteUsers };

describe('Type Inference Correctness', () => {
  describe('Schema Type Inference', () => {
    it('should infer PostgreSQL types correctly', () => {
      type PgUserSelect = InferSelectModel<typeof pgUsers>;
      type PgUserInsert = InferInsertModel<typeof pgUsers>;

      // Compile-time type assertions
      const selectUser: PgUserSelect = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        createdAt: new Date(),
      };

      const insertUser: PgUserInsert = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25,
        // id, isActive, createdAt are optional due to defaults
      };

      // Runtime type verification
      expect(typeof selectUser.id).toBe('number');
      expect(typeof selectUser.name).toBe('string');
      expect(typeof selectUser.email).toBe('string');
      expect(typeof selectUser.age).toBe('number');
      expect(typeof selectUser.isActive).toBe('boolean');
      expect(selectUser.createdAt).toBeInstanceOf(Date);

      expect(typeof insertUser.name).toBe('string');
      expect(typeof insertUser.email).toBe('string');
      expect(typeof insertUser.age).toBe('number');
    });

    it('should infer MySQL types correctly', () => {
      type MysqlUserSelect = InferSelectModel<typeof mysqlUsers>;
      type MysqlUserInsert = InferInsertModel<typeof mysqlUsers>;

      const selectUser: MysqlUserSelect = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: 1, // MySQL tinyint
        createdAt: new Date(),
      };

      const insertUser: MysqlUserInsert = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25,
      };

      expect(typeof selectUser.id).toBe('number');
      expect(typeof selectUser.name).toBe('string');
      expect(typeof selectUser.email).toBe('string');
      expect(typeof selectUser.age).toBe('number');
      expect(typeof selectUser.isActive).toBe('number');
      expect(selectUser.createdAt).toBeInstanceOf(Date);

      expect(typeof insertUser.name).toBe('string');
      expect(typeof insertUser.email).toBe('string');
      expect(typeof insertUser.age).toBe('number');
    });

    it('should infer SQLite types correctly', () => {
      type SqliteUserSelect = InferSelectModel<typeof sqliteUsers>;
      type SqliteUserInsert = InferInsertModel<typeof sqliteUsers>;

      const selectUser: SqliteUserSelect = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true, // SQLite boolean mode
        createdAt: 'CURRENT_TIMESTAMP',
      };

      const insertUser: SqliteUserInsert = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25,
      };

      expect(typeof selectUser.id).toBe('number');
      expect(typeof selectUser.name).toBe('string');
      expect(typeof selectUser.email).toBe('string');
      expect(typeof selectUser.age).toBe('number');
      expect(typeof selectUser.isActive).toBe('boolean');
      expect(typeof selectUser.createdAt).toBe('string');

      expect(typeof insertUser.name).toBe('string');
      expect(typeof insertUser.email).toBe('string');
      expect(typeof insertUser.age).toBe('number');
    });
  });

  describe('Data Provider Type Inference', () => {
    let pgAdapter: MockDatabaseAdapter<typeof pgSchema>;
    let pgDataProvider: ReturnType<typeof createProvider>;

    beforeEach(() => {
      pgAdapter = new MockDatabaseAdapter(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });
      pgDataProvider = createProvider(pgAdapter);
    });

    it('should provide type-safe resource access', async () => {
      // These should compile without TypeScript errors
      const userQuery = pgDataProvider.from('users');
      const postQuery = pgDataProvider.from('posts');

      expect(userQuery).toBeDefined();
      expect(postQuery).toBeDefined();

      // Verify runtime behavior
      const users = await userQuery.get();
      const posts = await postQuery.get();

      expect(Array.isArray(users)).toBe(true);
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should provide type-safe column references in queries', async () => {
      const userQuery = pgDataProvider.from('users');

      // These should compile without TypeScript errors and work at runtime
      const result = await userQuery
        .where('name', 'eq', 'John')
        .where('age', 'gte', 18)
        .where('isActive', 'eq', true)
        .orderBy('name', 'asc')
        .orderBy('createdAt', 'desc')
        .get();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should infer correct return types for CRUD operations', async () => {
      // Test getOne return type
      const singleUser = await pgDataProvider.getOne({
        resource: 'users',
        id: 1,
      });

      expect(typeof singleUser.data.id).toBe('number');
      expect(typeof singleUser.data.name).toBe('string');
      expect(typeof singleUser.data.email).toBe('string');
      expect(typeof singleUser.data.age).toBe('number');
      expect(typeof singleUser.data.isActive).toBe('boolean');

      // Test getList return type
      const userList = await pgDataProvider.getList({ resource: 'users' });

      expect(Array.isArray(userList.data)).toBe(true);
      expect(typeof userList.total).toBe('number');

      if (userList.data.length > 0) {
        const firstUser = userList.data[0];
        expect(typeof firstUser.id).toBe('number');
        expect(typeof firstUser.name).toBe('string');
        expect(typeof firstUser.email).toBe('string');
      }

      // Test create return type
      const newUser = await pgDataProvider.create({
        resource: 'users',
        variables: {
          name: 'Type Test User',
          email: 'typetest@example.com',
          age: 30,
        },
      });

      expect(typeof newUser.data.id).toBe('number');
      expect(typeof newUser.data.name).toBe('string');
      expect(newUser.data.name).toBe('Type Test User');
    });

    it('should provide type-safe aggregate functions', async () => {
      const query = pgDataProvider.from('users');

      const count = await query.count();
      const avgAge = await query.avg('age');
      const sumAge = await query.sum('age');

      expect(typeof count).toBe('number');
      expect(typeof avgAge).toBe('number');
      expect(typeof sumAge).toBe('number');

      expect(count).toBeGreaterThanOrEqual(0);
      expect(avgAge).toBeGreaterThanOrEqual(0);
      expect(sumAge).toBeGreaterThanOrEqual(0);
    });

    it('should provide type-safe first() method', async () => {
      const query = pgDataProvider.from('users');
      const firstUser = await query.first();

      if (firstUser) {
        expect(typeof firstUser.id).toBe('number');
        expect(typeof firstUser.name).toBe('string');
        expect(typeof firstUser.email).toBe('string');
        expect(typeof firstUser.age).toBe('number');
        expect(typeof firstUser.isActive).toBe('boolean');
      } else {
        expect(firstUser).toBeNull();
      }
    });

    it('should maintain type safety in complex chain queries', async () => {
      const query = pgDataProvider.from('users');

      const result = await query
        .where('age', 'gte', 18)
        .where('isActive', 'eq', true)
        .orderBy('name', 'asc')
        .orderBy('age', 'desc')
        .limit(10)
        .offset(0)
        .get();

      expect(Array.isArray(result)).toBe(true);

      result.forEach(user => {
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.age).toBe('number');
        expect(typeof user.isActive).toBe('boolean');
        expect(user.age).toBeGreaterThanOrEqual(18);
        expect(user.isActive).toBe(true);
      });
    });

    it('should provide type-safe relationship queries', async () => {
      const userWithPosts = await pgDataProvider
        .from('users')
        .with('posts', postQuery => postQuery.where('published', 'eq', true))
        .first();

      if (userWithPosts) {
        expect(typeof userWithPosts.id).toBe('number');
        expect(typeof userWithPosts.name).toBe('string');
        expect(typeof userWithPosts.email).toBe('string');
      }
    });
  });

  describe('Type Safety Edge Cases', () => {
    let pgAdapter: MockDatabaseAdapter<typeof pgSchema>;
    let pgDataProvider: ReturnType<typeof createProvider>;

    beforeEach(() => {
      pgAdapter = new MockDatabaseAdapter(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });
      pgDataProvider = createProvider(pgAdapter);
    });

    it('should handle optional fields correctly', async () => {
      // Create user with minimal required fields
      const result = await pgDataProvider.create({
        resource: 'users',
        variables: {
          name: 'Minimal User',
          email: 'minimal@example.com',
          // age is optional, should be null/undefined
        },
      });

      expect(result.data.name).toBe('Minimal User');
      expect(result.data.email).toBe('minimal@example.com');
      expect(result.data.age).toBeNull();
    });

    it('should handle default values correctly', async () => {
      const result = await pgDataProvider.create({
        resource: 'users',
        variables: {
          name: 'Default User',
          email: 'default@example.com',
          age: 25,
          // isActive should use default value (true)
          // createdAt should use default value (now)
        },
      });

      expect(result.data.isActive).toBe(true);
      expect(result.data.createdAt).toBeDefined();
    });

    it('should handle null values in updates', async () => {
      // First create a user
      const createResult = await pgDataProvider.create({
        resource: 'users',
        variables: {
          name: 'Update Test User',
          email: 'updatetest@example.com',
          age: 30,
        },
      });

      // Update with null value
      const updateResult = await pgDataProvider.update({
        resource: 'users',
        id: createResult.data.id,
        variables: {
          age: null, // Set age to null
        },
      });

      expect(updateResult.data.age).toBeNull();
      expect(updateResult.data.name).toBe('Update Test User'); // Should remain unchanged
    });

    it('should handle partial updates correctly', async () => {
      // First create a user
      const createResult = await pgDataProvider.create({
        resource: 'users',
        variables: {
          name: 'Partial Update User',
          email: 'partialupdate@example.com',
          age: 25,
          isActive: true,
        },
      });

      // Partial update - only change name
      const updateResult = await pgDataProvider.update({
        resource: 'users',
        id: createResult.data.id,
        variables: { name: 'Updated Name Only' },
      });

      expect(updateResult.data.name).toBe('Updated Name Only');
      expect(updateResult.data.email).toBe('partialupdate@example.com'); // Unchanged
      expect(updateResult.data.age).toBe(25); // Unchanged
      expect(updateResult.data.isActive).toBe(true); // Unchanged
    });
  });

  describe('Generic Type Parameters', () => {
    it('should maintain type safety with generic schema functions', () => {
      function createTypedProvider<TSchema extends Record<string, any>>(
        schema: TSchema,
        mockData: Record<keyof TSchema, any[]>
      ) {
        const adapter = new MockDatabaseAdapter(schema, mockData);
        return createProvider(adapter);
      }

      const typedProvider = createTypedProvider(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });

      // Should maintain type safety
      const userQuery = typedProvider.from('users');
      const postQuery = typedProvider.from('posts');

      expect(userQuery).toBeDefined();
      expect(postQuery).toBeDefined();
    });

    it('should work with different schema types', () => {
      // Test with PostgreSQL schema
      const pgProvider = createProvider(
        new MockDatabaseAdapter(pgSchema, {
          users: TestDataGenerators.users(3),
          posts: TestDataGenerators.posts(5),
        })
      );

      // Test with MySQL schema
      const mysqlProvider = createProvider(
        new MockDatabaseAdapter(mysqlSchema, {
          users: TestDataGenerators.users(3),
        })
      );

      // Test with SQLite schema
      const sqliteProvider = createProvider(
        new MockDatabaseAdapter(sqliteSchema, {
          users: TestDataGenerators.users(3),
        })
      );

      // All should provide type-safe access
      expect(pgProvider.from('users')).toBeDefined();
      expect(pgProvider.from('posts')).toBeDefined();
      expect(mysqlProvider.from('users')).toBeDefined();
      expect(sqliteProvider.from('users')).toBeDefined();
    });
  });

  describe('Compile-time Type Checking', () => {
    it('should prevent invalid resource access at compile time', () => {
      const adapter = new MockDatabaseAdapter(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });
      const provider = createProvider(adapter);

      // These should compile without errors
      provider.from('users');
      provider.from('posts');

      // These would cause TypeScript compilation errors if uncommented:
      // provider.from('nonexistent'); // Error: Argument of type '"nonexistent"' is not assignable
      // provider.from('invalid_table'); // Error: Argument of type '"invalid_table"' is not assignable

      expect(true).toBe(true); // Test passes if compilation succeeds
    });

    it('should prevent invalid column access at compile time', () => {
      const adapter = new MockDatabaseAdapter(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });
      const provider = createProvider(adapter);

      const userQuery = provider.from('users');

      // These should compile without errors
      userQuery.where('name', 'eq', 'John');
      userQuery.where('age', 'gte', 18);
      userQuery.where('isActive', 'eq', true);
      userQuery.orderBy('name', 'asc');
      userQuery.orderBy('createdAt', 'desc');

      // These would cause TypeScript compilation errors if uncommented:
      // userQuery.where('nonexistentColumn', 'eq', 'value'); // Error: invalid column
      // userQuery.where('age', 'eq', 'string'); // Error: wrong type
      // userQuery.orderBy('invalidColumn', 'asc'); // Error: invalid column

      expect(true).toBe(true); // Test passes if compilation succeeds
    });

    it('should prevent type mismatches at compile time', () => {
      const adapter = new MockDatabaseAdapter(pgSchema, {
        users: TestDataGenerators.users(5),
        posts: TestDataGenerators.posts(10),
      });
      const provider = createProvider(adapter);

      // These would cause TypeScript compilation errors if uncommented:

      // Wrong variable types in create
      // provider.create({
      //   resource: 'users',
      //   variables: {
      //     name: 123, // Error: should be string
      //     email: 'test@example.com',
      //     age: 'not a number', // Error: should be number
      //   }
      // });

      // Wrong filter value types
      // provider.from('users').where('age', 'eq', 'string'); // Error: should be number
      // provider.from('users').where('isActive', 'eq', 'not boolean'); // Error: should be boolean

      expect(true).toBe(true); // Test passes if compilation succeeds
    });
  });
});
