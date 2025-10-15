# Interactive Examples

This directory contains interactive examples and templates for `refine-sqlx`.

## Quick Start Examples

### Stackblitz Templates

Click to open and run examples instantly in your browser:

| Template | Description | Open |
|----------|-------------|------|
| **D1 REST API** | Complete REST API with Cloudflare D1 | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-rest-api) |
| **D1 with Hono** | Hono framework integration with D1 | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-hono) |
| **D1 GraphQL** | GraphQL API with D1 backend | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-graphql) |
| **D1 WebSocket** | Real-time WebSocket with D1 | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-websocket) |
| **Bun SQLite** | Bun runtime with native SQLite | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/bun-sqlite) |
| **Node.js SQLite** | Node.js 24+ with native SQLite | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/node-sqlite) |

## Template Structure

```
docs/examples/
├── README.md                    # This file
├── d1-rest-api/                 # D1 REST API template
├── d1-hono/                     # D1 + Hono template
├── d1-graphql/                  # D1 + GraphQL template
├── d1-websocket/                # D1 + WebSocket template
├── bun-sqlite/                  # Bun native SQLite template
└── node-sqlite/                 # Node.js native SQLite template
```

## Playground

### Try D1 Integration Online

Experience `refine-sqlx` with Cloudflare D1 without any setup:

1. **[Open D1 Playground](https://workers.cloudflare.com/playground)** - Cloudflare Workers Playground
2. Copy code from [d1-rest-api/src/index.ts](./d1-rest-api/src/index.ts)
3. Click "Run" to test instantly

### Local Development

Clone and run any example locally:

```bash
# Clone the repository
git clone https://github.com/medz/refine-sqlx.git
cd refine-sqlx/docs/examples/d1-rest-api

# Install dependencies
npm install

# Run locally
npm run dev
```

## Example Categories

### 1. Backend APIs

- **[d1-rest-api](./d1-rest-api/)** - Complete REST API with CRUD operations
- **[d1-graphql](./d1-graphql/)** - GraphQL API with type-safe resolvers
- **[d1-hono](./d1-hono/)** - Lightweight API with Hono framework

### 2. Real-time Features

- **[d1-websocket](./d1-websocket/)** - WebSocket server with live updates
- **[d1-sse](./d1-sse/)** - Server-Sent Events for streaming data

### 3. Full-Stack Applications

- **[d1-refine-react](./d1-refine-react/)** - React admin panel with Refine
- **[d1-refine-next](./d1-refine-next/)** - Next.js full-stack app

### 4. Cross-Platform

- **[bun-sqlite](./bun-sqlite/)** - Bun runtime examples
- **[node-sqlite](./node-sqlite/)** - Node.js runtime examples
- **[better-sqlite3](./better-sqlite3/)** - better-sqlite3 fallback

## Features by Example

| Feature | REST API | Hono | GraphQL | WebSocket |
|---------|:--------:|:----:|:-------:|:---------:|
| CRUD Operations | ✅ | ✅ | ✅ | ✅ |
| Filtering & Sorting | ✅ | ✅ | ✅ | ✅ |
| Pagination | ✅ | ✅ | ✅ | ✅ |
| Batch Operations | ✅ | ✅ | ❌ | ✅ |
| Real-time Updates | ❌ | ❌ | ✅ | ✅ |
| Authentication | ✅ | ✅ | ✅ | ✅ |
| File Uploads | ✅ | ✅ | ❌ | ❌ |

## Quick Deploy

Deploy examples to Cloudflare Workers with one click:

### Deploy D1 REST API

```bash
cd docs/examples/d1-rest-api
npm install
npx wrangler deploy
```

### Deploy with GitHub Actions

All examples include CI/CD workflows for automatic deployment. See [deployment guide](../deployment/README.md).

## Learning Path

Recommended order for exploring examples:

1. **Start Here**: [d1-rest-api](./d1-rest-api/) - Learn basics
2. **Framework Integration**: [d1-hono](./d1-hono/) - Use with Hono
3. **Advanced Queries**: [d1-graphql](./d1-graphql/) - GraphQL patterns
4. **Real-time**: [d1-websocket](./d1-websocket/) - Live updates
5. **Full-Stack**: [d1-refine-react](./d1-refine-react/) - Complete app

## Common Use Cases

### E-commerce API

```typescript
// See examples/d1-rest-api/src/scenarios/ecommerce.ts
import { createRefineSQL } from 'refine-sqlx/d1';
import { products, orders, customers } from './schema';

// Complete e-commerce setup with:
// - Product catalog
// - Order management
// - Customer profiles
// - Inventory tracking
```

### Blog Platform

```typescript
// See examples/d1-rest-api/src/scenarios/blog.ts
import { posts, authors, comments, tags } from './schema';

// Blog features:
// - Posts with rich content
// - Author profiles
// - Comments system
// - Tag categorization
```

### User Management

```typescript
// See examples/d1-rest-api/src/scenarios/users.ts
import { users, roles, permissions } from './schema';

// User system with:
// - Authentication
// - Role-based access
// - Permissions
// - Audit logs
```

## Testing Examples

All examples include comprehensive tests:

```bash
# Run tests for specific example
cd docs/examples/d1-rest-api
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Contributing

Want to add a new example? See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Example Template

Each example should include:

- `README.md` - Setup and usage guide
- `package.json` - Dependencies and scripts
- `wrangler.toml` - Cloudflare Workers configuration
- `src/` - Source code
- `src/schema.ts` - Database schema
- `src/index.ts` - Main entry point
- `test/` - Test files
- `.env.example` - Environment variables template

## Resources

- [Main Documentation](../../README.md)
- [API Reference](../api/README.md)
- [Deployment Guide](../deployment/README.md)
- [Best Practices](../guides/best-practices.md)
- [Troubleshooting](../guides/troubleshooting.md)

## Support

Need help? Check out:

- [GitHub Discussions](https://github.com/medz/refine-sqlx/discussions)
- [GitHub Issues](https://github.com/medz/refine-sqlx/issues)
- [Discord Community](https://discord.gg/refine)

---

**Last Updated**: 2025-10-15
