/**
 * Database setup utilities for integration tests
 * Provides real database connections for testing all supported databases
 */

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
  text as mysqlText,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text as sqliteText,
  integer as sqliteInteger,
} from 'drizzle-orm/sqlite-core';
import {
  createPostgreSQLProvider,
  createMySQLProvider,
  createSQLiteProvider,
} from '../../index.js';
import type { RefineOrmDataProvider } from '../../types/client.js';

// PostgreSQL Schema
export const pgUsers = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name', { length: 255 }).notNull(),
  email: text('email', { length: 255 }).notNull().unique(),
  age: integer('age'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const pgPosts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title', { length: 255 }).notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => pgUsers.id),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const pgComments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  commentableType: text('commentable_type').notNull(), // 'post' or 'user'
  commentableId: integer('commentable_id').notNull(),
  userId: integer('user_id').references(() => pgUsers.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pgSchema = {
  users: pgUsers,
  posts: pgPosts,
  comments: pgComments,
};

// MySQL Schema
export const mysqlUsers = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  age: int('age'),
  isActive: tinyint('is_active').default(1),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlPosts = mysqlTable('posts', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  content: mysqlText('content'),
  userId: int('user_id').references(() => mysqlUsers.id),
  published: tinyint('published').default(0),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlComments = mysqlTable('comments', {
  id: int('id').primaryKey().autoincrement(),
  content: mysqlText('content').notNull(),
  commentableType: varchar('commentable_type', { length: 50 }).notNull(),
  commentableId: int('commentable_id').notNull(),
  userId: int('user_id').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').default(new Date()),
});

export const mysqlSchema = {
  users: mysqlUsers,
  posts: mysqlPosts,
  comments: mysqlComments,
};

// SQLite Schema
export const sqliteUsers = sqliteTable('users', {
  id: sqliteInteger('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: sqliteText('name', { length: 255 }).notNull(),
  email: sqliteText('email', { length: 255 }).notNull().unique(),
  age: sqliteInteger('age', { mode: 'number' }),
  isActive: sqliteInteger('is_active', { mode: 'boolean' }).default(true),
  createdAt: sqliteText('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const sqlitePosts = sqliteTable('posts', {
  id: sqliteInteger('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: sqliteText('title', { length: 255 }).notNull(),
  content: sqliteText('content'),
  userId: sqliteInteger('user_id', { mode: 'number' }).references(() => sqliteUsers.id),
  published: sqliteInteger('published', { mode: 'boolean' }).default(false),
  createdAt: sqliteText('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const sqliteComments = sqliteTable('comments', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  content: sqliteText('content').notNull(),
  commentableType: sqliteText('commentable_type').notNull(),
  commentableId: sqliteInteger('commentable_id').notNull(),
  userId: sqliteInteger('user_id').references(() => sqliteUsers.id),
  createdAt: sqliteText('created_at').default('CURRENT_TIMESTAMP'),
});

export const sqliteSchema = {
  users: sqliteUsers,
  posts: sqlitePosts,
  comments: sqliteComments,
};

// Database connection configurations
export const DATABASE_CONFIGS = {
  postgresql: {
    connectionString:
      process.env.POSTGRES_URL ||
      'postgresql://test:test@localhost:5432/refine_orm_test',
    schema: pgSchema,
  },
  mysql: {
    connectionString:
      process.env.MYSQL_URL ||
      'mysql://test:test@localhost:3306/refine_orm_test',
    schema: mysqlSchema,
  },
  sqlite: {
    connectionString: process.env.SQLITE_URL || ':memory:',
    schema: sqliteSchema,
  },
};

// Test data generators
export const TEST_DATA = {
  users: [
    { name: 'John Doe', email: 'john@example.com', age: 30, isActive: true },
    { name: 'Jane Smith', email: 'jane@example.com', age: 25, isActive: true },
    { name: 'Bob Johnson', email: 'bob@example.com', age: 35, isActive: false },
  ],
  posts: [
    {
      title: 'First Post',
      content: 'This is the first post',
      userId: 1,
      published: true,
    },
    {
      title: 'Second Post',
      content: 'This is the second post',
      userId: 1,
      published: false,
    },
    {
      title: 'Third Post',
      content: 'This is the third post',
      userId: 2,
      published: true,
    },
  ],
  comments: [
    {
      content: 'Great post!',
      commentableType: 'post',
      commentableId: 1,
      userId: 2,
    },
    {
      content: 'Nice work!',
      commentableType: 'post',
      commentableId: 1,
      userId: 3,
    },
    {
      content: 'Hello there!',
      commentableType: 'user',
      commentableId: 1,
      userId: 2,
    },
  ],
};

// Database provider factory
export async function createTestProvider(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): Promise<RefineOrmDataProvider<any>> {
  const config = DATABASE_CONFIGS[dbType];

  switch (dbType) {
    case 'postgresql':
      return createPostgreSQLProvider({
        connection: config.connectionString,
        schema: config.schema,
      });
    case 'mysql':
      return createMySQLProvider({
        connection: config.connectionString,
        schema: config.schema,
      });
    case 'sqlite':
      return createSQLiteProvider({
        connection: config.connectionString,
        schema: config.schema,
      });
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

// Database setup and teardown utilities
export class DatabaseTestSetup {
  private providers: Map<string, RefineOrmDataProvider<any>> = new Map();

  async setupDatabase(
    dbType: 'postgresql' | 'mysql' | 'sqlite'
  ): Promise<RefineOrmDataProvider<any>> {
    try {
      const provider = await createTestProvider(dbType);
      this.providers.set(dbType, provider);

      // Create tables and seed data
      await this.createTables(provider, dbType);
      await this.seedData(provider, dbType);

      return provider;
    } catch (error) {
      console.warn(`Failed to setup ${dbType} database:`, error);
      throw error;
    }
  }

  async teardownDatabase(
    dbType: 'postgresql' | 'mysql' | 'sqlite'
  ): Promise<void> {
    const provider = this.providers.get(dbType);
    if (provider) {
      try {
        await this.cleanupTables(provider, dbType);
        // Disconnect if method exists
        // if ('disconnect' in provider && typeof provider.disconnect === 'function') {
        //   await provider.disconnect();
        // }
      } catch (error) {
        console.warn(`Failed to teardown ${dbType} database:`, error);
      }
      this.providers.delete(dbType);
    }
  }

  async teardownAll(): Promise<void> {
    const teardownPromises = Array.from(this.providers.keys()).map(dbType =>
      this.teardownDatabase(dbType as any)
    );
    await Promise.all(teardownPromises);
  }

  private async createTables(
    provider: RefineOrmDataProvider<any>,
    dbType: string
  ): Promise<void> {
    // For integration tests, we assume tables are already created
    // In a real scenario, you would run migrations here
    console.log(`Tables assumed to exist for ${dbType}`);
  }

  private async seedData(
    provider: RefineOrmDataProvider<any>,
    dbType: string
  ): Promise<void> {
    try {
      // Clear existing data
      await this.cleanupTables(provider, dbType);

      // Insert test users
      for (const userData of TEST_DATA.users) {
        await provider.create({ resource: 'users', variables: userData });
      }

      // Insert test posts
      for (const postData of TEST_DATA.posts) {
        await provider.create({ resource: 'posts', variables: postData });
      }

      // Insert test comments
      for (const commentData of TEST_DATA.comments) {
        await provider.create({ resource: 'comments', variables: commentData });
      }
    } catch (error) {
      console.warn(`Failed to seed data for ${dbType}:`, error);
      // Don't throw here, as some tests might not need seeded data
    }
  }

  private async cleanupTables(
    provider: RefineOrmDataProvider<any>,
    dbType: string
  ): Promise<void> {
    try {
      // Delete in reverse order to handle foreign key constraints
      await provider.executeRaw('DELETE FROM comments');
      await provider.executeRaw('DELETE FROM posts');
      await provider.executeRaw('DELETE FROM users');

      // Reset auto-increment counters if needed
      if (dbType === 'sqlite') {
        await provider.executeRaw(
          'DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?)',
          ['users', 'posts', 'comments']
        );
      } else if (dbType === 'mysql') {
        await provider.executeRaw('ALTER TABLE users AUTO_INCREMENT = 1');
        await provider.executeRaw('ALTER TABLE posts AUTO_INCREMENT = 1');
        await provider.executeRaw('ALTER TABLE comments AUTO_INCREMENT = 1');
      } else if (dbType === 'postgresql') {
        await provider.executeRaw('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        await provider.executeRaw('ALTER SEQUENCE posts_id_seq RESTART WITH 1');
        await provider.executeRaw(
          'ALTER SEQUENCE comments_id_seq RESTART WITH 1'
        );
      }
    } catch (error) {
      console.warn(`Failed to cleanup tables for ${dbType}:`, error);
    }
  }
}

// Test environment detection
export function isTestEnvironmentReady(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): boolean {
  switch (dbType) {
    case 'postgresql':
      return !!process.env.POSTGRES_URL;
    case 'mysql':
      return !!process.env.MYSQL_URL;
    case 'sqlite':
      return true; // SQLite always available (in-memory)
    default:
      return false;
  }
}

// Skip test helper
export function skipIfDatabaseNotAvailable(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
) {
  return !isTestEnvironmentReady(dbType);
}
