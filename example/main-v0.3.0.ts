/**
 * refine-sqlx v0.3.0 Example
 *
 * This example demonstrates:
 * - Drizzle ORM schema definitions
 * - Type-safe data provider creation
 * - Filtering, sorting, and pagination
 * - CRUD operations with full type inference
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { createRefineSQL } from '../src/provider';
import * as schema from './schema';
import type { NewPost, NewUser, Post, User } from './schema';

// Initialize database
const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

// Create tables
sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'suspended')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  );

  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    published_at INTEGER,
    created_at INTEGER NOT NULL
  );
`);

// Create data provider
const dataProvider = createRefineSQL({
  connection: sqlite,
  schema,
});

async function main() {
  console.log('🚀 refine-sqlx v0.3.0 Example\n');

  // ===== CREATE =====
  console.log('📝 Creating users...');
  const user1 = await dataProvider.create<User, NewUser>({
    resource: 'users',
    variables: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      status: 'active',
      createdAt: new Date(),
    },
  });
  console.log('Created user:', user1.data);

  const user2 = await dataProvider.create<User, NewUser>({
    resource: 'users',
    variables: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      status: 'active',
      createdAt: new Date(),
    },
  });
  console.log('Created user:', user2.data);

  // Create many
  const moreUsers = await dataProvider.createMany<User, NewUser>({
    resource: 'users',
    variables: [
      {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        status: 'inactive',
        createdAt: new Date(),
      },
      {
        name: 'Diana Prince',
        email: 'diana@example.com',
        status: 'suspended',
        createdAt: new Date(),
      },
    ],
  });
  console.log(`Created ${moreUsers.data.length} more users\n`);

  // ===== CREATE POSTS =====
  console.log('📄 Creating posts...');
  await dataProvider.createMany<Post, NewPost>({
    resource: 'posts',
    variables: [
      {
        title: 'Getting Started with Drizzle ORM',
        content: 'Drizzle ORM is a type-safe ORM for TypeScript...',
        userId: user1.data.id,
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
      },
      {
        title: 'Building with Refine',
        content: 'Refine is a powerful React framework...',
        userId: user1.data.id,
        status: 'draft',
        createdAt: new Date(),
      },
      {
        title: 'Cloudflare D1 Tutorial',
        content: 'D1 is Cloudflare\'s serverless database...',
        userId: user2.data.id,
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ],
  });
  console.log('Created 3 posts\n');

  // ===== GET LIST with Filters =====
  console.log('🔍 Filtering active users...');
  const activeUsers = await dataProvider.getList<User>({
    resource: 'users',
    filters: [
      { field: 'status', operator: 'eq', value: 'active' },
    ],
    pagination: { current: 1, pageSize: 10 },
  });
  console.log(`Found ${activeUsers.total} active users:`, activeUsers.data);

  // Complex filtering
  console.log('\n🔍 Finding users with names containing "a"...');
  const filteredUsers = await dataProvider.getList<User>({
    resource: 'users',
    filters: [
      { field: 'name', operator: 'contains', value: 'a' },
    ],
    sorters: [{ field: 'name', order: 'asc' }],
    pagination: { current: 1, pageSize: 10 },
  });
  console.log(`Found ${filteredUsers.total} users:`, filteredUsers.data.map(u => u.name));

  // ===== GET LIST with Sorting =====
  console.log('\n📊 Getting posts sorted by title...');
  const posts = await dataProvider.getList<Post>({
    resource: 'posts',
    sorters: [{ field: 'title', order: 'asc' }],
    pagination: { current: 1, pageSize: 10 },
  });
  console.log(`Found ${posts.total} posts:`, posts.data.map(p => p.title));

  // Filter posts by status
  console.log('\n📊 Getting published posts...');
  const publishedPosts = await dataProvider.getList<Post>({
    resource: 'posts',
    filters: [
      { field: 'status', operator: 'eq', value: 'published' },
    ],
    pagination: { current: 1, pageSize: 10 },
  });
  console.log(`Found ${publishedPosts.total} published posts`);

  // ===== GET ONE =====
  console.log('\n👤 Getting user by ID...');
  const fetchedUser = await dataProvider.getOne<User>({
    resource: 'users',
    id: user1.data.id,
  });
  console.log('Fetched user:', fetchedUser.data.name);

  // ===== GET MANY =====
  console.log('\n👥 Getting multiple users by IDs...');
  const users = await dataProvider.getMany<User>({
    resource: 'users',
    ids: [user1.data.id, user2.data.id],
  });
  console.log('Fetched users:', users.data.map(u => u.name));

  // ===== UPDATE =====
  console.log('\n✏️  Updating user...');
  const updatedUser = await dataProvider.update<User>({
    resource: 'users',
    id: user1.data.id,
    variables: {
      status: 'inactive',
      updatedAt: new Date(),
    },
  });
  console.log('Updated user status:', updatedUser.data.status);

  // ===== UPDATE MANY =====
  console.log('\n✏️  Bulk updating users...');
  const updatedUsers = await dataProvider.updateMany<User>({
    resource: 'users',
    ids: [user1.data.id, user2.data.id],
    variables: {
      updatedAt: new Date(),
    },
  });
  console.log(`Updated ${updatedUsers.data.length} users`);

  // ===== DELETE ONE =====
  console.log('\n🗑️  Deleting a user...');
  const deletedUser = await dataProvider.deleteOne<User>({
    resource: 'users',
    id: user1.data.id,
  });
  console.log('Deleted user:', deletedUser.data.name);

  // ===== DELETE MANY =====
  console.log('\n🗑️  Bulk deleting users...');
  const deletedUsers = await dataProvider.deleteMany<User>({
    resource: 'users',
    ids: [user2.data.id],
  });
  console.log(`Deleted ${deletedUsers.data.length} users`);

  // Final count
  const remainingUsers = await dataProvider.getList<User>({
    resource: 'users',
    pagination: { current: 1, pageSize: 100 },
  });
  console.log(`\n✅ Example complete! Remaining users: ${remainingUsers.total}`);
}

main().catch(console.error);
