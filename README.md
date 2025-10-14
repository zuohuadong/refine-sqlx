# 🚀 Refine SQL X

A powerful, cross-platform SQL data provider for [Refine](https://refine.dev) with automatic SQLite adapter detection and support for multiple runtime environments.

[![npm version](https://img.shields.io/npm/v/refine-sqlx.svg)](https://www.npmjs.com/package/refine-sqlx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🔄 **Universal SQLite Support** - Works with Bun, Node.js, Cloudflare Workers, and better-sqlite3
- 🎯 **Automatic Runtime Detection** - Intelligently selects the best SQLite driver for your environment
- 🏭 **Factory Pattern** - Lazy connection initialization for optimal performance
- 💾 **Memory & File Databases** - Support for both `:memory:` and file-based SQLite databases
- 🔐 **Transaction Support** - Built-in transaction handling where supported
- 📦 **Batch Operations** - Efficient bulk operations with createMany, updateMany, deleteMany
- 🎛️ **Full CRUD** - Complete Create, Read, Update, Delete operations
- 🔍 **Advanced Filtering** - Rich filtering, sorting, and pagination capabilities
- 🛡️ **Type Safe** - Full TypeScript support with comprehensive type definitions

## 📦 Installation

```bash
# Using Bun
bun add refine-sqlx

# Using npm
npm install refine-sqlx

# Using pnpm
pnpm add refine-sqlx

# Using yarn
yarn add refine-sqlx
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { Refine } from '@refinedev/core';
import { createRefineSQL } from 'refine-sqlx';

// Use in-memory SQLite database
const dataProvider = createRefineSQL(':memory:');

const App = () => (
  <Refine dataProvider={dataProvider}>
    {/* Your app components */}
  </Refine>
);
```

### File-based Database

```typescript
import { createRefineSQL } from 'refine-sqlx';

// Use a file-based SQLite database
const dataProvider = createRefineSQL('./database.sqlite');
```

## 🏗️ Platform-Specific Usage

### Bun Runtime

```typescript
import { Database } from 'bun:sqlite';
import { createRefineSQL } from 'refine-sqlx';

const db = new Database(':memory:');
const dataProvider = createRefineSQL(db);
```

### Node.js (v24+)

```typescript
import { DatabaseSync } from 'node:sqlite';
import { createRefineSQL } from 'refine-sqlx';

const db = new DatabaseSync(':memory:');
const dataProvider = createRefineSQL(db);
```

### Cloudflare D1

```typescript
import { createRefineSQL } from 'refine-sqlx';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataProvider = createRefineSQL(env.DB); // D1 database binding
    // Your worker logic here
  },
};
```

### Better SQLite3 (Fallback)

```typescript
import Database from 'better-sqlite3';
import { createRefineSQL } from 'refine-sqlx';

const db = new Database(':memory:');
const dataProvider = createRefineSQL(db);
```

## 🔧 Advanced Configuration

### Lazy Connection with Factory Pattern

```typescript
import { createRefineSQL } from 'refine-sqlx';

const dataProvider = createRefineSQL({
  async connect() {
    // Returns your client.
  }
});
```

### Custom SQL Client

```typescript
import { createRefineSQL } from 'refine-sqlx';
import type { SqlClient } from 'refine-sqlx';

const customClient: SqlClient = {
  async query(query) {
    // Your custom query implementation
    return { columnNames: [], rows: [] };
  },

  async execute(query) {
    // Your custom execute implementation
    return { changes: 0, lastInsertId: undefined };
  },

  // Optional
  async transaction(fn) {
    // Your custom transaction implementation
    return await fn(this);
  }
};

const dataProvider = createRefineSQL(customClient);
// OR
// createRefineSQL({ connect: () => customClient })
```

## 📊 Usage Examples

### Complete CRUD Operations

```typescript
import { createRefineSQL } from 'refine-sqlx';

const dataProvider = createRefineSQL(':memory:');

// Create a record
const createResult = await dataProvider.create({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  }
});

// Get a list with filtering and pagination
const listResult = await dataProvider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  filters: [
    { field: 'age', operator: 'gte', value: 18 }
  ],
  sorters: [
    { field: 'name', order: 'asc' }
  ]
});

// Update a record
const updateResult = await dataProvider.update({
  resource: 'users',
  id: 1,
  variables: { age: 31 }
});

// Delete a record
const deleteResult = await dataProvider.deleteOne({
  resource: 'users',
  id: 1
});
```

### Batch Operations

```typescript
// Create multiple records
const createManyResult = await dataProvider.createMany({
  resource: 'users',
  variables: [
    { name: 'Alice', email: 'alice@example.com', age: 25 },
    { name: 'Bob', email: 'bob@example.com', age: 30 },
    { name: 'Charlie', email: 'charlie@example.com', age: 35 }
  ]
});

// Update multiple records
const updateManyResult = await dataProvider.updateMany({
  resource: 'users',
  ids: [1, 2, 3],
  variables: { status: 'active' }
});

// Delete multiple records
const deleteManyResult = await dataProvider.deleteMany({
  resource: 'users',
  ids: [1, 2, 3]
});
```

## 🔍 Filtering & Sorting

Refine SQL X supports all standard Refine filtering operators:

```typescript
const result = await dataProvider.getList({
  resource: 'users',
  filters: [
    { field: 'name', operator: 'contains', value: 'John' },
    { field: 'age', operator: 'gte', value: 18 },
    { field: 'age', operator: 'lte', value: 65 },
    { field: 'email', operator: 'ne', value: null },
    { field: 'status', operator: 'in', value: ['active', 'pending'] }
  ],
  sorters: [
    { field: 'created_at', order: 'desc' },
    { field: 'name', order: 'asc' }
  ]
});
```

### Supported Filter Operators

- `eq` - Equal
- `ne` - Not equal
- `lt` - Less than
- `lte` - Less than or equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `in` - In array
- `nin` - Not in array
- `contains` - Contains (LIKE %value%)
- `ncontains` - Not contains
- `containss` - Contains case sensitive
- `ncontainss` - Not contains case sensitive
- `between` - Between two values
- `nbetween` - Not between two values
- `null` - Is null
- `nnull` - Is not null

## 🏗️ Architecture

### Runtime Detection

Refine SQL X automatically detects your runtime environment and selects the optimal SQLite driver:

1. **Cloudflare Workers** - Uses D1 database bindings
2. **Bun** - Uses `bun:sqlite` (native)
3. **Node.js ≥24** - Uses `node:sqlite` (native)
4. **Fallback** - Uses `better-sqlite3` package

### Transaction Support

Transactions are automatically handled where supported:

```typescript
// Transactions are used internally for batch operations
const result = await dataProvider.createMany({
  resource: 'users',
  variables: [...] // All records created in a single transaction
});
```

> [!TIP]
> D1 not supported transaction, fallback using `batch`.

## 🧪 Testing

```bash
# Run unit tests
bun test

# Run integration tests for all platforms
bun run test:integration-bun
bun run test:integration-node
bun run test:integration-better-sqlite3

# Build the library
bun run build

# Format code
bun run format
```

## 📋 Requirements

- **Peer Dependencies**: `@refinedev/core ^4`
- **Optional Dependencies**: `better-sqlite3 ^12` (for fallback support)
- **Runtime SQLite Support**:
  - Bun 1.0+ (for `bun:sqlite`)
  - Node.js 24+ (for `node:sqlite`)
  - Node.js 20+ (with `better-sqlite3`)
  - Cloudflare Workers (with D1 bindings)

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

- **[Technical Specifications](./docs/specs/CLAUDE_SPEC.md)** - Project standards, TypeScript requirements, database drivers, and build optimization
- **[v0.3.0 Features](./docs/features/FEATURES_v0.3.0.md)** - Drizzle ORM integration, type-safe queries, D1 optimized build
- **[v0.4.0 Features](./docs/features/FEATURES_v0.4.0.md)** - Eloquent-style ORM, automatic relationships, polymorphic relations
- **[D1 Bundle Size Analysis](./docs/analysis/D1_BUNDLE_SIZE_ANALYSIS.md)** - Performance optimization and bundle size targets

See the [documentation index](./docs/README.md) for more details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Refine Documentation](https://refine.dev/docs)
- [GitHub Repository](https://github.com/medz/refine-sqlx)
- [npm Package](https://www.npmjs.com/package/refine-sqlx)

---

Made with ❤️ for Seven
