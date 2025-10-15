import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Example schema definitions for refine-sqlx v0.3.0
 *
 * These schemas demonstrate:
 * - Type-safe schema definitions with Drizzle ORM
 * - Auto-increment primary keys
 * - Enum types for status fields
 * - Timestamps with proper mode
 * - Foreign key relationships
 */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', {
    enum: ['active', 'inactive', 'suspended'],
  }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['draft', 'published', 'archived'],
  })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Type inference examples
export type User = typeof users.$inferSelect; // Query type
export type NewUser = typeof users.$inferInsert; // Insert type

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
