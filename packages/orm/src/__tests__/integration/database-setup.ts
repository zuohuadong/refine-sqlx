/**
 * Database setup utilities for integration tests
 * Provides real database connections for testing all supported databases
 */

import {
  pgTable,
  serial,
  text,
  varchar as pgVarchar,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import {
  mysqlTable,
  int,
  varchar as mysqlVarchar,
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
} from '../../index';
import type { RefineOrmDataProvider } from '../../types/client';

// PostgreSQL Schema
export const pgUsers = pgTable('users', {
  id: serial('id').primaryKey(),
  name: pgVarchar('name', { length: 255 }).notNull(),
  email: pgVarchar('email', { length: 255 }).notNull().unique(),
  age: integer('age'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const pgPosts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: pgVarchar('title', { length: 255 }).notNull(),
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
  name: mysqlVarchar('name', { length: 255 }).notNull(),
  email: mysqlVarchar('email', { length: 255 }).notNull().unique(),
  age: int('age'),
  isActive: tinyint('is_active').default(1),
  createdAt: datetime('created_at', { mode: 'date' }).default(
    sql`CURRENT_TIMESTAMP`
  ),
});

export const mysqlPosts = mysqlTable('posts', {
  id: int('id').primaryKey().autoincrement(),
  title: mysqlVarchar('title', { length: 255 }).notNull(),
  content: mysqlText('content'),
  userId: int('user_id').references(() => mysqlUsers.id),
  published: tinyint('published').default(0),
  createdAt: datetime('created_at', { mode: 'date' }).default(
    sql`CURRENT_TIMESTAMP`
  ),
});

export const mysqlComments = mysqlTable('comments', {
  id: int('id').primaryKey().autoincrement(),
  content: mysqlText('content').notNull(),
  commentableType: mysqlVarchar('commentable_type', { length: 50 }).notNull(),
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
  id: sqliteInteger('id', { mode: 'number' }).primaryKey({
    autoIncrement: true,
  }),
  name: sqliteText('name', { length: 255 }).notNull(),
  email: sqliteText('email', { length: 255 }).notNull().unique(),
  age: sqliteInteger('age', { mode: 'number' }),
  isActive: sqliteInteger('is_active', { mode: 'boolean' }).default(true),
  createdAt: sqliteText('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const sqlitePosts = sqliteTable('posts', {
  id: sqliteInteger('id', { mode: 'number' }).primaryKey({
    autoIncrement: true,
  }),
  title: sqliteText('title', { length: 255 }).notNull(),
  content: sqliteText('content'),
  userId: sqliteInteger('user_id', { mode: 'number' }).references(
    () => sqliteUsers.id
  ),
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

/**
 * Check if a specific database type is available for testing
 */
export function isTestEnvironmentReady(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): boolean {
  switch (dbType) {
    case 'postgresql':
      return !!process.env.POSTGRES_URL;
    case 'mysql':
      return !!process.env.MYSQL_URL;
    case 'sqlite':
      return true; // SQLite is always available in memory
    default:
      return false;
  }
}

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
      return await createPostgreSQLProvider({
        connection: config.connectionString,
        schema: config.schema,
      });
    case 'mysql':
      return await createMySQLProvider({
        connection: config.connectionString,
        schema: config.schema,
      });
    case 'sqlite':
      return await createSQLiteProvider({
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
      // Check if database is available first
      if (!this.isDatabaseAvailable(dbType)) {
        throw new Error(
          `${dbType.toUpperCase()} database is not available. Set ${dbType.toUpperCase()}_URL environment variable.`
        );
      }

      const provider = await createTestProvider(dbType);
      this.providers.set(dbType, provider);

      // Create tables and seed data
      await this.createTables(provider, dbType);
      // Add small delay between table creation and seeding
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.seedData(provider, dbType);

      return provider;
    } catch (error) {
      console.warn(`Failed to setup ${dbType} database:`, error);
      throw error;
    }
  }

  private isDatabaseAvailable(
    dbType: 'postgresql' | 'mysql' | 'sqlite'
  ): boolean {
    switch (dbType) {
      case 'postgresql':
        return !!process.env.POSTGRES_URL;
      case 'mysql':
        return !!process.env.MYSQL_URL;
      case 'sqlite':
        return true; // SQLite is always available in memory
      default:
        return false;
    }
  }

  async teardownDatabase(
    dbType: 'postgresql' | 'mysql' | 'sqlite'
  ): Promise<void> {
    const provider = this.providers.get(dbType);
    if (provider) {
      try {
        await this.cleanupTables(provider, dbType);
        // Add small delay to ensure cleanup completes before disconnect
        await new Promise(resolve => setTimeout(resolve, 200));

        // Disconnect if method exists
        if (
          'disconnect' in provider &&
          typeof provider.disconnect === 'function'
        ) {
          await provider.disconnect();
        }
      } catch (error) {
        console.warn(`Failed to teardown ${dbType} database:`, error);
        // Don't rethrow here - we want to clean up the provider reference
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
    try {
      if (dbType === 'sqlite') {
        // Create SQLite tables since we're using in-memory database
        await provider.raw(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            age INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            user_id INTEGER,
            published INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            commentable_type TEXT NOT NULL,
            commentable_id INTEGER NOT NULL,
            user_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        console.log(`Created SQLite tables for ${dbType}`);
      } else if (dbType === 'postgresql') {
        // Create PostgreSQL tables
        await provider.raw(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            age INTEGER,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            user_id INTEGER REFERENCES users(id),
            published BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            commentable_type TEXT NOT NULL,
            commentable_id INTEGER NOT NULL,
            user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        console.log(`Created PostgreSQL tables for ${dbType}`);
      } else if (dbType === 'mysql') {
        // Create MySQL tables
        await provider.raw(`
          CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            age INT,
            is_active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            user_id INT,
            published TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        await provider.raw(`
          CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT NOT NULL,
            commentable_type VARCHAR(50) NOT NULL,
            commentable_id INT NOT NULL,
            user_id INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        console.log(`Created MySQL tables for ${dbType}`);
      } else {
        console.log(`Tables assumed to exist for ${dbType}`);
      }
    } catch (error) {
      console.warn(`Failed to create tables for ${dbType}:`, error);
      throw error;
    }
  }

  private async seedData(
    provider: RefineOrmDataProvider<any>,
    dbType: string
  ): Promise<void> {
    try {
      // Clear existing data only if tables exist
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

      console.log(`Successfully seeded data for ${dbType}`);
    } catch (error) {
      console.error(`Failed to seed data for ${dbType}:`, error);
      throw error;
    }
  }

  private async cleanupTables(
    provider: RefineOrmDataProvider<any>,
    dbType: string
  ): Promise<void> {
    try {
      // Delete in reverse order to handle foreign key constraints
      // Use IF EXISTS for better error handling
      if (dbType === 'sqlite') {
        // For SQLite, we can check if tables exist before trying to delete from them
        try {
          await provider.raw('DELETE FROM comments WHERE 1=1');
        } catch (error) {
          // Table might not exist, that's ok
          console.debug('Comments table does not exist or is empty');
        }
        try {
          await provider.raw('DELETE FROM posts WHERE 1=1');
        } catch (error) {
          // Table might not exist, that's ok
          console.debug('Posts table does not exist or is empty');
        }
        try {
          await provider.raw('DELETE FROM users WHERE 1=1');
        } catch (error) {
          // Table might not exist, that's ok
          console.debug('Users table does not exist or is empty');
        }

        // Reset auto-increment counters if needed
        try {
          await provider.raw(
            'DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?)',
            ['users', 'posts', 'comments']
          );
        } catch (error) {
          // sqlite_sequence might not exist, that's ok
          console.debug('sqlite_sequence cleanup skipped');
        }
      } else if (dbType === 'postgresql') {
        // For PostgreSQL, use TRUNCATE with CASCADE to handle foreign keys
        try {
          await provider.raw('TRUNCATE TABLE comments, posts, users CASCADE');
          // Reset sequences
          await provider.raw('ALTER SEQUENCE users_id_seq RESTART WITH 1');
          await provider.raw('ALTER SEQUENCE posts_id_seq RESTART WITH 1');
          await provider.raw('ALTER SEQUENCE comments_id_seq RESTART WITH 1');
        } catch (error) {
          // Fallback to DELETE if TRUNCATE fails
          await provider.raw('DELETE FROM comments');
          await provider.raw('DELETE FROM posts');
          await provider.raw('DELETE FROM users');
          await provider.raw('ALTER SEQUENCE users_id_seq RESTART WITH 1');
          await provider.raw('ALTER SEQUENCE posts_id_seq RESTART WITH 1');
          await provider.raw('ALTER SEQUENCE comments_id_seq RESTART WITH 1');
        }
      } else if (dbType === 'mysql') {
        // For MySQL, disable foreign key checks temporarily
        await provider.raw('SET FOREIGN_KEY_CHECKS = 0');
        await provider.raw('DELETE FROM comments');
        await provider.raw('DELETE FROM posts');
        await provider.raw('DELETE FROM users');
        await provider.raw('ALTER TABLE users AUTO_INCREMENT = 1');
        await provider.raw('ALTER TABLE posts AUTO_INCREMENT = 1');
        await provider.raw('ALTER TABLE comments AUTO_INCREMENT = 1');
        await provider.raw('SET FOREIGN_KEY_CHECKS = 1');
      }
    } catch (error) {
      console.warn(`Failed to cleanup tables for ${dbType}:`, error);
      // Don't throw here as cleanup failures shouldn't fail tests
    }
  }
}

// Skip test helper
export function skipIfDatabaseNotAvailable(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
) {
  return !isTestEnvironmentReady(dbType);
}
