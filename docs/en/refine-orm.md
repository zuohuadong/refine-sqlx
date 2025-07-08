# Refine-ORM Documentation

## Overview

Refine-ORM is a powerful data provider plugin for Refine that integrates Drizzle ORM with multi-runtime support. It provides type-safe database operations across Cloudflare D1, Node.js SQLite, and Bun SQLite environments while maintaining the familiar Drizzle ORM API.

## Features

- **Drizzle ORM Integration**: Full compatibility with Drizzle ORM schemas and queries
- **Multi-Runtime Support**: Automatic runtime detection and adaptation for D1, Node.js, and Bun
- **Type Safety**: End-to-end type safety with Drizzle schemas
- **Flexible Queries**: Support for both standard CRUD operations and custom ORM queries
- **Auto Migration**: Automatic parameter placeholder conversion across different SQL dialects
- **Performance Optimized**: Efficient query generation with Drizzle's query builder
- **Refine Integration**: Seamless integration with Refine's data provider interface

## Installation

```bash
npm install refine-orm drizzle-orm
# or
yarn add refine-orm drizzle-orm
# or
pnpm add refine-orm drizzle-orm
```

### Runtime-Specific Dependencies

Choose the appropriate database driver for your runtime:

```bash
# For Cloudflare D1
npm install @cloudflare/workers-types

# For Node.js SQLite
npm install better-sqlite3 drizzle-orm

# For Bun SQLite
# No additional dependencies needed (built-in)
```

## Quick Start

### Define Your Schema

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});
```

### Cloudflare D1 Setup

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// In Cloudflare Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.DB, { schema });
    
    const dataProvider = ormDataProvider({
      db,
      schema,
      runtime: 'd1'
    });
    
    // Use with Refine
    return handleRefineRequest(dataProvider);
  }
};
```

### Node.js SQLite Setup

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema });

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime: 'node' // or auto-detect with 'auto'
});
```

### Bun SQLite Setup

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema });

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime: 'bun' // or auto-detect with 'auto'
});
```

### Auto Runtime Detection

```typescript
import { ormDataProvider } from 'refine-orm';
import { createDrizzleConnection } from 'refine-orm/runtime';
import * as schema from './schema';

// Automatically detects runtime and creates appropriate connection
const { db, runtime } = await createDrizzleConnection({
  databasePath: 'database.db', // For SQLite runtimes
  // d1Database: env.DB        // For D1 runtime
});

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime // Auto-detected runtime
});
```

## API Reference

### ormDataProvider(config)

Creates an ORM-based data provider instance.

**Parameters:**
- `config.db`: Drizzle database instance
- `config.schema`: Drizzle schema object
- `config.runtime`: Runtime type ('d1' | 'node' | 'bun' | 'auto')

**Returns:** DataProvider instance compatible with Refine

### DataProvider Methods

#### getList(params)

Retrieves a paginated list of records using Drizzle queries.

```typescript
const result = await dataProvider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  sorters: [{ field: 'name', order: 'asc' }],
  filters: [{ field: 'status', operator: 'eq', value: 'active' }]
});
```

#### getOne(params)

Retrieves a single record using Drizzle's select API.

```typescript
const result = await dataProvider.getOne({
  resource: 'users',
  id: '123'
});
```

#### create(params)

Creates a new record using Drizzle's insert API.

```typescript
const result = await dataProvider.create({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active'
  }
});
```

#### customOrm(params)

Executes custom Drizzle ORM queries with full type safety.

```typescript
import { eq, and, gte, sql } from 'drizzle-orm';

// Simple select with conditions
const result = await dataProvider.customOrm({
  query: (db, schema) => 
    db.select()
      .from(schema.users)
      .where(and(
        eq(schema.users.status, 'active'),
        gte(schema.users.createdAt, '2023-01-01')
      )),
  method: 'getList'
});

// Complex join query
const postsWithAuthors = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.posts.id,
      title: schema.posts.title,
      content: schema.posts.content,
      authorName: schema.users.name,
      authorEmail: schema.users.email
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .where(eq(schema.posts.status, 'published')),
  method: 'getList'
});

// Aggregation query
const userStats = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      status: schema.users.status,
      count: sql<number>`count(*)`,
      avgAge: sql<number>`avg(${schema.users.age})`
    })
    .from(schema.users)
    .groupBy(schema.users.status),
  method: 'getList'
});
```

**Parameters:**
- `query`: Function that receives (db, schema) and returns a Drizzle query
- `method`: Expected return type ('getList' | 'getOne' | 'getMany')

**Returns:** Based on the specified method type with full type safety

### Runtime Adapter

The runtime adapter automatically detects and configures the appropriate database connection.

#### createDrizzleConnection(config)

```typescript
import { createDrizzleConnection } from 'refine-orm/runtime';

// Auto-detect and create connection
const { db, runtime } = await createDrizzleConnection({
  databasePath: './database.db',  // For SQLite runtimes
  d1Database: env.DB,             // For D1 runtime (optional)
  schema: schema                  // Drizzle schema (optional)
});
```

**Parameters:**
- `config.databasePath`: Path to SQLite database file
- `config.d1Database`: D1 database binding (for Cloudflare Workers)
- `config.schema`: Drizzle schema object (optional)

**Returns:**
```typescript
{
  db: DrizzleDatabase,
  runtime: 'node' | 'bun' | 'd1'
}
```

## Advanced Usage

### Complex Relationships

```typescript
import { relations } from 'drizzle-orm';

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// Query with relations
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.query.users.findMany({
      with: {
        posts: true
      },
      where: eq(schema.users.status, 'active')
    }),
  method: 'getList'
});
```

### Transactions

```typescript
// D1 Batch Transaction
const result = await dataProvider.customOrm({
  query: async (db, schema) => {
    const statements = [
      db.insert(schema.users).values({ name: 'John', email: 'john@example.com' }),
      db.insert(schema.posts).values({ title: 'Hello', authorId: 1 })
    ];
    
    // D1 batch execution
    return db.batch(statements);
  },
  method: 'getList'
});

// SQLite Transaction (Node.js/Bun)
const result = await dataProvider.customOrm({
  query: async (db, schema) => {
    return db.transaction(async (tx) => {
      const user = await tx.insert(schema.users)
        .values({ name: 'John', email: 'john@example.com' })
        .returning();
      
      const post = await tx.insert(schema.posts)
        .values({ title: 'Hello', authorId: user[0].id })
        .returning();
      
      return { user: user[0], post: post[0] };
    });
  },
  method: 'getOne'
});
```

### Advanced Filtering with Drizzle

```typescript
import { eq, ne, gt, lt, gte, lte, and, or, like, inArray, isNull, isNotNull } from 'drizzle-orm';

// Complex filtering
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.status, 'active'),
          or(
            like(schema.users.name, '%john%'),
            like(schema.users.email, '%@company.com')
          ),
          gte(schema.users.createdAt, '2023-01-01'),
          isNotNull(schema.users.email)
        )
      ),
  method: 'getList'
});

// Dynamic filtering
const buildFilters = (filters: any[]) => {
  const conditions = filters.map(filter => {
    switch (filter.operator) {
      case 'eq': return eq(schema.users[filter.field], filter.value);
      case 'ne': return ne(schema.users[filter.field], filter.value);
      case 'gt': return gt(schema.users[filter.field], filter.value);
      case 'contains': return like(schema.users[filter.field], `%${filter.value}%`);
      case 'in': return inArray(schema.users[filter.field], filter.value);
      default: return undefined;
    }
  }).filter(Boolean);
  
  return conditions.length > 0 ? and(...conditions) : undefined;
};
```

### Performance Optimization

```typescript
// Use indexes effectively
const optimizedQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.status, 'active'), // Indexed field
          gte(schema.users.id, lastId)       // Primary key range
        )
      )
      .orderBy(schema.users.id)
      .limit(50),
  method: 'getList'
});

// Partial selects for large tables
const lightQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active')),
  method: 'getList'
});
```

### Schema Migrations

```typescript
// Define migrations with Drizzle
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Run migrations
await migrate(db, { migrationsFolder: './drizzle/migrations' });

// Or manually execute schema changes
await db.run(sql`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    bio TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
```

### Type-Safe Queries

```typescript
// Define typed query results
type UserWithPostCount = {
  id: number;
  name: string;
  email: string;
  postCount: number;
};

const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      postCount: sql<number>`count(${schema.posts.id})`
    })
    .from(schema.users)
    .leftJoin(schema.posts, eq(schema.users.id, schema.posts.authorId))
    .groupBy(schema.users.id) as Promise<UserWithPostCount[]>,
  method: 'getList'
});
```

## Runtime-Specific Features

### Cloudflare D1

```typescript
// D1-specific optimizations
const d1Query = await dataProvider.customOrm({
  query: (db, schema) => {
    // Use D1's prepared statement caching
    const stmt = db.select()
      .from(schema.users)
      .where(eq(schema.users.status, 'active'))
      .prepare();
    
    return stmt.execute();
  },
  method: 'getList'
});

// Batch operations for efficiency
const batchResult = await dataProvider.customOrm({
  query: (db, schema) => {
    const statements = userIds.map(id =>
      db.select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
    );
    
    return db.batch(statements);
  },
  method: 'getMany'
});
```

### Node.js SQLite

```typescript
// Use better-sqlite3 features
const nodeQuery = await dataProvider.customOrm({
  query: (db, schema) => {
    // Prepare statement for reuse
    const stmt = db.select()
      .from(schema.users)
      .where(eq(schema.users.status, placeholder('status')))
      .prepare();
    
    return stmt.execute({ status: 'active' });
  },
  method: 'getList'
});

// WAL mode for better concurrency
await db.run(sql`PRAGMA journal_mode = WAL`);
```

### Bun SQLite

```typescript
// Bun-specific optimizations
const bunQuery = await dataProvider.customOrm({
  query: (db, schema) => {
    // Leverage Bun's fast JSON handling
    return db.select({
      id: schema.users.id,
      metadata: sql<any>`json(${schema.users.metadata})`
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'));
  },
  method: 'getList'
});
```

## Error Handling

```typescript
try {
  const result = await dataProvider.customOrm({
    query: (db, schema) =>
      db.select().from(schema.users).where(eq(schema.users.id, userId)),
    method: 'getOne'
  });
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // Handle unique constraint violation
  } else if (error.message.includes('no such table')) {
    // Handle missing table
  } else {
    // Handle other database errors
  }
}
```

## Best Practices

### 1. Schema Design

```typescript
// Use proper data types and constraints
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: 255 }).notNull(),
  email: text('email', { length: 255 }).notNull().unique(),
  status: text('status', { enum: ['active', 'inactive', 'pending'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

### 2. Query Optimization

```typescript
// Use selective fields and proper indexing
const optimizedQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'))
    .orderBy(asc(schema.users.name))
    .limit(100),
  method: 'getList'
});
```

### 3. Type Safety

```typescript
// Define and use proper types
type CreateUserInput = typeof users.$inferInsert;
type User = typeof users.$inferSelect;

const createUser = async (data: CreateUserInput): Promise<User> => {
  const result = await dataProvider.create({
    resource: 'users',
    variables: data
  });
  return result.data;
};
```

### 4. Error Boundaries

```typescript
// Implement proper error handling
const safeQuery = async () => {
  try {
    return await dataProvider.customOrm({
      query: (db, schema) => db.select().from(schema.users),
      method: 'getList'
    });
  } catch (error) {
    console.error('Database query failed:', error);
    return { data: [], total: 0 };
  }
};
```

## Migration from refine-sql

If you're migrating from refine-sql to refine-orm:

### 1. Install Dependencies

```bash
npm install refine-orm drizzle-orm
```

### 2. Define Drizzle Schema

```typescript
// Convert SQL tables to Drizzle schema
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  // ... other fields
});
```

### 3. Update Data Provider

```typescript
// Before (refine-sql)
const dataProvider = createDataProvider({
  database: db,
  type: 'sqlite'
});

// After (refine-orm)
const dataProvider = ormDataProvider({
  db: drizzle(database, { schema }),
  schema,
  runtime: 'node'
});
```

### 4. Convert Custom Queries

```typescript
// Before (refine-sql customFlexible)
const result = await dataProvider.customFlexible({
  query: 'SELECT * FROM users WHERE status = ?',
  params: ['active'],
  method: 'getList'
});

// After (refine-orm customOrm)
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(eq(schema.users.status, 'active')),
  method: 'getList'
});
```

## Contributing

Contributions are welcome! Please read our contributing guide and submit pull requests for any improvements.

## License

MIT License - see LICENSE.md for details.
