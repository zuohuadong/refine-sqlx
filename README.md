# 🚀 Refine SQL X

[English](./README.md) | [中文](./README_zh-CN.md)

A type-safe, cross-platform SQL data provider for [Refine](https://refine.dev) powered by [Drizzle ORM](https://orm.drizzle.team).

[![npm version](https://img.shields.io/npm/v/refine-sqlx.svg)](https://www.npmjs.com/package/refine-sqlx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Why Refine SQL X?

**Refine SQL X** combines the power of [Refine](https://refine.dev) and [Drizzle ORM](https://orm.drizzle.team) to provide:

- ✅ **Full TypeScript Type Safety** - Catch errors at compile time, not runtime
- ✅ **Single Source of Truth** - Define your schema once, use it everywhere
- ✅ **Multi-Database Support** - Same API for SQLite, MySQL, PostgreSQL, and Cloudflare D1
- ✅ **IntelliSense Everywhere** - Auto-completion for tables, columns, and types
- ✅ **Zero Runtime Cost** - Type checking happens at build time

### Why Drizzle ORM?

This library uses [Drizzle ORM](https://orm.drizzle.team) for schema definitions because it provides:

1. **Type Safety** - Automatic TypeScript type inference from your schema
2. **Cross-Database Compatibility** - Write once, run on SQLite, MySQL, or PostgreSQL
3. **Familiar API** - SQL-like syntax that's easy to learn
4. **Zero Magic** - Explicit, predictable behavior without hidden abstractions
5. **Lightweight** - Minimal runtime overhead

## ✨ Features

- 🎯 **Schema-Driven Development** - Define your database schema in TypeScript
- 🔄 **Multi-Database Support** - SQLite, MySQL, PostgreSQL, and Cloudflare D1
- 🌐 **Multi-Runtime Support** - Bun, Node.js 24+, Cloudflare Workers, better-sqlite3
- 📦 **Optimized D1 Build** - Tree-shaken bundle (~18KB gzipped) for Cloudflare Workers
- 🛡️ **Type Inference** - Automatic type inference from Drizzle schemas
- 🔌 **Unified API** - Single interface for all database types with automatic detection
- 🔍 **Advanced Filtering** - Full Refine filter operators support
- 💾 **Transaction Support** - Batch operations and atomic transactions
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

Get started in 3 simple steps:

### 1. Install Dependencies

```bash
npm install refine-sqlx drizzle-orm
# Install your database driver (e.g., better-sqlite3 for Node.js)
npm install better-sqlite3
npm install --save-dev drizzle-kit @types/better-sqlite3
```

### 2. Configure Drizzle

Define your schema and create a Drizzle database instance.

```typescript
// schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
});
```

### 3. Initialize Refine Provider (Dependency Injection)

**Breaking Change in v0.6.0**: `refine-sqlx` no longer creates database connections internally. You must pass a configured Drizzle `db` instance. This ensures compatibility with Edge runtimes (Cloudflare D1) and various drivers.

#### Node.js (better-sqlite3)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
});
```

#### Cloudflare D1

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { createRefineSQL } from 'refine-sqlx/d1';
import * as schema from './schema';

export default {
  async fetch(request, env) {
    const db = drizzle(env.DB, { schema });

    // Create Refine provider with the D1 Drizzle instance
    const dataProvider = await createRefineSQL({
      connection: db,
      schema,
    });

    // ... use provider with Refine Core ...
    return Response.json({ ok: true });
  }
}
```

#### Bun

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
});
```

### 4. Advanced Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,

  // Optional: Enable soft delete
  softDelete: {
    enabled: true,
    field: 'deleted_at',
  },

  // Optional: Logging
  logger: true,
});
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
  connection: db, // Pass your Drizzle instance
  schema,
  timeTravel: {
    enabled: true,
    backupDir: './.time-travel', // Backup directory (default: './.time-travel')
    intervalSeconds: 86400, // Backup interval in seconds (default: 86400 = 1 day)
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
  connection: db, // Drizzle instance

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

### Current Version (v0.6.x)

- **[v0.6.0 Release Notes](./.changeset/v0-6-0-release.md)** - Breaking changes and new API
- **[D1 Example](./example/D1_EXAMPLE.md)** - Cloudflare Workers setup guide
- **[Example Code](./example/main-v0.3.0.ts)** - Full usage examples
- **[Technical Specifications](./docs/specs/CLAUDE_SPEC.md)** - Architecture and standards

### Roadmap & Future Versions

- **[v0.7.0 Features (Planned)](./docs/features/FEATURES_v0.7.0.md)** - Core features and enhancements
  - custom() method for raw SQL queries
  - Nested relations loading
  - Aggregation support
  - Field selection/projection
  - Soft delete support
- **[v0.8.0 Features (Planned)](./docs/features/FEATURES_v0.8.0.md)** - Enterprise & developer experience
  - Optimistic locking
  - Live queries / real-time subscriptions
  - Multi-tenancy / row-level security
  - Query caching
  - TypeScript schema generator
  - Enhanced logging & debugging

## 🔄 Migration from v0.5.x

v0.6.0 introduces breaking changes to support Edge runtimes:

### Breaking Changes

- **Connection Injection**: `createRefineSQL` no longer accepts connection strings. You must pass a pre-configured Drizzle instance.
- **Removed Detection**: Automatic database type detection has been removed in favor of explicit dependency injection.

### Migration Steps

1. Update `refine-sqlx` to v0.6.0
2. Install appropriate Drizzle driver (e.g., `better-sqlite3`, `mysql2`)
3. Update `createRefineSQL` calls to pass `db` instance instead of string

## 📈 Performance

- **Standard Build**: ~8 KB (main entry point)
- **D1 Build**: ~18 KB gzipped
- **Zero External Dependencies**: Drizzle ORM managed via peer/explicit dependency
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
