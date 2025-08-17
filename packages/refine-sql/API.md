# Refine SQLx API Reference

## Table of Contents

- [Core Functions](#core-functions)
- [Enhanced ORM Features](#enhanced-orm-features)
- [Chain Query API](#chain-query-api)
- [Polymorphic Relationships](#polymorphic-relationships)
- [Type-Safe Operations](#type-safe-operations)
- [Client Methods](#client-methods)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Runtime Support](#runtime-support)

## Core Functions

### createRefineSQL

Creates a SQLite data provider with automatic runtime detection.

```typescript
function createRefineSQL<TSchema extends TableSchema = any>(
  database: string | Database | D1Database,
  options?: RefineOptions
): EnhancedDataProvider<TSchema>;
```

**Parameters:**

- `database`: Database file path, `:memory:`, or database instance
- `options`: Optional configuration object

**Returns:** Enhanced data provider with ORM compatibility features

**Runtime Detection:**

- **Bun**: Uses `bun:sqlite` for native performance
- **Node.js**: Uses `better-sqlite3`
- **Cloudflare Workers**: Uses D1 Database

**Example:**

```typescript
import createRefineSQL from 'refine-sql';

// File database
const dataProvider = createRefineSQL('./app.db');

// In-memory database
const dataProvider = createRefineSQL(':memory:');

// Cloudflare D1
const dataProvider = createRefineSQL(env.DB);

// With options
const dataProvider = createRefineSQL('./app.db', {
  debug: true,
  logger: (query, params) => console.log(query, params),
});
```

## Enhanced ORM Features

### Type-Safe Schema Definition

Define your schema for enhanced type safety:

```typescript
interface MySchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    age?: number;
    status: 'active' | 'inactive';
    createdAt: Date;
  };
  posts: {
    id: number;
    title: string;
    content?: string;
    userId: number;
    published: boolean;
    createdAt: Date;
  };
}

const dataProvider: EnhancedDataProvider<MySchema> =
  createRefineSQL<MySchema>('./app.db');
```

### Enhanced Data Provider Interface

```typescript
interface EnhancedDataProvider<TSchema extends TableSchema>
  extends DataProvider {
  // Standard Refine methods (inherited)
  getList(params: GetListParams): Promise<GetListResponse>;
  getOne(params: GetOneParams): Promise<GetOneResponse>;
  create(params: CreateParams): Promise<CreateResponse>;
  // ... other standard methods

  // Enhanced ORM methods
  from<TTable extends keyof TSchema>(
    table: TTable
  ): SqlxChainQuery<TSchema[TTable]>;
  morphTo<TTable extends keyof TSchema>(
    table: TTable,
    config: MorphConfig
  ): SqlxMorphQuery<TSchema[TTable]>;

  // Type-safe operations
  getTyped<TTable extends keyof TSchema>(
    params: TypedGetParams<TTable>
  ): Promise<TypedGetResponse<TSchema[TTable]>>;
  createTyped<TTable extends keyof TSchema>(
    params: TypedCreateParams<TTable, TSchema[TTable]>
  ): Promise<TypedCreateResponse<TSchema[TTable]>>;
  updateTyped<TTable extends keyof TSchema>(
    params: TypedUpdateParams<TTable, TSchema[TTable]>
  ): Promise<TypedUpdateResponse<TSchema[TTable]>>;

  // Utility methods
  findTyped<TTable extends keyof TSchema>(
    table: TTable,
    conditions: Partial<TSchema[TTable]>
  ): Promise<TSchema[TTable] | null>;
  findManyTyped<TTable extends keyof TSchema>(
    table: TTable,
    conditions: Partial<TSchema[TTable]>,
    options?: FindOptions
  ): Promise<TSchema[TTable][]>;
  existsTyped<TTable extends keyof TSchema>(
    table: TTable,
    conditions: Partial<TSchema[TTable]>
  ): Promise<boolean>;

  // Client access
  client: SqliteClient;
}
```

## Chain Query API

The chain query API provides a fluent interface for building SQL queries.

### Basic Usage

```typescript
// Simple query
const activeUsers = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .where('age', 'gte', 18)
  .orderBy('name', 'asc')
  .limit(10)
  .get();
```

### SqlxChainQuery Methods

#### where

Add WHERE conditions to the query.

```typescript
where<TColumn extends keyof TRecord>(
  column: TColumn,
  operator: FilterOperator,
  value: any
): this
```

**Supported Operators:**

- `eq`, `ne` - Equal, Not equal
- `gt`, `gte`, `lt`, `lte` - Comparison operators
- `in`, `notIn` - Array membership
- `like`, `ilike`, `notLike` - Pattern matching (ilike same as like in SQLite)
- `isNull`, `isNotNull` - Null checks
- `between`, `notBetween` - Range checks
- `startswith`, `endswith`, `contains` - String pattern matching

**Example:**

```typescript
const users = await dataProvider
  .from('users')
  .where('age', 'between', [18, 65])
  .where('email', 'endswith', '@company.com')
  .where('status', 'in', ['active', 'pending'])
  .where('name', 'contains', 'john')
  .get();
```

#### orderBy

Add ORDER BY clauses.

```typescript
orderBy<TColumn extends keyof TRecord>(
  column: TColumn,
  direction?: 'asc' | 'desc'
): this
```

#### limit / offset

Set LIMIT and OFFSET for pagination.

```typescript
limit(count: number): this
offset(count: number): this
```

#### paginate

Convenient pagination method.

```typescript
paginate(page: number, pageSize?: number): this
```

### Execution Methods

#### get

Execute query and return all results.

```typescript
async get(): Promise<TRecord[]>
```

#### first

Execute query and return first result.

```typescript
async first(): Promise<TRecord | null>
```

#### count

Get count of matching records.

```typescript
async count(): Promise<number>
```

#### exists

Check if any records match the query.

```typescript
async exists(): Promise<boolean>
```

**Example:**

````typescript
// Check if user exists
const userExists = await dataProvider
  .from('users')
  .where('email', 'eq', 'john@example.com')
  .exists();

// Get user count by status
const activeUserCount = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .count();

// Get first admin user
const firstAdmin = await dataProvider
  .from('users')
  .where('role', 'eq', 'admin')
  .orderBy('createdAt', 'asc')
  .first();
```## Polym
orphic Relationships

Support for polymorphic relationships where a model can belong to multiple other models.

### morphTo

Create a polymorphic query.

```typescript
morphTo<TTable extends keyof TSchema>(
  table: TTable,
  config: MorphConfig
): SqlxMorphQuery<TSchema[TTable]>
````

**MorphConfig Interface:**

```typescript
interface MorphConfig {
  typeField: string; // Field storing the related model type
  idField: string; // Field storing the related model ID
  relationName: string; // Name for the loaded relation
  types: Record<string, string>; // Mapping of type names to table names
}
```

**Example:**

```typescript
// Schema with polymorphic comments
interface CommentSchema {
  comments: {
    id: number;
    content: string;
    commentableType: string; // 'post' or 'user'
    commentableId: number;
    createdAt: Date;
  };
  posts: { id: number; title: string; content: string };
  users: { id: number; name: string; email: string };
}

// Query polymorphic relationships
const commentsWithRelations = await dataProvider
  .morphTo('comments', {
    typeField: 'commentableType',
    idField: 'commentableId',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .where('approved', 'eq', true)
  .get();

// Result includes the related model
console.log(commentsWithRelations[0].commentable); // Post or User object
```

### SqlxMorphQuery Methods

SqlxMorphQuery extends SqlxChainQuery with polymorphic-specific methods:

```typescript
interface SqlxMorphQuery<TRecord> extends SqlxChainQuery<TRecord> {
  withMorphRelations(): this;
  morphWhere(type: string, conditions: Record<string, any>): this;
}
```

**Example:**

```typescript
const comments = await dataProvider
  .morphTo('comments', morphConfig)
  .withMorphRelations()
  .morphWhere('post', { published: true })
  .morphWhere('user', { active: true })
  .get();
```

## Type-Safe Operations

Enhanced type-safe methods for better development experience.

### createTyped

Type-safe record creation.

```typescript
async createTyped<TTable extends keyof TSchema>(
  params: TypedCreateParams<TTable, TSchema[TTable]>
): Promise<TypedCreateResponse<TSchema[TTable]>>
```

**Example:**

```typescript
const newUser = await dataProvider.createTyped({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active', // TypeScript ensures correct values
    age: 30,
  },
});

// TypeScript knows the return type
console.log(newUser.data.id); // number
console.log(newUser.data.name); // string
```

### updateTyped

Type-safe record updates.

```typescript
async updateTyped<TTable extends keyof TSchema>(
  params: TypedUpdateParams<TTable, TSchema[TTable]>
): Promise<TypedUpdateResponse<TSchema[TTable]>>
```

**Example:**

```typescript
const updatedUser = await dataProvider.updateTyped({
  resource: 'users',
  id: 1,
  variables: {
    status: 'inactive', // TypeScript validates the value
    age: 31,
  },
});
```

### getTyped

Type-safe record retrieval.

```typescript
async getTyped<TTable extends keyof TSchema>(
  params: TypedGetParams<TTable>
): Promise<TypedGetResponse<TSchema[TTable]>>
```

### findTyped / findManyTyped

Convenient find methods with type safety.

```typescript
async findTyped<TTable extends keyof TSchema>(
  table: TTable,
  conditions: Partial<TSchema[TTable]>
): Promise<TSchema[TTable] | null>

async findManyTyped<TTable extends keyof TSchema>(
  table: TTable,
  conditions: Partial<TSchema[TTable]>,
  options?: FindOptions
): Promise<TSchema[TTable][]>
```

**Example:**

```typescript
// Find single user
const user = await dataProvider.findTyped('users', {
  email: 'john@example.com',
});

// Find multiple users with options
const activeUsers = await dataProvider.findManyTyped(
  'users',
  { status: 'active' },
  { limit: 10, orderBy: [{ field: 'createdAt', order: 'desc' }] }
);
```

### existsTyped

Type-safe existence check.

```typescript
async existsTyped<TTable extends keyof TSchema>(
  table: TTable,
  conditions: Partial<TSchema[TTable]>
): Promise<boolean>
```

**Example:**

```typescript
const emailExists = await dataProvider.existsTyped('users', {
  email: 'john@example.com',
});

if (emailExists) {
  throw new Error('Email already exists');
}
```

## Client Methods

Access to the underlying SQLite client for advanced operations.

### SqliteClient Interface

```typescript
interface SqliteClient {
  // Query execution
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(
    sql: string,
    params?: any[]
  ): Promise<{ changes: number; lastInsertRowid: number }>;

  // Transaction support
  transaction<T>(fn: (tx: SqliteClient) => Promise<T>): Promise<T>;

  // Batch operations
  batch(statements: BatchStatement[]): Promise<BatchResult[]>;

  // Connection management
  close(): Promise<void>;
}

interface BatchStatement {
  sql: string;
  params?: any[];
}

interface BatchResult {
  changes: number;
  lastInsertRowid: number;
}
```

### Raw SQL Queries

```typescript
// SELECT query
const users = await dataProvider.client.query(
  'SELECT * FROM users WHERE age > ? AND status = ?',
  [18, 'active']
);

// INSERT/UPDATE/DELETE
const result = await dataProvider.client.execute(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['John Doe', 'john@example.com']
);

console.log('Inserted ID:', result.lastInsertRowid);
console.log('Rows affected:', result.changes);
```

### Transactions

```typescript
const result = await dataProvider.client.transaction(async tx => {
  // Create user
  const userResult = await tx.execute(
    'INSERT INTO users (name, email) VALUES (?, ?)',
    ['John Doe', 'john@example.com']
  );

  // Create posts for the user
  await tx.execute('INSERT INTO posts (title, user_id) VALUES (?, ?)', [
    'Hello World',
    userResult.lastInsertRowid,
  ]);

  return userResult.lastInsertRowid;
});
```

### Batch Operations

```typescript
const statements = [
  {
    sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['John', 'john@example.com'],
  },
  {
    sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['Jane', 'jane@example.com'],
  },
  {
    sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['Bob', 'bob@example.com'],
  },
];

const results = await dataProvider.client.batch(statements);
console.log('Inserted users:', results.length);
```

## Configuration

### RefineOptions

```typescript
interface RefineOptions {
  debug?: boolean;
  logger?: (query: string, params?: any[]) => void;
  options?: SqliteOptions;
}

interface SqliteOptions {
  // Node.js better-sqlite3 options
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: (message?: any, ...additionalArgs: any[]) => void;
}
```

**Example:**

````typescript
const dataProvider = createRefineSQL('./app.db', {
  debug: true,
  logger: (query, params) => {
    console.log('SQL:', query);
    if (params) console.log('Params:', params);
  },
  options: {
    readonly: false,
    timeout: 5000,
    verbose: console.log
  }
});
```## Error
Handling

### Error Types

```typescript
// Standard errors that may be thrown
class SqliteError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SqliteError';
  }
}

class ConnectionError extends SqliteError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
  }
}

class QueryError extends SqliteError {
  constructor(message: string, public query?: string, public params?: any[]) {
    super(message, 'QUERY_ERROR');
  }
}
````

### Error Handling Example

```typescript
try {
  const users = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Database connection failed:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query failed:', error.message);
    console.error('Query:', error.query);
    console.error('Params:', error.params);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Runtime Support

### Runtime Detection

The library automatically detects the runtime environment and uses the appropriate SQLite driver:

```typescript
// Runtime detection logic
function detectRuntime(): 'bun' | 'node' | 'cloudflare' | 'unknown' {
  if (typeof Bun !== 'undefined') return 'bun';
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  if (typeof caches !== 'undefined' && typeof Request !== 'undefined')
    return 'cloudflare';
  return 'unknown';
}
```

### Driver Selection

| Runtime            | Driver         | Import                                  |
| ------------------ | -------------- | --------------------------------------- |
| Bun                | bun:sqlite     | `import { Database } from 'bun:sqlite'` |
| Node.js            | better-sqlite3 | `import Database from 'better-sqlite3'` |
| Cloudflare Workers | D1 Database    | Provided by environment                 |

### Runtime-Specific Features

#### Bun Runtime

```typescript
// Bun-specific optimizations
const dataProvider = createRefineSQL('./app.db');

// Bun's native SQLite is faster for:
// - File I/O operations
// - Memory databases
// - Concurrent reads
```

#### Node.js Runtime

```typescript
// Node.js with better-sqlite3
const dataProvider = createRefineSQL('./app.db', {
  options: {
    verbose: console.log, // better-sqlite3 specific
    timeout: 5000,
  },
});
```

#### Cloudflare Workers

```typescript
// Cloudflare Workers with D1
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataProvider = createRefineSQL(env.DB);

    const users = await dataProvider.getList({ resource: 'users' });

    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

## Advanced Usage Examples

### Complex Queries with Joins

```typescript
// Using raw SQL for complex joins
const postsWithAuthors = await dataProvider.client.query(
  `
  SELECT 
    p.id,
    p.title,
    p.content,
    u.name as author_name,
    u.email as author_email
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.published = ? AND u.status = ?
  ORDER BY p.created_at DESC
  LIMIT ?
`,
  [true, 'active', 10]
);
```

### Aggregation Queries

```typescript
// User statistics
const userStats = await dataProvider.client.query(`
  SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
    AVG(age) as average_age,
    MIN(created_at) as first_user_date,
    MAX(created_at) as latest_user_date
  FROM users
`);
```

### Full-Text Search (SQLite FTS)

```typescript
// Enable FTS for posts table
await dataProvider.client.execute(`
  CREATE VIRTUAL TABLE posts_fts USING fts5(title, content, content='posts', content_rowid='id')
`);

// Populate FTS index
await dataProvider.client.execute(`
  INSERT INTO posts_fts(rowid, title, content) 
  SELECT id, title, content FROM posts
`);

// Search posts
const searchResults = await dataProvider.client.query(
  `
  SELECT p.* FROM posts p
  JOIN posts_fts fts ON p.id = fts.rowid
  WHERE posts_fts MATCH ?
  ORDER BY bm25(posts_fts)
`,
  ['javascript OR typescript']
);
```

### Database Migrations

```typescript
// Simple migration system
async function runMigrations(dataProvider: EnhancedDataProvider) {
  // Check if migrations table exists
  const tables = await dataProvider.client.query(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='migrations'
  `);

  if (tables.length === 0) {
    // Create migrations table
    await dataProvider.client.execute(`
      CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Run pending migrations
  const migrations = [
    {
      name: '001_create_users_table',
      sql: `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: '002_create_posts_table',
      sql: `
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT,
          user_id INTEGER REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
  ];

  for (const migration of migrations) {
    const existing = await dataProvider.client.query(
      'SELECT * FROM migrations WHERE name = ?',
      [migration.name]
    );

    if (existing.length === 0) {
      await dataProvider.client.transaction(async tx => {
        await tx.execute(migration.sql);
        await tx.execute('INSERT INTO migrations (name) VALUES (?)', [
          migration.name,
        ]);
      });
      console.log(`Migration ${migration.name} executed`);
    }
  }
}
```

### Performance Optimization

```typescript
// Enable WAL mode for better concurrency
await dataProvider.client.execute('PRAGMA journal_mode = WAL');

// Optimize for performance
await dataProvider.client.execute('PRAGMA synchronous = NORMAL');
await dataProvider.client.execute('PRAGMA cache_size = 1000');
await dataProvider.client.execute('PRAGMA temp_store = memory');

// Create indexes for better query performance
await dataProvider.client.execute(
  'CREATE INDEX idx_users_email ON users(email)'
);
await dataProvider.client.execute(
  'CREATE INDEX idx_posts_user_id ON posts(user_id)'
);
await dataProvider.client.execute(
  'CREATE INDEX idx_posts_created_at ON posts(created_at)'
);
```

This completes the comprehensive API reference for Refine SQLx, covering all features from basic usage to advanced scenarios.
