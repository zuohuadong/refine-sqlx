# Examples

[English](./README.md) | [中文](./README_zh-CN.md)

This directory is reserved for future Refine integration examples.

## About refine-sqlx

`refine-sqlx` is a **Refine DataProvider** library designed to work with the [Refine](https://refine.dev/) framework. It provides a standardized data layer abstraction for SQL databases.

## Core Purpose

This library should **only** be used with Refine applications. It provides:

- DataProvider interface implementation
- CRUD operations for Refine
- Filtering, sorting, and pagination
- Cross-platform SQLite support (Bun, Node.js, Cloudflare D1)

## Important Notes

### ❌ Not Suitable For

This library is **NOT** intended for:

- Standalone REST APIs (use Drizzle ORM directly)
- GraphQL servers (use Drizzle ORM directly)
- WebSocket servers (use Drizzle ORM directly)
- General-purpose web frameworks like Hono, Express, Fastify
- Any backend that doesn't use Refine

### ✅ Suitable For

This library **IS** intended for:

- Refine admin panels
- Refine dashboards
- Refine data tables
- Full-stack apps using Refine on the frontend

## Coming Soon

We're working on proper Refine integration examples:

- **Refine + React Admin** - Admin panel with D1 backend
- **Refine + Next.js** - Full-stack application
- **Refine + Remix** - Server-side rendering with Refine

## If You Don't Use Refine

If you're building a backend API without Refine, you should use **Drizzle ORM** directly instead of this library:

```typescript
// ✅ Correct: Use Drizzle directly for non-Refine backends
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const db = drizzle(env.DB, { schema });
    const users = await db.select().from(schema.users);
    return Response.json(users);
  },
};
```

```typescript
// ❌ Incorrect: Don't use refine-sqlx without Refine
import { createRefineSQL } from 'refine-sqlx/d1';

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const provider = createRefineSQL({ connection: env.DB, schema });
    // This adds unnecessary abstraction!
  },
};
```

## Resources

- [Main Documentation](../../README.md)
- [Refine Documentation](https://refine.dev/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

**Last Updated**: 2025-10-15
