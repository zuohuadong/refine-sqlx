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

With **refine-sql** you can quickly start creating your app as fast as possible by leveraging the easy-to-use methods powered by [refine](https://refine.dev) to interact with your SQL databases across multiple runtimes.

## Features

- **Multi-runtime** - Supports Cloudflare D1, Node.js SQLite, and Bun SQLite.
- **Well tested** - All the methods are tested using [Vitest](https://vitest.dev/).
- **Fully featured** - All CRUD operations are supported.
- **Edge ready** - Optimized for Cloudflare Workers and edge computing.
- **Type safe** - Written in TypeScript with strict mode enabled.
- **Zero dependencies** - Minimal bundle size with external peer dependencies.

## Packages

This repository contains two packages:

- **refine-sql** - Core SQL data provider for Refine
- **refine-orm** - Drizzle ORM integration for extended database support

## Installation

### refine-sql (Core Package)

```bash
npm install refine-sql @refinedev/core
```

### refine-orm (ORM Extension)

```bash
npm install refine-orm drizzle-orm @refinedev/core
# Plus your database driver:
# npm install pg          # for PostgreSQL
# npm install mysql2      # for MySQL
# npm install better-sqlite3  # for SQLite
```

## Quick Start

### Using refine-sql

#### Cloudflare Worker with D1

```typescript
import { dataProvider } from 'refine-sql';

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const provider = dataProvider(env.DB);
    
    // Your API logic here
    const posts = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [],
      sorters: [],
      meta: {}
    });
    
    return new Response(JSON.stringify(posts), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

#### Node.js Application

```typescript
import { dataProvider } from 'refine-sql';

// Using a SQLite file path
const provider = dataProvider('./database.db');

// Your application logic
const users = await provider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 }
});
```

### Using refine-orm (Drizzle Integration)

```typescript
import { dataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/pg';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

// Define your schema
const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Setup database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Create data provider
const provider = dataProvider(db, {
  resources: {
    posts: {
      table: posts,
      primaryKey: 'id'
    }
  }
});
```

### React App with Refine

```tsx
import React from 'react';
import { Refine } from '@refinedev/core';
import { dataProvider } from 'refine-sql'; // or 'refine-orm'

const App: React.FC = () => {
  return (
    <Refine
      dataProvider={dataProvider(yourDatabase)}
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
import { dataProvider } from 'refine-d1';

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    // Use in API routes or SSR
    const provider = dataProvider(env.DB);
    
    // Example API endpoint
    if (request.url.includes('/api/posts')) {
      const posts = await provider.getList({ resource: 'posts' });
      return new Response(JSON.stringify(posts));
    }
    
    // Return your Refine app
    return new Response(/* Your Refine SSR response */);
  }
};
```

### Standalone Usage (without Refine)

```ts
import { dataProvider } from 'refine-d1';

const provider = dataProvider('./database.db');

// All methods return promises
const posts = await provider.getList({ 
  resource: 'posts',
  pagination: { current: 1, pageSize: 10 }
});
const response = await provider.getList({ resource: "posts" });
```

### Cloudflare Workers with D1

```ts
import { dataProvider } from "refine-d1";

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const provider = dataProvider(env.DB);
    const response = await provider.getList({ resource: "posts" });
    return new Response(JSON.stringify(response));
  }
};
```

## Usage

The `refine-d1` package provides a data provider that seamlessly integrates with the [Refine framework](https://refine.dev) to work with Cloudflare D1 databases in Workers/Edge environments.

> **Note:** `resource` corresponds to the table name in your database.

### Basic CRUD Operations

```ts
import { dataProvider } from "refine-d1";

const provider = dataProvider(env.DB); // D1 in Workers

// List records with filtering and sorting
const posts = await provider.getList({
  resource: "posts",
  pagination: { current: 1, pageSize: 10 },
  filters: [
    {
      field: "category_id",
      operator: "eq", 
      value: ["2"]
    }
  ],
  sorters: [
    {
      field: "title",
      order: "asc"
    }
  ]
});

// Create a new record
const newPost = await provider.create({
  resource: "posts",
  variables: {
    title: "Hello World",
    content: "My first post",
    category_id: 1
  }
});

// Update a record  
const updatedPost = await provider.update({
  resource: "posts",
  id: "1",
  variables: {
    title: "Updated Title"
  }
});

// Get a single record
const post = await provider.getOne({
  resource: "posts", 
  id: "1"
});

// Get multiple records by IDs
const multiplePosts = await provider.getMany({
  resource: "posts",
  ids: ["1", "2", "3"]
});

// Delete a record
await provider.deleteOne({
  resource: "posts",
  id: "1"
});

console.log(response)

// {
//   data: [
//     { id: 6, title: 'Dolorem unde et officiis.', category_id: 2 },
//     { id: 1, title: 'Soluta et est est.', category_id: 2 }
//   ],
//   total: 2
// }
```

## Documentation

- [Methods](https://github.com/zuohuadong/refine-sql/wiki/Methods)
- [Filters](https://github.com/zuohuadong/refine-sql/wiki/Filters)
- [Sorters](https://github.com/zuohuadong/refine-sql/wiki/Sorters)
- [Cloudflare D1 Support](./CLOUDFLARE.md)
 
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
pnpm run test
```

> **Important**
> Before the tests run, the database file `test.db` is deleted and recreated.

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
