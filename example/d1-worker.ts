/**
 * Cloudflare D1 Worker Example for refine-sqlx v0.3.0
 *
 * This example demonstrates:
 * - Using the optimized D1 build (refine-sqlx/d1)
 * - Type-safe schema with Drizzle ORM
 * - Complete CRUD operations in Workers environment
 * - Proper error handling
 * - D1 batch operations for bulk inserts
 * - Time Travel configuration
 *
 * 📝 Note: All batch operations are 100% API compatible between packages:
 *    - import { createRefineSQL, batchInsert, DEFAULT_BATCH_SIZE } from 'refine-sqlx';
 *    - import { createRefineSQL, batchInsert, DEFAULT_BATCH_SIZE } from 'refine-sqlx/d1';
 *    Both use the exact same API - only the import path differs for bundle optimization!
 */

import type { D1Database } from '@cloudflare/workers-types';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { batchInsert, createRefineSQL } from 'refine-sqlx/d1';

// Define schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', {
    enum: ['active', 'inactive', 'suspended'],
  }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['draft', 'published', 'archived'] })
    .notNull()
    .default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const schema = { users, posts };

// Environment bindings
export interface Env {
  DB: D1Database;
}

// Worker handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create data provider (optimized D1 build with batch configuration)
    // Note: You can also use 'refine-sqlx' (main package) with identical API
    const dataProvider = await createRefineSQL({
      connection: env.DB,
      schema,
      d1Options: {
        batch: { maxSize: 50 }, // D1 recommended batch size
        // Uncomment to enable Time Travel awareness
        // timeTravel: { enabled: true, bookmark: 'before-migration' }
      },
    });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route: GET /users - List all users
      if (path === '/users' && request.method === 'GET') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
        const status = url.searchParams.get('status');

        const result = await dataProvider.getList({
          resource: 'users',
          filters:
            status ? [{ field: 'status', operator: 'eq', value: status }] : [],
          pagination: { current: page, pageSize },
          sorters: [{ field: 'createdAt', order: 'desc' }],
        });

        return Response.json(result);
      }

      // Route: GET /users/:id - Get single user
      if (path.startsWith('/users/') && request.method === 'GET') {
        const id = parseInt(path.split('/')[2]);
        const result = await dataProvider.getOne({ resource: 'users', id });

        return Response.json(result);
      }

      // Route: POST /users - Create user
      if (path === '/users' && request.method === 'POST') {
        const body = await request.json();
        const result = await dataProvider.create({
          resource: 'users',
          variables: { ...body, createdAt: new Date() },
        });

        return Response.json(result, { status: 201 });
      }

      // Route: PUT /users/:id - Update user
      if (path.startsWith('/users/') && request.method === 'PUT') {
        const id = parseInt(path.split('/')[2]);
        const body = await request.json();
        const result = await dataProvider.update({
          resource: 'users',
          id,
          variables: body,
        });

        return Response.json(result);
      }

      // Route: DELETE /users/:id - Delete user
      if (path.startsWith('/users/') && request.method === 'DELETE') {
        const id = parseInt(path.split('/')[2]);
        const result = await dataProvider.deleteOne({ resource: 'users', id });

        return Response.json(result);
      }

      // Route: GET /posts - List posts
      if (path === '/posts' && request.method === 'GET') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '10');

        const result = await dataProvider.getList({
          resource: 'posts',
          pagination: { current: page, pageSize },
          sorters: [{ field: 'createdAt', order: 'desc' }],
        });

        return Response.json(result);
      }

      // Route: POST /posts - Create post
      if (path === '/posts' && request.method === 'POST') {
        const body = await request.json();
        const result = await dataProvider.create({
          resource: 'posts',
          variables: { ...body, createdAt: new Date() },
        });

        return Response.json(result, { status: 201 });
      }

      // Route: POST /init - Initialize database (demo only)
      if (path === '/init' && request.method === 'POST') {
        // Create tables
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'suspended')),
            created_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
            created_at INTEGER NOT NULL
          );
        `);

        // Insert sample data using optimized batch operations
        const sampleUsers = [
          {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            status: 'active' as const,
            createdAt: new Date(),
          },
          {
            name: 'Bob Smith',
            email: 'bob@example.com',
            status: 'active' as const,
            createdAt: new Date(),
          },
          {
            name: 'Charlie Brown',
            email: 'charlie@example.com',
            status: 'active' as const,
            createdAt: new Date(),
          },
        ];

        // Use batchInsert for optimal performance with large datasets
        const users = await batchInsert(dataProvider, 'users', sampleUsers);

        return Response.json({
          message: 'Database initialized successfully',
          usersCreated: users.length,
        });
      }

      // Route: POST /bulk-users - Bulk insert users (demonstrates batch operations)
      if (path === '/bulk-users' && request.method === 'POST') {
        const body = (await request.json()) as {
          users: Array<{ name: string; email: string; status: string }>;
        };

        // batchInsert automatically handles D1's batch limits
        const users = await batchInsert(
          dataProvider,
          'users',
          body.users.map((u) => ({ ...u, createdAt: new Date() })),
        );

        return Response.json(
          {
            message: `Successfully created ${users.length} users`,
            data: users,
          },
          { status: 201 },
        );
      }

      // 404 Not Found
      return Response.json({ error: 'Not Found' }, { status: 404 });
    } catch (error: any) {
      // Error handling
      return Response.json(
        {
          error: error.message || 'Internal Server Error',
          details: error.stack,
        },
        { status: 500 },
      );
    }
  },
};
