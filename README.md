# 🚀 Refine SQL X

A type-safe, cross-platform SQL data provider for [Refine](https://refine.dev) powered by [Drizzle ORM](https://orm.drizzle.team).

[![npm version](https://img.shields.io/npm/v/refine-sqlx.svg)](https://www.npmjs.com/package/refine-sqlx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🎯 **Drizzle ORM Integration** - Full type safety with schema-driven development
- 🔄 **Multi-Database Support** - SQLite, MySQL, PostgreSQL, and Cloudflare D1
- 🌐 **Multi-Runtime Support** - Bun, Node.js 24+, Cloudflare Workers, better-sqlite3
- 📦 **Optimized D1 Build** - Tree-shaken bundle (~18KB gzipped) for Cloudflare Workers
- 🛡️ **Type Inference** - Automatic type inference from Drizzle schemas
- 🔌 **Unified API** - Single interface for all database types with automatic detection
- 🔍 **Advanced Filtering** - Full Refine filter operators support
- 💾 **Transaction Support** - D1 batch API wrapper for atomic operations
- ⏰ **Time Travel** - Automatic backup and restore for SQLite databases
- 📊 **Full CRUD** - Complete Create, Read, Update, Delete operations
- 🚀 **ESM Only** - Modern ES Module architecture
- 🎛️ **Automatic Detection** - Intelligently selects the best driver based on connection string

## 📦 Installation

```bash
# Using Bun
bun add refine-sqlx drizzle-orm

# Using npm
npm install refine-sqlx drizzle-orm

# Using pnpm
pnpm add refine-sqlx drizzle-orm
```

### Optional Database Drivers

**SQLite** (auto-installed as optional dependency):

```bash
npm install better-sqlite3  # For Node.js < 24
```

**MySQL**:

```bash
npm install mysql2
```

**PostgreSQL**:

```bash
npm install postgres
```

Note: Bun and Node.js 24+ have native SQLite support. Cloudflare D1 is built-in.

## 🚀 Quick Start

### 1. Define Your Schema

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
});
```

### 2. Create Data Provider

**Unified API - Automatic Database Type Detection**

```typescript
import { Refine } from '@refinedev/core';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// SQLite - File path or :memory:
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
});

// MySQL - Connection string (auto-detected)
const dataProvider = await createRefineSQL({
  connection: 'mysql://user:pass@localhost:3306/mydb',
  schema,
});

// MySQL - Config object
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'secret',
    database: 'mydb',
  },
  schema,
});

// PostgreSQL - Connection string (auto-detected)
const dataProvider = await createRefineSQL({
  connection: 'postgresql://user:pass@localhost:5432/mydb',
  schema,
});

// PostgreSQL - Config object
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'secret',
    database: 'mydb',
  },
  schema,
});

// Cloudflare D1 - Database instance
const dataProvider = await createRefineSQL({
  connection: env.DB, // D1Database instance
  schema,
});

// Drizzle Instance - Any database (most flexible)
const dataProvider = await createRefineSQL({
  connection: drizzleInstance,
  schema,
});

const App = () => (
  <Refine
    dataProvider={dataProvider}
    resources={[
      { name: 'users', list: '/users' },
      { name: 'posts', list: '/posts' },
    ]}>
    {/* Your app components */}
  </Refine>
);
```

### 3. Use Type-Safe Operations

```typescript
import type { InferSelectModel } from 'refine-sqlx';
import { users } from './schema';

// Automatic type inference
type User = InferSelectModel<typeof users>;

// Create with type safety
const { data } = await dataProvider.create<User>({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    createdAt: new Date(),
  },
});
```

## 🏗️ Platform-Specific Usage

### SQLite (All Runtimes)

**Schema Definition:**

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

**Usage:**

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// File path
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
});

// In-memory
const dataProvider = await createRefineSQL({ connection: ':memory:', schema });
```

### MySQL

**Schema Definition:**

```typescript
import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Usage:**

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// Connection string
const dataProvider = await createRefineSQL({
  connection: 'mysql://root:password@localhost:3306/mydb',
  schema,
});

// Config object with advanced options
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    ssl: { rejectUnauthorized: false },
    pool: { max: 20, min: 5 },
  },
  schema,
});
```

### PostgreSQL

**Schema Definition:**

```typescript
import { pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Usage:**

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// Connection string
const dataProvider = await createRefineSQL({
  connection: 'postgresql://postgres:password@localhost:5432/mydb',
  schema,
});

// Config object with advanced options
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
    ssl: true,
    max: 20,
    idle_timeout: 30,
  },
  schema,
});
```

### Cloudflare D1 (Optimized Build)

Use the optimized D1 entry point for minimal bundle size:

```typescript
import { createRefineSQL } from 'refine-sqlx/d1';
import * as schema from './schema';

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const dataProvider = createRefineSQL({ connection: env.DB, schema });

    // Your worker logic here
    return Response.json({ ok: true });
  },
};
```

**Bundle Size**: ~66KB (18KB gzipped) - includes Drizzle ORM!

### Bun Runtime

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = createRefineSQL({
  connection: './database.sqlite', // Uses bun:sqlite automatically
  schema,
});
```

### Node.js (v24+)

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = createRefineSQL({
  connection: './database.sqlite', // Uses node:sqlite automatically
  schema,
});
```

### With Existing Drizzle Instance

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('./database.sqlite');
const db = drizzle(sqlite, { schema });

const dataProvider = createRefineSQL({ connection: db, schema });
```

## 📊 Complete CRUD Examples

### Create Operations

```typescript
import type { InferInsertModel } from 'refine-sqlx';
import { users } from './schema';

type UserInsert = InferInsertModel<typeof users>;

// Create single record
const { data } = await dataProvider.create<User, UserInsert>({
  resource: 'users',
  variables: {
    name: 'Alice Smith',
    email: 'alice@example.com',
    status: 'active',
    createdAt: new Date(),
  },
});

// Create multiple records
const { data: users } = await dataProvider.createMany<User, UserInsert>({
  resource: 'users',
  variables: [
    {
      name: 'Bob',
      email: 'bob@example.com',
      status: 'active',
      createdAt: new Date(),
    },
    {
      name: 'Carol',
      email: 'carol@example.com',
      status: 'active',
      createdAt: new Date(),
    },
  ],
});
```

### Read Operations

```typescript
// Get list with filtering, sorting, and pagination
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  filters: [
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'name', operator: 'contains', value: 'John' },
  ],
  sorters: [{ field: 'createdAt', order: 'desc' }],
});

// Get single record
const { data: user } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
});

// Get multiple records by IDs
const { data: users } = await dataProvider.getMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
});
```

### Update Operations

```typescript
// Update single record
const { data } = await dataProvider.update<User>({
  resource: 'users',
  id: 1,
  variables: { status: 'inactive' },
});

// Update multiple records
const { data: users } = await dataProvider.updateMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
  variables: { status: 'active' },
});
```

### Delete Operations

```typescript
// Delete single record
const { data } = await dataProvider.deleteOne<User>({
  resource: 'users',
  id: 1,
});

// Delete multiple records
const { data: users } = await dataProvider.deleteMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
});
```

## ⏰ Time Travel (SQLite Only)

Enable automatic backup and restore functionality for SQLite databases:

```typescript
import { createRefineSQL, type DataProviderWithTimeTravel } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider: DataProviderWithTimeTravel = await createRefineSQL({
  connection: './database.sqlite',
  schema,
  timeTravel: {
    enabled: true,
    backupDir: './.time-travel', // Backup directory (default: './.time-travel')
    intervalSeconds: 60, // Backup interval in seconds (default: 60)
    retentionDays: 30, // Keep backups for 30 days (default: 30)
  },
});

// List all available snapshots
const snapshots = await dataProvider.listSnapshots?.();
console.log(snapshots);
// [
//   {
//     timestamp: '2025-10-16T10:30:00.000Z',
//     path: './.time-travel/snapshot-2025-10-16T10-30-00-000Z-auto.db',
//     createdAt: 1729077000000
//   }
// ]

// Create a manual snapshot
const snapshot = await dataProvider.createSnapshot?.('before-migration');

// Restore to a specific timestamp
await dataProvider.restoreToTimestamp?.('2025-10-16T10:30:00.000Z');

// Restore to the most recent snapshot before a date
await dataProvider.restoreToDate?.(new Date('2025-10-16'));

// Cleanup old snapshots
const deletedCount = await dataProvider.cleanupSnapshots?.();

// Stop automatic backups (when shutting down)
dataProvider.stopAutoBackup?.();
```

### Time Travel Features

- 🔄 **Automatic Backups**: Configurable interval-based snapshots
- 📸 **Manual Snapshots**: Create labeled snapshots on demand
- 🕰️ **Point-in-Time Restore**: Restore to specific timestamps or dates
- 🧹 **Automatic Cleanup**: Retention policy for old snapshots
- 🔒 **Pre-Restore Backup**: Automatically creates backup before restoration
- 📁 **File-Based**: Simple, efficient file system operations

**Note**: Time Travel is only available for SQLite databases with file-based storage (not `:memory:`).

## 🔍 Advanced Filtering

Supports all standard Refine filter operators:

```typescript
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  filters: [
    // Equality
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'status', operator: 'ne', value: 'deleted' },

    // Comparison
    { field: 'createdAt', operator: 'gte', value: new Date('2024-01-01') },
    { field: 'createdAt', operator: 'lte', value: new Date() },

    // String operations
    { field: 'name', operator: 'contains', value: 'John' },
    { field: 'email', operator: 'startswith', value: 'admin' },

    // Array operations
    { field: 'status', operator: 'in', value: ['active', 'pending'] },
    { field: 'status', operator: 'nin', value: ['deleted', 'banned'] },

    // Null checks
    { field: 'deletedAt', operator: 'null' },
    { field: 'email', operator: 'nnull' },

    // Range
    { field: 'age', operator: 'between', value: [18, 65] },
  ],
  sorters: [
    { field: 'createdAt', order: 'desc' },
    { field: 'name', order: 'asc' },
  ],
});
```

### Supported Filter Operators

- `eq`, `ne` - Equality/inequality
- `lt`, `lte`, `gt`, `gte` - Comparison
- `in`, `nin` - Array membership
- `contains`, `ncontains` - Substring search (case-insensitive)
- `containss`, `ncontainss` - Substring search (case-sensitive)
- `startswith`, `nstartswith`, `endswith`, `nendswith` - String position
- `between`, `nbetween` - Range checks
- `null`, `nnull` - Null checks

## ⚙️ Configuration

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = createRefineSQL({
  // Database connection
  connection: './database.sqlite', // or D1Database, Drizzle instance, etc.

  // Drizzle schema (required)
  schema,

  // Optional Drizzle config
  config: {
    logger: true, // Enable query logging
  },

  // Field naming convention (default: 'snake_case')
  casing: 'camelCase', // or 'snake_case' or 'none'

  // Custom logger
  logger: true, // or custom Logger instance
});
```

## 🎯 Type Exports

```typescript
import type {
  // Extended DataProvider with Time Travel
  DataProviderWithTimeTravel,
  InferInsertModel,
  // Infer types from schema
  InferSelectModel,
  // Configuration
  RefineSQLConfig,
  // Runtime detection
  RuntimeEnvironment,
  // Table name helper
  TableName,
  // Time Travel
  TimeTravelOptions,
  TimeTravelSnapshot,
} from 'refine-sqlx';

// Usage
type User = InferSelectModel<typeof users>;
type UserInsert = InferInsertModel<typeof users>;
```

## 📋 Requirements

- **TypeScript**: 5.0+
- **Node.js**: 20.0+ (24.0+ recommended for native SQLite)
- **Bun**: 1.0+ (optional)
- **Peer Dependencies**: `@refinedev/core ^5.0.0`, `@tanstack/react-query ^5.0.0`
- **Dependencies**: `drizzle-orm ^0.44.0`
- **Optional**: `better-sqlite3 ^12.0.0` (fallback for Node.js < 24)

## 🧪 Testing

```bash
# Run tests
bun test

# Run integration tests
bun run test:integration-bun
bun run test:integration-node
bun run test:integration-better-sqlite3

# Build
bun run build

# Format code
bun run format
```

## 📚 Documentation

Comprehensive documentation is available:

### Current Version (v0.3.x)

- **[v0.3.0 Release Notes](./.changeset/v0-3-0-release.md)** - Complete rewrite with Drizzle ORM
- **[D1 Example](./example/D1_EXAMPLE.md)** - Cloudflare Workers setup guide
- **[Example Code](./example/main-v0.3.0.ts)** - Full usage examples
- **[Technical Specifications](./docs/specs/CLAUDE_SPEC.md)** - Architecture and standards

### Roadmap & Future Versions

- **[v0.4.0 Features (Planned)](./docs/features/FEATURES_v0.4.0.md)** - Core features and enhancements (Q1 2025)
  - custom() method for raw SQL queries
  - Nested relations loading
  - Aggregation support
  - Field selection/projection
  - Soft delete support
- **[v0.5.0 Features (Planned)](./docs/features/FEATURES_v0.5.0.md)** - Enterprise & developer experience (Q2-Q3 2025)
  - Optimistic locking
  - Live queries / real-time subscriptions
  - Multi-tenancy / row-level security
  - Query caching
  - TypeScript schema generator
  - Enhanced logging & debugging

## 🔄 Migration from v0.2.x

v0.3.0 is a complete rewrite with breaking changes:

### Breaking Changes

- **Required**: Drizzle ORM schema definitions (no more schema-less usage)
- **New API**: `createRefineSQL({ connection, schema })` instead of `createRefineSQL(path)`
- **ESM Only**: No CommonJS support
- **TypeScript 5.0+**: Required for modern type features
- **Node.js 20+**: Minimum version increased

### Migration Steps

1. Install Drizzle ORM: `npm install drizzle-orm`
2. Define your schema using Drizzle
3. Update `createRefineSQL` call to use new API
4. Update TypeScript to 5.0+
5. Verify all imports are ESM

See [CHANGELOG.md](./CHANGELOG.md) for detailed migration guide.

## 📈 Performance

- **Standard Build**: 8.06 KB (main entry point)
- **D1 Build**: 66 KB uncompressed, ~18 KB gzipped
- **Zero External Dependencies**: Drizzle ORM fully tree-shaken and bundled (D1 only)
- **Type-Safe**: Zero runtime overhead for type checking

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Refine Documentation](https://refine.dev/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [GitHub Repository](https://github.com/medz/refine-sqlx)
- [npm Package](https://www.npmjs.com/package/refine-sqlx)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)

---

Made with ❤️ for Seven
