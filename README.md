<h1 align="center">
    <img
        src=".github/feather.svg"
        alt=""
        width="40"
        height="40"
        align="center"
    />
    refine-sql
</h1>

<p align="center">Multi-runtime SQL data provider for Refine framework - Supports Cloudflare D1, Node.js SQLite, and Bun SQLite</p>

<div align="center">

[![npm version](https://badge.fury.io/js/refine-sql.svg)](https://www.npmjs.com/package/refine-sql)
[![npm](https://img.shields.io/npm/dt/refine-sql.svg)](https://www.npmjs.com/package/refine-sql)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/zuohuadong/refine-sql/blob/main/LICENSE.md)

</div>

<br>

## Getting Started

With **refine-sql** and **refine-orm** you can quickly start creating your app as fast as possible by leveraging the easy-to-use methods powered by [refine](https://refine.dev) to interact with your SQL databases across multiple runtimes.

## Features

- **Multi-runtime** - Supports Cloudflare D1, Node.js SQLite, and Bun SQLite
- **Flexible Queries** - Custom SQL queries and ORM integration with Drizzle
- **Well tested** - All methods are tested in CI environments with actual runtime dependencies
- **Fully featured** - Complete CRUD operations and advanced querying
- **Edge ready** - Optimized for Cloudflare Workers and edge computing
- **Type safe** - Written in TypeScript with strict mode enabled
- **Auto Migration** - Parameter placeholder conversion across SQL dialects

## Packages

This repository contains two packages:

- **refine-sql** - Core SQL data provider with custom query support
- **refine-orm** - Drizzle ORM integration with multi-runtime support

## Installation

### refine-sql (Core Package)

```bash
npm install refine-sql @refinedev/core
```

### refine-orm (ORM Extension)

```bash
npm install refine-orm drizzle-orm @refinedev/core
# Plus your database driver (if needed):
# npm install better-sqlite3  # for Node.js SQLite
# (Bun SQLite is built-in, D1 is provided by Cloudflare)
```

## Quick Start

### Using refine-sql

#### Cloudflare Worker with D1

```typescript
import { createDataProvider } from 'refine-sql';

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const dataProvider = createDataProvider({
      database: env.DB,
      type: 'd1'
    });
    
    // Example usage
    const posts = await dataProvider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 }
    });
    
    return new Response(JSON.stringify(posts), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

#### Node.js SQLite

```typescript
import { createDataProvider } from 'refine-sql';
import Database from 'better-sqlite3';

const db = new Database('database.db');
const dataProvider = createDataProvider({
  database: db,
  type: 'sqlite'
});

// Use with Refine or standalone
const users = await dataProvider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 }
});
```

#### Bun SQLite

```typescript
import { createDataProvider } from 'refine-sql';
import { Database } from 'bun:sqlite';

const db = new Database('database.db');
const dataProvider = createDataProvider({
  database: db,
  type: 'bun-sqlite'
});
```

#### Custom Queries

```typescript
// String-based custom query
const result = await dataProvider.customFlexible({
  query: 'SELECT * FROM users WHERE status = ? AND age > ?',
  params: ['active', 25],
  method: 'getList'
});

// Function-based custom query (ORM-style)
const result = await dataProvider.customFlexible({
  query: (sql, params) => ({
    sql: `SELECT u.*, p.name as profile_name 
          FROM users u 
          LEFT JOIN profiles p ON u.id = p.user_id 
          WHERE u.status = ${params.placeholder()} 
          AND u.created_at > ${params.placeholder()}`,
    params: ['active', '2023-01-01']
  }),
  method: 'getList'
});
```

### Using refine-orm (Drizzle Integration)

#### Define Schema

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status').notNull().default('active')
});
```

#### Multi-Runtime Setup

```typescript
import { ormDataProvider } from 'refine-orm';
import { createDrizzleConnection } from 'refine-orm/runtime';
import * as schema from './schema';

// Auto-detect runtime and create connection
const { db, runtime } = await createDrizzleConnection({
  databasePath: 'database.db', // For SQLite runtimes
  // d1Database: env.DB        // For D1 runtime
});

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime // Auto-detected: 'node' | 'bun' | 'd1'
});
```

#### Type-Safe Custom Queries

```typescript
import { eq, and, gte } from 'drizzle-orm';

const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(and(
      eq(schema.users.status, 'active'),
      gte(schema.users.createdAt, '2023-01-01')
    )),
  method: 'getList'
});
```

### React App with Refine

```tsx
import React from 'react';
import { Refine } from '@refinedev/core';
import { createDataProvider } from 'refine-sql'; // or { ormDataProvider } from 'refine-orm'

const App: React.FC = () => {
  return (
    <Refine
      dataProvider={createDataProvider({
        database: yourDatabase,
        type: 'sqlite' // or 'd1', 'bun-sqlite'
      })}
      resources={[
        {
          name: 'posts',
          list: '/posts',
          create: '/posts/create',
          edit: '/posts/edit/:id',
          show: '/posts/show/:id',
          meta: {
            canDelete: true,
          },
        },
        {
          name: 'categories', 
          list: '/categories',
          create: '/categories/create',
          edit: '/categories/edit/:id',
          show: '/categories/show/:id',
        },
      ]}
    >
      {/* Your Refine pages and components */}
    </Refine>
  );
};
```

## Documentation

### English Documentation

- [refine-sql Documentation](./docs/en/refine-sql.md) - Complete guide for the core SQL package
- [refine-orm Documentation](./docs/en/refine-orm.md) - Complete guide for the ORM extension

### 中文文档

- [refine-sql 文档](./docs/zh-cn/refine-sql.md) - 核心 SQL 包完整指南
- [refine-orm 文档](./docs/zh-cn/refine-orm.md) - ORM 扩展完整指南

### Additional Resources

- [Methods](https://github.com/zuohuadong/refine-sql/wiki/Methods)
- [Filters](https://github.com/zuohuadong/refine-sql/wiki/Filters)
- [Sorters](https://github.com/zuohuadong/refine-sql/wiki/Sorters)
- [Cloudflare D1 Support](./CLOUDFLARE.md)
- [Usage Guide](./USAGE-GUIDE.md)
- [Deployment Guide](./DEPLOYMENT.md)

## Examples

Check the `/examples` directory for complete working examples:

- `cloudflare-worker.ts` - Cloudflare Worker with D1
- `nodejs-app.js` - Node.js application with SQLite
- `bun-app.ts` - Bun application with SQLite
- `universal.js` - Universal/isomorphic usage

## API Overview

### Core CRUD Operations

Both packages support all standard Refine data provider methods:

- `getList()` - Retrieve paginated records with filtering and sorting
- `getOne()` - Get a single record by ID
- `getMany()` - Get multiple records by IDs
- `create()` - Create a new record
- `createMany()` - Create multiple records
- `update()` - Update an existing record
- `updateMany()` - Update multiple records
- `deleteOne()` - Delete a single record
- `deleteMany()` - Delete multiple records

### Advanced Features

- **customFlexible()** (refine-sql) - Execute custom SQL queries with flexible parameter binding
- **customOrm()** (refine-orm) - Execute type-safe Drizzle ORM queries
- **Multi-runtime support** - Automatic detection and adaptation
- **Parameter conversion** - Automatic conversion between different SQL dialects
 
## Development

Clone the repository

```bash
git clone https://github.com/zuohuadong/refine-sql.git
```

Install the dependencies

```bash
cd refine-d1
npm install
```

Build and test

```bash
pnpm run build
```

## Testing

This project uses CI-based testing with actual runtime environments rather than local mocks. Tests are run automatically on:

- **Bun** with native SQLite support
- **Node.js 22+** with experimental SQLite
- **Cloudflare D1** with Wrangler

For detailed testing information, see [TESTING.md](./TESTING.md).

> **Note**: Local environment simulation code has been removed in favor of CI-based testing with real runtime dependencies.

## Contributing

All contributions are welcome and appreciated! Please create an [Issue](https://github.com/zuohuadong/refine-sql/issues) or [Pull Request](https://github.com/zuohuadong/refine-sql/pulls) if you encounter any problems or have suggestions for improvements.

If you want to say **thank you** or/and support active development of **refine-d1**

-  Add a [GitHub Star](https://github.com/zuohuadong/refine-sql) to the project.
- Tweet about the project [on Twitter / X](https://twitter.com/intent/tweet?text=With%20refine-sql%20you%20can%20quickly%20start%20developing%20your%20next%20refine%20project%20with%20SQL%20databases.%20Check%20it%20out!%0A%0A%20https%3A//github.com/zuohuadong/refine-sql%20).
- Write interesting articles about the project on [Dev.to](https://dev.to/), [Medium](https://medium.com/) or personal blog.
- Consider becoming a sponsor on [GitHub](https://github.com/sponsors/zuohuadong).


## Special Thanks

<table>
  <td>
    <a href="https://github.com/refinedev">
      <img src="https://github.com/refinedev.png" width=64 height=64>
      <p align="center">refine</p>
    </a>
  </td>
</table>

I'd like to thank [refine](https://github.com/refinedev), my first GitHub sponsor :heart: <br>
For believing and supporting my projects!

## License

**refine-d1** is free and open-source software licensed under the [MIT](./LICENSE.md) License.<br>The feather icon is from [Phosphor Icons](https://phosphoricons.com/) licensed under the MIT License.
