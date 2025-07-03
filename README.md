<h1 align="center">
    <img
        src=".github/feather.svg"
        alt=""
        width="40"
        height="40"
        align="center"
    />
    refine-sqlite
</h1>

<p align="center">Connector for backends created with <a href="https://www.sqlite.org/index.html">SQLite.</a></p>

<div align="center">

[![npm version](https://badge.fury.io/js/refine-sqlite.svg)](https://www.npmjs.com/package/refine-sqlite)
[![npm](https://img.shields.io/npm/dt/refine-sqlite.svg)](https://www.npmjs.com/package/refine-sqlite)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mateusabelli/refine-sqlite/blob/main/LICENSE.md)
[![Node.js CI](https://github.com/mateusabelli/refine-sqlite/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/mateusabelli/refine-sqlite/actions/workflows/node.js.yml)

</div>

<br>

## Getting Started

With **refine-sqlite** you can quickly start creating your app as fast as possible by leveraging the easy-to-use methods powered by [refine](https://refine.dev) to interact with your SQLite database or Cloudflare D1.

## Features

- **Well tested** - All the methods are tested using [Jest](https://jestjs.io/).
- **Fully featured** - All CRUD operations are supported.
- **Multi-platform** - Works with both SQLite (Node.js) and Cloudflare D1 (Workers).
- **Type safe** - Written in TypeScript with strict mode enabled.
- **Edge ready** - Optimized for Cloudflare Workers and edge computing.

## Installation

### For Refine Applications

```bash
npm install refine-sqlite
```

### For Cloudflare Workers

```bash
npm install refine-sqlite
npm install wrangler --save-dev  # For development and deployment
```

### Standalone Usage

```bash
npm install refine-sqlite
```

## Quick Start

### React App with Refine + SQLite

```tsx
import React from 'react';
import { Refine } from '@refinedev/core';
import { dataProvider } from 'refine-sqlite';

const App: React.FC = () => {
  return (
    <Refine
      dataProvider={dataProvider('./app.db')}
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

### Cloudflare Workers with D1

```tsx
import { Refine } from '@refinedev/core';
import { dataProvider } from 'refine-sqlite';

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
import { dataProvider } from 'refine-sqlite';

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
import { dataProvider } from "refine-sqlite";

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const provider = dataProvider(env.DB);
    const response = await provider.getList({ resource: "posts" });
    return new Response(JSON.stringify(response));
  }
};
```

## Usage

The `refine-sqlite` package provides a data provider that seamlessly integrates with the [Refine framework](https://refine.dev) to work with SQLite databases (Node.js) or Cloudflare D1 (Workers/Edge).

> **Note:** `resource` corresponds to the table name in your database.

### Basic CRUD Operations

```ts
import { dataProvider } from "refine-sqlite";

const provider = dataProvider("./database.db"); // SQLite
// const provider = dataProvider(env.DB); // D1 in Workers

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

- [Methods](https://github.com/mateusabelli/refine-sqlite/wiki/Methods)
- [Filters](https://github.com/mateusabelli/refine-sqlite/wiki/Filters)
- [Sorters](https://github.com/mateusabelli/refine-sqlite/wiki/Sorters)
- [Cloudflare D1 Support](./CLOUDFLARE.md)
 
## Development

Clone the repository

```bash
git clone https://github.com/mateusabelli/refine-sqlite.git
```

Install the dependencies

```bash
cd refine-sqlite
pnpm install
```

Build and test

```bash
pnpm run build
pnpm run test
```

> **Important**
> Before the tests run, the database file `test.db` is deleted and recreated.

## Contributing

All contributions are welcome and appreciated! Please create an [Issue](https://github.com/mateusabelli/refine-sqlite/issues) or [Pull Request](https://github.com/mateusabelli/refine-sqlite/pulls) if you encounter any problems or have suggestions for improvements.

If you want to say **thank you** or/and support active development of **refine-sqlite**

-  Add a [GitHub Star](https://github.com/mateusabelli/refine-sqlite) to the project.
- Tweet about the project [on Twitter / X](https://twitter.com/intent/tweet?text=With%20refine-sqlite%20you%20can%20quickly%20start%20developing%20your%20next%20refine%20project%20with%20a%20lightweight%20local%20database.%20Check%20it%20out!%0A%0A%20https%3A//github.com/mateusabelli/refine-sqlite%20).
- Write interesting articles about the project on [Dev.to](https://dev.to/), [Medium](https://medium.com/) or personal blog.
- Consider becoming a sponsor on [GitHub](https://github.com/sponsors/mateusabelli).


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

**refine-sqlite** is free and open-source software licensed under the [MIT](./LICENSE.md) License.<br>The feather icon is from [Phosphor Icons](https://phosphoricons.com/) licensed under the MIT License.
