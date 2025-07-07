<h1 align="center">
    <img
        src=".github/feather.svg"
        alt=""
        width="40"
        height="40"
        align="center"
    />
    refine-d1
</h1>

<p align="center">Cloudflare D1 data provider for Refine framework - Build admin panels and CRUD apps with edge D1 databases</p>

<div align="center">

[![npm version](https://badge.fury.io/js/refine-d1.svg)](https://www.npmjs.com/package/refine-d1)
[![npm](https://img.shields.io/npm/dt/refine-d1.svg)](https://www.npmjs.com/package/refine-d1)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mateusabelli/refine-d1/blob/main/LICENSE.md)

</div>

<br>

## Getting Started

With **refine-d1** you can quickly start creating your app as fast as possible by leveraging the easy-to-use methods powered by [refine](https://refine.dev) to interact with your Cloudflare D1 database.

## Features

- **Well tested** - All the methods are tested using [Vitest](https://vitest.dev/).
- **Fully featured** - All CRUD operations are supported.
- **Edge ready** - Optimized for Cloudflare Workers and edge computing.
- **Type safe** - Written in TypeScript with strict mode enabled.
- **D1 native** - Built specifically for Cloudflare D1 databases.

## Installation

### For Cloudflare Workers

```bash
npm install refine-d1
npm install wrangler --save-dev  # For development and deployment
```

### For Refine Applications

```bash
npm install refine-d1 @refinedev/core
```

## Quick Start

### Cloudflare Worker with D1

```typescript
import { dataProvider } from 'refine-d1';

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

### React App with Refine + D1

```tsx
import React from 'react';
import { Refine } from '@refinedev/core';
import { dataProvider } from 'refine-d1';

const App: React.FC = () => {
  return (
    <Refine
      dataProvider={dataProvider(yourD1Database)}
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

- [Methods](https://github.com/mateusabelli/refine-d1/wiki/Methods)
- [Filters](https://github.com/mateusabelli/refine-d1/wiki/Filters)
- [Sorters](https://github.com/mateusabelli/refine-d1/wiki/Sorters)
- [Cloudflare D1 Support](./CLOUDFLARE.md)
 
## Development

Clone the repository

```bash
git clone https://github.com/mateusabelli/refine-d1.git
```

Install the dependencies

```bash
cd refine-d1
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

All contributions are welcome and appreciated! Please create an [Issue](https://github.com/mateusabelli/refine-d1/issues) or [Pull Request](https://github.com/mateusabelli/refine-d1/pulls) if you encounter any problems or have suggestions for improvements.

If you want to say **thank you** or/and support active development of **refine-d1**

-  Add a [GitHub Star](https://github.com/mateusabelli/refine-d1) to the project.
- Tweet about the project [on Twitter / X](https://twitter.com/intent/tweet?text=With%20refine-d1%20you%20can%20quickly%20start%20developing%20your%20next%20refine%20project%20with%20Cloudflare%20D1%20database.%20Check%20it%20out!%0A%0A%20https%3A//github.com/mateusabelli/refine-d1%20).
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

**refine-d1** is free and open-source software licensed under the [MIT](./LICENSE.md) License.<br>The feather icon is from [Phosphor Icons](https://phosphoricons.com/) licensed under the MIT License.
