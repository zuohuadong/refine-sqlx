/**
 * Migration Example: From refine-orm to refine-sql
 * 
 * refine-sql is a streamlined version of refine-orm designed for SQLite/D1 environments
 * Fully compatible with refine-orm API, enabling zero-cost migration
 */

// ===== Before Migration (refine-orm - Full Package) =====
/*
import { createPostgreSQLProvider, createMySQLProvider, createSQLiteProvider } from 'refine-orm';
import { schema } from './schema';

// refine-orm supports multiple databases
const postgresProvider = await createPostgreSQLProvider('postgresql://...', schema);
const mysqlProvider = await createMySQLProvider('mysql://...', schema);
const sqliteProvider = await createSQLiteProvider('./app.db', schema);
*/

// ===== After Migration (refine-sql - SQLite/D1 Specialized Lightweight Package) =====

import { createProvider } from '../packages/refine-sql/src/index.js';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

// Define TypeScript types for better development experience
interface BlogSchema {
  users: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    authorId: number;
    createdAt: Date;
  };
  comments: {
    id: number;
    content: string;
    postId: number;
    authorId: number;
    createdAt: Date;
  };
}

// Example usage of BlogSchema type for demonstration
type UserRecord = BlogSchema['users'];
type PostRecord = BlogSchema['posts'];

async function main() {
  console.log('🚀 Blog App Migration Example - refine-orm to refine-sql');

  // Create data provider - compatible with refine-orm API
  const dataProvider = createProvider('./blog_migration.db');

  console.log('✅ Data provider created successfully (refine-orm compatible API)');

  // Set up database tables
  await setupDatabase(dataProvider);

  // Demonstrate compatible CRUD operations
  await demonstrateCompatibleCRUD(dataProvider);

  // Demonstrate compatible chain queries
  await demonstrateCompatibleChainQueries(dataProvider);

  // Demonstrate compatible relationship queries
  await demonstrateCompatibleRelationships(dataProvider);

  console.log('🎉 Migration example completed!');
}

async function setupDatabase(dataProvider: any) {
  console.log('\n📋 Setting up database tables...');

  // Create users table
  await dataProvider.client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create posts table
  await dataProvider.client.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create comments table
  await dataProvider.client.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database tables created successfully');
}

async function demonstrateCompatibleCRUD(dataProvider: any) {
  console.log('\n📝 Demonstrating compatible CRUD operations...');

  // CREATE - Standard Refine API (fully compatible)
  console.log('\n➕ Creating users and posts...');

  const user = await dataProvider.create({
    resource: 'users',
    variables: {
      name: 'John Doe',
      email: 'john@example.com',
      created_at: new Date().toISOString()
    }
  });
  console.log('✅ User created successfully:', user.data.name);

  const post = await dataProvider.create({
    resource: 'posts',
    variables: {
      title: 'Migrating from refine-orm to refine-sql',
      content: 'This article explains how to smoothly migrate...',
      author_id: user.data.id,
      created_at: new Date().toISOString()
    }
  });
  console.log('✅ Post created successfully:', post.data.title);

  // READ - Standard Refine API (fully compatible)
  console.log('\n📋 Getting posts list...');

  const filters: CrudFilters = [
    {
      field: 'author_id',
      operator: 'eq',
      value: user.data.id
    }
  ];

  const sorters: CrudSorting = [
    {
      field: 'created_at',
      order: 'desc'
    }
  ];

  const postsList = await dataProvider.getList({
    resource: 'posts',
    filters,
    sorters,
    pagination: {
      current: 1,
      pageSize: 10,
      mode: 'server'
    }
  });
  console.log(`✅ Found ${postsList.data.length} posts`);

  // UPDATE - Standard Refine API (fully compatible)
  console.log('\n✏️ Updating post...');

  const updatedPost = await dataProvider.update({
    resource: 'posts',
    id: post.data.id,
    variables: {
      title: 'Migrating from refine-orm to refine-sql (Updated)',
      content: 'This article explains how to smoothly migrate, including detailed steps...'
    }
  });
  console.log('✅ Post updated successfully:', updatedPost.data.title);
}

async function demonstrateCompatibleChainQueries(dataProvider: any) {
  console.log('\n⛓️ Demonstrating compatible chain queries...');

  // Using refine-orm compatible chain query API
  console.log('\n🔗 Using compatible chain query methods...');

  // Method 1: Using compatible convenience methods (same as refine-orm)
  const recentPosts = await dataProvider
    .from('posts')
    .where('author_id', 'nnull', null)  // New generic method
    .orderBy('created_at', 'desc')      // New generic method
    .limit(5)
    .get();
  console.log(`✅ Found ${recentPosts.length} recent posts (using new generic API)`);

  // Method 2: Using unified API (recommended)
  const popularPosts = await dataProvider
    .from('posts')
    .where('author_id', 'nnull', null)
    .orderBy('created_at', 'desc')
    .limit(5)
    .get();
  console.log(`✅ Found ${popularPosts.length} posts (using unified API)`);

  // Complex queries - Compatible API
  console.log('\n🧪 Complex query examples...');

  const complexQuery = await dataProvider
    .from('posts')
    .where('title', 'contains', 'Migrating')  // New generic method
    .where('id', 'gt', 0)                     // New generic method
    .orderBy('title', 'asc')                  // New generic method
    .limit(10)
    .get();
  console.log(`✅ Complex query found ${complexQuery.length} posts`);

  // Aggregate queries
  console.log('\n📊 Aggregate queries...');

  const totalPosts = await dataProvider
    .from('posts')
    .count();
  console.log(`✅ Total posts: ${totalPosts}`);

  const firstPost = await dataProvider
    .from('posts')
    .orderBy('created_at', 'asc')       // New generic method
    .first();
  console.log(`✅ First post: ${firstPost?.title || 'None'}`);
}

async function demonstrateCompatibleRelationships(dataProvider: any) {
  console.log('\n🔗 Demonstrating compatible relationship queries...');

  // Create some test data
  await dataProvider.create({
    resource: 'comments',
    variables: {
      content: 'This is a great migration guide!',
      post_id: 1,
      author_id: 1,
      created_at: new Date().toISOString()
    }
  });
  console.log('✅ Comment created successfully');

  // Using compatible relationship query API
  console.log('\n📚 Loading posts with relationship data...');

  // Method 1: Using compatible relationship methods
  const postsWithAuthor = await dataProvider
    .from('posts')
    .with('author')  // Simplified relationship loading
    .limit(3)
    .get();

  console.log(`✅ Loaded ${postsWithAuthor.length} posts with author information`);
  postsWithAuthor.forEach((post: any) => {
    console.log(`  - ${post.title} by ${post.author?.name || 'Unknown author'}`);
  });

  // Method 2: Manual joins for complex relationships
  const postsWithComments = await dataProvider.client.query(`
    SELECT 
      p.*,
      u.name as author_name,
      COUNT(c.id) as comment_count
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN comments c ON p.id = c.post_id
    GROUP BY p.id
    LIMIT 2
  `);

  console.log(`✅ Loaded ${postsWithComments.rows.length} posts with authors and comment counts`);
  postsWithComments.rows.forEach((post: any) => {
    console.log(`  - ${post.title}`);
    console.log(`    Author: ${post.author_name || 'Unknown'}`);
    console.log(`    Comments: ${post.comment_count || 0}`);
  });

  // Method 3: Using polymorphic relationships (compatible with refine-orm)
  console.log('\n🔄 Polymorphic relationship queries...');

  // Create attachments table for polymorphic relationships
  await dataProvider.client.execute(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      attachable_type TEXT NOT NULL,
      attachable_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create attachment
  await dataProvider.create({
    resource: 'attachments',
    variables: {
      filename: 'post-image.jpg',
      attachable_type: 'post',
      attachable_id: 1,
      created_at: new Date().toISOString()
    }
  });

  // Query polymorphic relationships
  const attachments = await dataProvider
    .from('attachments')
    .where('attachable_type', 'eq', 'post')
    .get();

  console.log(`✅ Found ${attachments.length} post attachments`);
}

// Run example
if (import.meta.main) {
  main().catch(console.error);
}

export { main as runMigrationExample };