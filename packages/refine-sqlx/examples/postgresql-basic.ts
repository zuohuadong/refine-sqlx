/**
 * Basic PostgreSQL usage example
 * This example shows how to set up and use the PostgreSQL adapter
 */

import { pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createPostgreSQLProvider } from '../src/adapters/postgresql.js';
import { createProvider } from '../src/core/data-provider.js';

// Define your database schema using Drizzle ORM
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: serial('author_id').references(() => users.id),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Schema object for type inference
const schema = { users, posts };

async function main() {
  // Connection string - can be from environment variable
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://user:password@localhost:5432/mydb';

  try {
    // Create PostgreSQL adapter (automatically detects Bun vs Node.js)
    const adapter = createPostgreSQLProvider(connectionString, schema, {
      debug: true,
      logger: true,
      pool: { max: 10, min: 2 },
    });

    // Connect to database
    await adapter.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create Refine data provider
    const dataProvider = createProvider(adapter);

    // Example: Create a user
    const newUser = await dataProvider.create({
      resource: 'users',
      variables: { name: 'John Doe', email: 'john@example.com' },
    });
    console.log('Created user:', newUser.data);

    // Example: Get list of users
    const usersList = await dataProvider.getList({
      resource: 'users',
      pagination: { current: 1, pageSize: 10 },
      sorters: [{ field: 'createdAt', order: 'desc' }],
    });
    console.log('Users list:', usersList);

    // Example: Update user
    const updatedUser = await dataProvider.update({
      resource: 'users',
      id: newUser.data.id,
      variables: { name: 'John Smith' },
    });
    console.log('Updated user:', updatedUser.data);

    // Clean up
    await adapter.disconnect();
    console.log('✅ Disconnected from PostgreSQL');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
if (import.meta.main) {
  main();
}
