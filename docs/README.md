# Refine SQLx Documentation

Welcome to the Refine SQLx documentation! This is a comprehensive collection of documentation for all packages in the Refine SQLx monorepo.

## Table of Contents

- [Getting Started](#getting-started)
- [Packages](#packages)
- [Guides](#guides)
- [Contributing](#contributing)

## Getting Started

Refine SQLx is a collection of high-performance, type-safe data providers and ORM utilities for building applications with Refine framework and SQL databases.

### Quick Links

- [Main Repository README](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Migration Summary](../MIGRATION_SUMMARY.md)
- [Release Guide](./RELEASE_GUIDE.md)

## Packages

### @refine-sqlx/sql (refine-sql)

The SQLite-focused package providing runtime-agnostic data provider with support for Bun, Node.js, and Cloudflare Workers.

**Documentation:**
- [API Reference](./refine-sql/API.md)
- [Factory Migration Guide](./refine-sql/FACTORY_MIGRATION.md)
- [ORM Compatibility](./refine-sql/ORM_COMPATIBILITY.md)
- [Refine ORM Migration Guide](./refine-sql/REFINE_ORM_MIGRATION.md)
- [Bundle Size Optimization](./refine-sql/BUNDLE_SIZE_OPTIMIZATION.md)

**Key Features:**
- Automatic runtime detection (Bun, Node.js, Cloudflare Workers)
- Type-safe chain query API
- Polymorphic relationships
- Transaction support
- Zero-dependency core

### @refine-sqlx/orm (refine-orm)

Multi-database ORM package with support for PostgreSQL, MySQL, and SQLite using Drizzle ORM.

**Documentation:**
- [API Reference](./refine-orm/API.md)
- [Native Query Builders](./refine-orm/NATIVE_QUERY_BUILDERS.md)
- [Factory Functions](./refine-orm/FACTORY_FUNCTIONS.md)
- [User-Friendly API](./refine-orm/USER_FRIENDLY_API.md)
- [PostgreSQL Adapter Guide](./refine-orm/postgresql-adapter.md)
- [MySQL Adapter Guide](./refine-orm/mysql-adapter.md)

**Key Features:**
- Multi-database support (PostgreSQL, MySQL, SQLite)
- Drizzle ORM integration
- Type-safe queries with full TypeScript inference
- Advanced relationship handling
- Connection pooling and transaction management

### @refine-sqlx/core (refine-core)

Shared utilities and type definitions used across all packages.

**Key Features:**
- Common filter and pagination utilities
- Type transformers
- Schema validation
- SQL query transformers

### @refine-sqlx/migrate (refine-migrate)

Migration utilities for transitioning between different data provider implementations.

**Key Features:**
- Automated migration helpers
- Configuration adapters
- Testing utilities for migration validation

## Guides

### Architecture

```
refine-sqlx/
├── packages/
│   ├── refine-sql/          # SQLite-focused, runtime-agnostic
│   ├── refine-orm/          # Multi-DB with Drizzle ORM
│   ├── refine-core/         # Shared utilities
│   └── refine-migrate/      # Migration tools
├── docs/                    # Centralized documentation
│   ├── refine-sql/
│   ├── refine-orm/
│   └── refine-core/
└── examples/                # Example applications
```

### Choosing the Right Package

**Use `@refine-sqlx/sql` when:**
- Building SQLite applications
- Need lightweight, zero-dependency solution
- Targeting Bun, Node.js, or Cloudflare Workers
- Want automatic runtime detection

**Use `@refine-sqlx/orm` when:**
- Need multi-database support (PostgreSQL, MySQL, SQLite)
- Want full Drizzle ORM integration
- Building complex applications with advanced relationships
- Need connection pooling and advanced transaction management

### Installation

```bash
# For SQLite applications
npm install @refine-sqlx/sql

# For multi-database applications
npm install @refine-sqlx/orm

# For migration utilities
npm install @refine-sqlx/migrate
```

### Basic Usage

#### SQLite with refine-sql

```typescript
import createRefineSQL from '@refine-sqlx/sql';

// Automatic runtime detection
const dataProvider = createRefineSQL('./app.db');

// Use with Refine
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine dataProvider={dataProvider}>
      {/* Your app */}
    </Refine>
  );
}
```

#### PostgreSQL with refine-orm

```typescript
import { createPostgreSQLProvider } from '@refine-sqlx/orm';
import * as schema from './schema';

const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:pass@localhost:5432/mydb',
  schema
);

// Use with Refine
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine dataProvider={dataProvider}>
      {/* Your app */}
    </Refine>
  );
}
```

## Contributing

We welcome contributions! Please see the following resources:

- [Contributing Guide](../CONTRIBUTING.md)
- [Code Review Guidelines](../.github/CODE_REVIEW_GUIDELINES.md)
- [Pull Request Template](../.github/pull_request_template.md)

### Development Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Run tests for specific package
bun test --filter refine-sql
```

## Support

- [GitHub Issues](https://github.com/your-org/refine-sqlx/issues)
- [Discussions](https://github.com/your-org/refine-sqlx/discussions)

## License

MIT License - see [LICENSE](../LICENSE) for details
