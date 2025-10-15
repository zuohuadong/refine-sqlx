# Claude Project Specifications

This document defines the project standards and technical requirements for Claude Code when working with this codebase.

## Project Overview

This project provides a Refine data provider for SQL databases with cross-platform support. All database interactions must follow the specifications outlined below.

---

## Technical Standards

### 1. ORM Framework

**MANDATORY**: All database operations MUST use **drizzle-orm** as the unified ORM layer.

- Use Drizzle ORM for schema definitions, queries, and migrations
- Leverage Drizzle's type-safe query builder for all database operations
- Define schemas using `drizzle-orm` schema definitions
- Use Drizzle's migration system for database schema changes

**Example**:

```typescript
import { drizzle } from 'drizzle-orm/...';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});
```

---

### 2. TypeScript Configuration

**MANDATORY**: All TypeScript code MUST use **TypeScript 5.0+ decorators** (Stage 3 decorators standard).

**Requirements**:

- ✅ **MUST** use TypeScript 5.0 or higher
- ✅ **MUST** enable modern decorators in `tsconfig.json`
- ❌ **DO NOT** use legacy experimental decorators
- ❌ **DO NOT** set `experimentalDecorators: true`

**tsconfig.json Configuration**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "experimentalDecorators": false, // MUST be false or omitted
    "emitDecoratorMetadata": false, // MUST be false or omitted
    "useDefineForClassFields": true, // Required for Stage 3 decorators
    "strict": true,
    "skipLibCheck": true
  }
}
```

**TypeScript 5.0+ Decorator Syntax**:

```typescript
// ✅ CORRECT: Modern TypeScript 5.0+ decorators (Stage 3)
function logged(value: Function, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  return function (this: any, ...args: any[]) {
    console.log(`Calling ${methodName} with:`, args);
    return value.apply(this, args);
  };
}

class DatabaseService {
  @logged
  async query(sql: string) {
    // Implementation
  }
}

// ❌ INCORRECT: Legacy experimental decorators (deprecated)
function OldDecorator(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  // DO NOT USE THIS STYLE
}
```

**Common Use Cases**:

**1. Method Decorators**:

```typescript
function cache(target: Function, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  const cache = new Map();

  return function (this: any, ...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = target.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

class DataProvider {
  @cache
  getList(resource: string) {
    // Implementation with automatic caching
  }
}
```

**2. Class Decorators**:

```typescript
function sealed<T extends { new (...args: any[]): {} }>(
  target: T,
  context: ClassDecoratorContext,
) {
  Object.seal(target);
  Object.seal(target.prototype);
}

@sealed
class ImmutableService {
  // Class is now sealed
}
```

**3. Accessor Decorators**:

```typescript
function validate(target: Function, context: ClassAccessorDecoratorContext) {
  return {
    get(this: any) {
      return target.get.call(this);
    },
    set(this: any, value: any) {
      if (typeof value !== 'string') {
        throw new TypeError('Value must be a string');
      }
      return target.set.call(this, value);
    },
  };
}

class User {
  @validate
  accessor name: string = '';
}
```

**Migration from Legacy Decorators**:

If upgrading from legacy decorators:

1. Update TypeScript to 5.0+
2. Remove `experimentalDecorators: true` from tsconfig.json
3. Update decorator signatures to use context parameter
4. Use `ClassMethodDecoratorContext`, `ClassDecoratorContext`, etc.
5. Test thoroughly as behavior may differ

**References**:

- [TypeScript 5.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
- [TC39 Decorators Proposal](https://github.com/tc39/proposal-decorators)

---

### 3. Database Driver Requirements

#### 3.1 Bun Runtime Environment

For Bun runtime, **MUST** use **bun:sql** (Bun's native SQL driver) to support all three database types:

| Database Type  | Driver     | Import Path                             | Drizzle Integration      | Status            |
| -------------- | ---------- | --------------------------------------- | ------------------------ | ----------------- |
| **PostgreSQL** | bun:sql    | `import { Database } from 'bun:sql'`    | `drizzle-orm/bun-sql`    | ✅ Supported      |
| **SQLite**     | bun:sqlite | `import { Database } from 'bun:sqlite'` | `drizzle-orm/bun-sqlite` | ✅ Supported      |
| **MySQL**      | bun:sql    | `import { Database } from 'bun:sql'`    | Custom Adapter (Pending) | ⏳ Future Support |

**Technical Documentation**:

- **Bun SQL API**: https://bun.com/docs/api/sql (或中文版: https://bun.net.cn/docs/api/sql)
- **Drizzle + Bun SQL Integration**: https://drizzle.zhcndoc.com/docs/connect-bun-sql (或英文版: https://orm.drizzle.team/docs/connect-bun-sql)
- **Drizzle + Bun SQLite**: https://orm.drizzle.team/docs/connect-bun-sqlite

**Current Support Status**:

- ✅ **PostgreSQL**: Drizzle ORM officially supports `bun:sql` via `drizzle-orm/bun-sql` package
- ✅ **SQLite**: Currently use `bun:sqlite` via `drizzle-orm/bun-sqlite` (will migrate to `bun:sql` when supported)
- ⏳ **MySQL**: Awaiting official Drizzle support for `bun:sql` MySQL backend (see GitHub issues #3985, #4013)

**Key Features of bun:sql**:

- Native built-in database driver (no external dependencies required)
- Unified API across SQLite, MySQL, and PostgreSQL (Bun 1.2+)
- High-performance native implementation (claims 50% faster)
- Connection string format:
  - SQLite: `sqlite:path/to/db.sqlite` or `sqlite::memory:`
  - MySQL: `mysql://user:password@host:port/database`
  - PostgreSQL: `postgresql://user:password@host:port/database`

**Example (PostgreSQL - Currently Supported)**:

```typescript
import { Database } from 'bun:sql';
import { drizzle } from 'drizzle-orm/bun-sql';
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

const postgres = new Database('postgresql://user:password@localhost:5432/mydb');
const db = drizzle(postgres);

// Define schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});
```

**Example (SQLite - Currently Using bun:sqlite)**:

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

// Define schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
```

**Example (MySQL - Custom Adapter for Future Support)**:

```typescript
// Note: This is a placeholder for future Drizzle support
// Currently requires a custom adapter until drizzle-orm/bun-sql supports MySQL

import { Database } from 'bun:sql';
import { int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
// Custom adapter to be implemented in src/adapters/bun/mysql-adapter.ts
import { createBunSqlMySQLAdapter } from './adapters/bun/mysql-adapter';

const mysql = new Database('mysql://root:password@localhost:3306/mydb');
// Custom adapter wraps bun:sql until official support
const db = createBunSqlMySQLAdapter(mysql);

// Define schema
const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
});

// TODO: Replace with official drizzle-orm/bun-sql when MySQL support is added
// Track: https://github.com/drizzle-team/drizzle-orm/issues/3985
```

#### 3.2 Node.js Runtime Environment

For Node.js runtime, **MUST** use the following specific drivers:

| Database Type  | Required Driver | Import Path                             | Drizzle Integration          | Prohibited Drivers        |
| -------------- | --------------- | --------------------------------------- | ---------------------------- | ------------------------- |
| **SQLite**     | better-sqlite3  | `import Database from 'better-sqlite3'` | `drizzle-orm/better-sqlite3` | ❌ node:sqlite (optional) |
| **MySQL**      | mysql2          | `import mysql from 'mysql2/promise'`    | `drizzle-orm/mysql2`         | ❌ mysql                  |
| **PostgreSQL** | postgres-js     | `import postgres from 'postgres'`       | `drizzle-orm/postgres-js`    | ❌ pg, node-postgres      |

**IMPORTANT**:

- ❌ **DO NOT** use `pg` or `node-postgres` packages for PostgreSQL
- ❌ **DO NOT** use legacy `mysql` package
- ✅ **ALWAYS** use the specified drivers above

**Examples**:

**SQLite (Node.js)**:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);
```

**MySQL (Node.js)**:

```typescript
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'mydb',
});
const db = drizzle(connection);
```

**PostgreSQL (Node.js)**:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const sql = postgres('postgresql://user:password@localhost:5432/dbname');
const db = drizzle(sql);
```

---

#### 3.3 Cloudflare D1 Environment

For Cloudflare D1 (Workers) runtime, **MUST** implement special build optimizations to minimize bundle size.

**Requirements**:

- ✅ **MUST** use `@cloudflare/d1` with `drizzle-orm/d1`
- ✅ **MUST** perform tree-shaking and dead code elimination
- ✅ **MUST** bundle only required drizzle-orm modules
- ✅ **MUST** target bundle size < 1MB (Worker size limit)
- ✅ **MUST** use module-specific imports (not barrel imports)

**Build Configuration**:

**1. Package Structure for D1**:

```json
{
  "name": "refine-sqlx",
  "scripts": {
    "build": "unbuild",
    "build:d1": "unbuild --stub=false --minify --target=es2022",
    "build:d1:analyze": "unbuild --minify && wrangler deploy --dry-run --outdir=dist"
  },
  "exports": {
    ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.ts" },
    "./d1": {
      "workerd": "./dist/d1.mjs",
      "import": "./dist/d1.mjs",
      "types": "./dist/d1.d.ts"
    }
  }
}
```

**2. Build Config (build.config.ts)**:

```typescript
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/index',
    // Separate D1 entry point for optimized bundling
    {
      input: 'src/d1/index',
      outDir: 'dist',
      name: 'd1',
      builder: 'rollup',
      rollup: {
        esbuild: { target: 'es2022', minify: true, treeShaking: true },
        resolve: {
          // Only bundle specific drizzle-orm modules
          exportConditions: ['workerd', 'worker', 'import'],
        },
      },
    },
  ],
  declaration: true,
  rollup: {
    emitCJS: false, // D1 only supports ESM
    esbuild: { minify: true },
  },
  externals: [
    // Don't bundle Cloudflare runtime APIs
    '@cloudflare/workers-types',
    'cloudflare:*',
  ],
});
```

**3. Optimized D1 Imports** (src/d1/index.ts):

```typescript
// ✅ CORRECT: Module-specific imports (enables tree-shaking)
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import { and, eq, or } from 'drizzle-orm/sqlite-core/expressions';

// ❌ INCORRECT: Barrel imports (bundles everything)
// import { drizzle, sqliteTable, eq } from 'drizzle-orm';

/**
 * Create Refine data provider for Cloudflare D1
 * Optimized bundle with tree-shaking
 */
export function createRefineD1(d1: D1Database) {
  const db = drizzle(d1);

  return {
    // Only include methods actually used
    getList: async (params) => {
      /* ... */
    },
    getOne: async (params) => {
      /* ... */
    },
    create: async (params) => {
      /* ... */
    },
    update: async (params) => {
      /* ... */
    },
    deleteOne: async (params) => {
      /* ... */
    },
  };
}

// Export only what's needed
export type { D1Database };
export { drizzle, sqliteTable, eq, and, or };
```

**4. Worker Entry Point** (worker.ts):

```typescript
import { createRefineD1 } from 'refine-sqlx/d1';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use optimized D1 build
    const dataProvider = createRefineD1(env.DB);

    // Handle Refine requests
    return new Response('OK');
  },
};
```

**5. Wrangler Configuration** (wrangler.toml):

```toml
name = "refine-d1-worker"
main = "dist/worker.mjs"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "production-db"
database_id = "your-database-id"

[build]
command = "bun run build:d1"

[build.upload]
format = "modules"
main = "./dist/worker.mjs"
```

**Bundle Size Optimization Techniques**:

**1. Use Conditional Exports**:

```typescript
// Only import what each runtime needs
if (import.meta.env.CLOUDFLARE_D1) {
  // D1-specific lightweight implementation
} else {
  // Full-featured implementation for other runtimes
}
```

**2. Lazy Loading for Non-Critical Features**:

```typescript
// Dynamic imports for optional features
const { validateSchema } = await import('./validators');
```

**3. Remove Development-Only Code**:

```typescript
// Use build-time flags
if (process.env.NODE_ENV === 'development') {
  // Development logging (removed in production)
}
```

**4. Analyze Bundle Size**:

```bash
# Build and analyze
bun run build:d1:analyze

# Check bundle size
wrangler deploy --dry-run --outdir=dist
# Should show: Total Upload: XXX KB / 1000 KB
```

**Bundle Size Targets**:

- **Minimum**: < 100 KB (core functionality only)
- **Recommended**: < 250 KB (with common features)
- **Maximum**: < 1000 KB (Workers size limit)
- **Realistic Goal**: 15-20 KB gzipped (standard build)
- **Optimized Goal**: 5-10 KB gzipped (with aggressive optimization)

**D1 Example Usage**:

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export interface Env {
  DB: D1Database;
}

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB);

    // Type-safe queries
    const allUsers = await db.select().from(users).all();

    return Response.json(allUsers);
  },
};
```

**Monitoring Bundle Size**:

```json
{
  "scripts": {
    "size": "bundlesize",
    "size:check": "bundlesize --config .bundlesizerc.json"
  }
}
```

**.bundlesizerc.json**:

```json
{
  "files": [
    { "path": "./dist/d1.mjs", "maxSize": "250 KB", "compression": "gzip" }
  ]
}
```

**References**:

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM with D1](https://orm.drizzle.team/docs/get-started-sqlite#cloudflare-d1)
- [Workers Size Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

### 4. Runtime Detection

The library MUST detect the runtime environment and select appropriate drivers:

```typescript
// Pseudo-code for runtime detection logic
if (isCloudflareD1()) {
  // Use optimized D1 build
  useD1Driver();
} else if (isBunRuntime()) {
  // Use bun:sql for all databases
  useBunSqlDriver();
} else if (isNodeRuntime()) {
  // Use specific Node.js drivers based on database type
  if (isSQLite) useBetterSqlite3();
  if (isMySQL) useMysql2();
  if (isPostgreSQL) usePostgresJs();
}
```

---

### 5. Type Safety Requirements

- All database queries MUST be type-safe using Drizzle ORM's type inference
- Schema definitions MUST export TypeScript types for table rows
- Query results MUST be properly typed (no `any` types)
- Use Drizzle's `.select()`, `.insert()`, `.update()`, `.delete()` methods

**Example**:

```typescript
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Type-safe query
const result: User[] = await db.select().from(users).where(eq(users.id, 1));
```

---

### 6. Transaction Handling

All multi-step operations MUST use transactions when supported:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Alice', email: 'alice@example.com' });
  await tx.insert(posts).values({ userId: 1, title: 'First Post' });
});
```

---

### 7. Error Handling

- Database errors MUST be caught and properly handled
- Provide meaningful error messages that don't expose sensitive information
- Log database errors appropriately for debugging
- Implement proper connection cleanup in error scenarios

---

### 8. Performance Guidelines

- Use prepared statements where possible (Drizzle handles this automatically)
- Implement pagination for large result sets
- Use database indexes appropriately (define in schema)
- Batch operations when possible using Drizzle's batch API
- Close database connections properly

---

### 9. Testing Requirements

- Write tests for all database operations
- Use in-memory databases (`:memory:`) for unit tests
- Mock Drizzle ORM instances for integration tests
- Test runtime detection logic separately
- Verify cross-platform compatibility

---

### 10. Migration Management

- Use Drizzle Kit for schema migrations
- Store migration files in `drizzle/` directory
- Version control all migration files
- Document migration procedures in project README

**Commands**:

```bash
# Generate migrations
drizzle-kit generate:sqlite
drizzle-kit generate:mysql
drizzle-kit generate:pg

# Run migrations
drizzle-kit push:sqlite
drizzle-kit push:mysql
drizzle-kit push:pg
```

---

### 11. Code Organization

```
src/
├── schema/              # Drizzle schema definitions
│   ├── sqlite.ts       # SQLite schemas
│   ├── mysql.ts        # MySQL schemas
│   └── postgres.ts     # PostgreSQL schemas
├── adapters/           # Database driver adapters
│   ├── bun/           # Bun runtime adapters
│   │   ├── postgres.ts      # bun:sql PostgreSQL adapter (drizzle-orm/bun-sql)
│   │   ├── sqlite.ts        # bun:sqlite adapter (drizzle-orm/bun-sqlite)
│   │   └── mysql-adapter.ts # Custom MySQL adapter for bun:sql (until Drizzle adds support)
│   ├── node/          # Node.js runtime adapters
│   │   ├── postgres.ts      # postgres-js adapter
│   │   ├── mysql.ts         # mysql2 adapter
│   │   └── sqlite.ts        # better-sqlite3 adapter
│   ├── d1/            # Cloudflare D1 adapters (optimized)
│   │   ├── index.ts         # D1 entry point (tree-shaken build)
│   │   └── provider.ts      # Optimized Refine data provider
│   └── factory.ts     # Driver factory with runtime detection
├── queries/           # Reusable query functions
└── data-provider.ts   # Main Refine integration
```

---

### 12. Version Management with Changesets

**MANDATORY**: This project MUST use **Changesets** for version management and publishing.

#### 12.1 Why Changesets?

Changesets provides:

- ✅ **Automated versioning** based on semantic versioning
- ✅ **Automated changelog generation** from changeset files
- ✅ **Multi-package monorepo support** (future-proof)
- ✅ **CI/CD integration** for automated releases
- ✅ **Clear change documentation** before merging PRs

#### 12.2 Installation and Setup

**Install Changesets**:

```bash
bun add -D @changesets/cli
bunx changeset init
```

**Configuration (.changeset/config.json)**:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Add npm scripts (package.json)**:

```json
{
  "scripts": {
    "changeset": "changeset",
    "changeset:version": "changeset version",
    "changeset:publish": "changeset publish",
    "version": "changeset version && bun install --lockfile-only",
    "release": "bun run build && changeset publish"
  }
}
```

#### 12.3 Development Workflow

**1. Making Changes**:

When you make changes that should be included in the next release:

```bash
# Create a changeset
bun changeset

# CLI will prompt:
# - Select change type: major | minor | patch
# - Write a summary of the changes
```

Example changeset file (`.changeset/cool-feature.md`):

```markdown
---
'refine-sqlx': minor
---

Add support for Cloudflare D1 transaction API wrapper
```

**Change Type Guidelines**:

- **major** (1.0.0 → 2.0.0): Breaking changes
- **minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

**2. Committing Changesets**:

```bash
# Stage the changeset file
git add .changeset/cool-feature.md

# Commit with descriptive message
git commit -m "feat: add D1 transaction wrapper

- Implement transaction API for D1 using batch
- Provide consistent API across all runtimes
- Add documentation and examples
"
```

**3. Version Bump**:

Before releasing, consume all changesets:

```bash
# This will:
# 1. Update package.json version
# 2. Update CHANGELOG.md
# 3. Delete consumed changeset files
bun run changeset:version

# Commit version changes
git add .
git commit -m "chore: release v0.3.0"
```

**4. Publishing**:

```bash
# Build and publish to npm
bun run release

# Or manual steps:
bun run build
bun run changeset:publish
```

#### 12.4 CI/CD Integration (GitHub Actions)

**Automated Release Workflow** (`.github/workflows/release.yml`):

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: bun run release
          version: bun run version
          commit: 'chore: release package'
          title: 'chore: release package'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Required GitHub Secrets**:

- `GITHUB_TOKEN`: Automatically provided by GitHub
- `NPM_TOKEN`: Create at https://www.npmjs.com/settings/tokens

#### 12.5 Changeset Examples

**Example 1: Bug Fix (patch)**:

```bash
bun changeset
```

```markdown
---
'refine-sqlx': patch
---

Fix D1 batch query error handling to properly propagate exceptions
```

**Example 2: New Feature (minor)**:

```bash
bun changeset
```

```markdown
---
'refine-sqlx': minor
---

Add PostgreSQL support with postgres-js driver integration
```

**Example 3: Breaking Change (major)**:

```bash
bun changeset
```

```markdown
---
'refine-sqlx': major
---

BREAKING: Remove deprecated `createRefineSQL` string overload

Migration guide:

- Old: `createRefineSQL('./db.sqlite')`
- New: `createRefineSQL({ connection: './db.sqlite', schema })`
```

#### 12.6 Changelog Generation

Changesets automatically generates `CHANGELOG.md`:

```markdown
# refine-sqlx

## 0.3.0

### Minor Changes

- abc123: Add support for Cloudflare D1 transaction API wrapper
- def456: Add PostgreSQL support with postgres-js driver integration

### Patch Changes

- ghi789: Fix D1 batch query error handling to properly propagate exceptions

## 0.2.1

### Patch Changes

- jkl012: Fix transaction rollback on error
```

#### 12.7 Best Practices

**DO**:

- ✅ Create one changeset per PR
- ✅ Write clear, user-facing summaries
- ✅ Use semantic versioning correctly
- ✅ Include migration guides for breaking changes
- ✅ Commit changeset files with your code changes

**DON'T**:

- ❌ Manually edit `package.json` version
- ❌ Manually edit `CHANGELOG.md`
- ❌ Skip creating changesets for user-facing changes
- ❌ Create changesets for internal changes (tests, docs)
- ❌ Publish directly without running `changeset version`

#### 12.8 Monorepo Support (Future)

If the project becomes a monorepo:

```json
{ "packages": ["packages/*"], "version": "independent" }
```

Create changesets for specific packages:

```bash
bun changeset
# Select: @refine-sqlx/core, @refine-sqlx/d1, etc.
```

---

## Dependencies

### Required Dependencies

```json
{
  "dependencies": { "drizzle-orm": "^0.x.x" },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@cloudflare/workers-types": "^4.x.x",
    "@changesets/cli": "^2.x.x",
    "wrangler": "^3.x.x",
    "unbuild": "^2.x.x",
    "bundlesize": "^0.18.x"
  },
  "peerDependencies": {
    "better-sqlite3": "^9.x.x",
    "mysql2": "^3.x.x",
    "postgres": "^3.x.x"
  }
}
```

### Optional Dependencies (based on runtime)

- Bun: No additional dependencies (uses built-in `bun:sql`)
- Node.js: Install specific drivers as needed
- Cloudflare D1: No additional dependencies (uses built-in D1 API)

---

## Compliance Checklist

When implementing database features, ensure:

- [ ] Using drizzle-orm for all database operations
- [ ] Using TypeScript 5.0+ with modern decorators (Stage 3)
- [ ] tsconfig.json has experimentalDecorators disabled (false or omitted)
- [ ] Correct driver selected based on runtime (Bun vs Node.js vs D1)
- [ ] For Node.js + PostgreSQL: Using postgres-js (NOT pg or node-postgres)
- [ ] For Node.js + MySQL: Using mysql2 (NOT mysql)
- [ ] For Node.js + SQLite: Using better-sqlite3
- [ ] For Bun + PostgreSQL: Using bun:sql with drizzle-orm/bun-sql
- [ ] For Bun + SQLite: Using bun:sqlite with drizzle-orm/bun-sqlite (migrate to bun:sql when supported)
- [ ] For Bun + MySQL: Custom adapter for bun:sql (until official Drizzle support)
- [ ] For Cloudflare D1: Optimized build with tree-shaking and bundle size < 250 KB
- [ ] For D1: Using module-specific imports (NOT barrel imports from drizzle-orm)
- [ ] For D1: Separate entry point (./d1) with workerd export condition
- [ ] For D1: Bundle size monitoring configured (bundlesize or similar)
- [ ] Type-safe schema definitions
- [ ] Proper error handling implemented
- [ ] Transactions used for multi-step operations
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] **Changesets created for all user-facing changes**
- [ ] **Version bumped using `changeset version` before release**
- [ ] **CHANGELOG.md automatically generated (do not edit manually)**

---

## References

### Official Documentation

**Cloudflare**:

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/) - Official D1 database docs
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/) - Workers platform
- [Workers Size Limits](https://developers.cloudflare.com/workers/platform/limits/) - Bundle size constraints
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) - D1 deployment tool

**TypeScript**:

- [TypeScript 5.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html) - Modern decorators support
- [TypeScript Decorators Documentation](https://www.typescriptlang.org/docs/handbook/decorators.html) - Official decorator guide
- [TC39 Decorators Proposal](https://github.com/tc39/proposal-decorators) - Stage 3 decorators specification

**Bun SQL**:

- [Bun SQL API Documentation](https://bun.com/docs/api/sql) - Official Bun SQL API reference
- [Bun SQL (中文版)](https://bun.net.cn/docs/api/sql) - Chinese version
- [Bun SQL (English - bun.sh)](https://bun.sh/docs/api/sql) - Alternative English version

**Drizzle ORM**:

- [Drizzle ORM Documentation](https://orm.drizzle.team/) - Main documentation
- [Drizzle ORM (中文)](https://drizzle.zhcndoc.com/) - Chinese documentation
- [Drizzle with Bun SQL (PostgreSQL)](https://drizzle.zhcndoc.com/docs/connect-bun-sql) - Integration guide for Bun SQL
- [Drizzle with Bun SQLite](https://orm.drizzle.team/docs/connect-bun-sqlite) - Bun SQLite integration
- [Drizzle with better-sqlite3](https://orm.drizzle.team/docs/get-started-sqlite#better-sqlite3)
- [Drizzle with mysql2](https://orm.drizzle.team/docs/get-started-mysql#mysql2)
- [Drizzle with postgres-js](https://orm.drizzle.team/docs/get-started-postgresql#postgresjs)

**GitHub Issues (Tracking Future Support)**:

- [Feature Request: bun 1.2 SQL driver support (#3985)](https://github.com/drizzle-team/drizzle-orm/issues/3985) - MySQL/SQLite support for bun:sql
- [Feature Request: Support for Bun.sql (#4013)](https://github.com/drizzle-team/drizzle-orm/issues/4013) - General bun:sql support

**Database Drivers (Node.js)**:

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite3 driver
- [mysql2](https://github.com/sidorares/node-mysql2) - MySQL driver
- [postgres-js](https://github.com/porsager/postgres) - PostgreSQL driver

**Version Management**:

- [Changesets Documentation](https://github.com/changesets/changesets) - Automated version management
- [Changesets GitHub Action](https://github.com/changesets/action) - CI/CD integration

---

## Version History

- **v1.5.0** (2025-10-15): Added Changesets version management requirements
  - Added mandatory Changesets requirement for version management
  - Documented installation and setup process
  - Provided complete development workflow (create, commit, version, publish)
  - Added CI/CD integration with GitHub Actions
  - Included changeset examples for patch, minor, and major changes
  - Documented changelog generation process
  - Added best practices and anti-patterns
  - Included monorepo support documentation for future use
  - Updated dependencies to include @changesets/cli
  - Updated compliance checklist with Changesets requirements
  - Added Changesets documentation references
- **v1.4.0** (2025-10-14): Added Cloudflare D1 build optimization requirements
  - Added dedicated D1 environment section (3.3)
  - Specified tree-shaking and bundle size optimization requirements
  - Defined bundle size targets: < 100 KB (min), < 250 KB (recommended), < 1000 KB (max)
  - Added unbuild configuration for D1-specific builds
  - Documented module-specific imports requirement (vs barrel imports)
  - Added separate package export path for D1 (`./d1`)
  - Provided wrangler.toml configuration example
  - Added bundle size monitoring setup (bundlesize)
  - Documented optimization techniques (conditional exports, lazy loading, dead code elimination)
  - Added D1 to runtime detection logic
  - Updated code organization with D1 adapter directory
  - Added D1-specific compliance checklist items
  - Added Cloudflare documentation references
  - Updated dependencies with Wrangler, unbuild, and bundlesize
- **v1.3.0** (2025-10-14): Added TypeScript 5.0+ decorator requirements
  - Added mandatory TypeScript 5.0+ requirement
  - Specified Stage 3 decorators standard (modern decorators)
  - Prohibited legacy experimental decorators
  - Added tsconfig.json configuration requirements
  - Provided decorator syntax examples (method, class, accessor)
  - Added migration guide from legacy decorators
  - Updated compliance checklist with TypeScript decorator requirements
  - Added TypeScript 5.0 and TC39 decorators to references
  - Updated dependencies to require TypeScript 5.0+
- **v1.2.0** (2025-10-14): Corrected Drizzle ORM + Bun SQL integration
  - Fixed Drizzle integration table: PostgreSQL uses `drizzle-orm/bun-sql` ✅
  - Clarified SQLite currently uses `bun:sqlite` with `drizzle-orm/bun-sqlite` ✅
  - Added MySQL as pending support with custom adapter approach ⏳
  - Added support status column to Bun driver table
  - Documented GitHub issues tracking future MySQL/SQLite support for bun:sql
  - Expanded code organization with detailed adapter structure
  - Added custom MySQL adapter placeholder and implementation notes
  - Updated compliance checklist with specific Bun driver requirements
- **v1.1.1** (2025-10-14): Updated documentation URLs
  - Updated primary Bun SQL documentation to https://bun.com/docs/api/sql
  - Updated Drizzle Chinese documentation to https://drizzle.zhcndoc.com/
  - Updated Drizzle + Bun SQL integration guide to https://drizzle.zhcndoc.com/docs/connect-bun-sql
  - Added alternative documentation URLs for better accessibility
- **v1.1.0** (2025-10-14): Enhanced technical documentation
  - Added Bun SQL API documentation links (Chinese and English)
  - Added Drizzle + Bun SQL integration guide reference
  - Expanded Bun SQL examples for all three database types (SQLite, MySQL, PostgreSQL)
  - Added connection string format specifications
  - Reorganized references section with categorized documentation links
- **v1.0.0** (2025-10-14): Initial specification document
  - Defined drizzle-orm as mandatory ORM
  - Specified driver requirements for Bun and Node.js environments
  - Prohibited pg/node-postgres drivers for PostgreSQL
