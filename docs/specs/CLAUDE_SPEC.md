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

**MANDATORY**: Testing framework selection MUST match the runtime environment, but test code SHOULD be shared as much as possible.

**IMPORTANT**: Bun test is designed to be **Jest-compatible**. The API is intentionally similar to make migration and code sharing easier.

#### 9.1 Core Principles

**Code Sharing Requirements**:

- ✅ **MUST** maximize code sharing between Bun and Node.js test environments
- ✅ **MUST** write test logic in a framework-agnostic way when possible
- ✅ **MUST** use conditional imports for test framework APIs (`bun:test` vs `@jest/globals`)
- ✅ **SHOULD** extract test logic into shared functions/utilities
- ✅ **SHOULD** use the same test file names and structure for both environments
- ✅ **MUST** create adapter layers for API differences (mainly mock functions)

**Framework Requirements**:

- ✅ **Bun Environment**: MUST use `bun test` (native test runner, Jest-compatible API)
- ✅ **Node.js Environment**: MUST use `jest` for compatibility
- ❌ **DO NOT** use Jest/Vitest in Bun environment
- ❌ **DO NOT** use `bun:test` in Node.js environment

**Jest Compatibility Note**:

Bun test's API is designed to be compatible with Jest, making code sharing straightforward. Main compatible APIs:

- `describe`, `it`, `test` - Test structure (identical)
- `expect` - Assertions (identical)
- `beforeEach`, `afterEach`, `beforeAll`, `afterAll` - Lifecycle hooks (identical)
- `mock()`, `spyOn()` - Mocking (similar, slight API differences)

#### 9.2 Bun Environment Testing

For Bun runtime, **MUST** use **Bun's native test runner**:

**Requirements**:

- ✅ **MUST** use `bun test` command
- ✅ **MUST** write tests using Bun's built-in test API
- ❌ **DO NOT** use Jest, Vitest, or other Node.js test runners in Bun environment
- ✅ **MUST** leverage Bun's native performance advantages

**Bun Test API Compatibility with Jest**:

Bun's test runner is intentionally Jest-compatible. This means most test code can be shared between Bun and Jest with minimal changes:

| Feature            | Bun Test API       | Jest API                     | Compatible?  | Notes                                     |
| ------------------ | ------------------ | ---------------------------- | ------------ | ----------------------------------------- |
| Test suites        | `describe()`       | `describe()`                 | ✅ Yes       | Identical API                             |
| Test cases         | `test()` / `it()`  | `test()` / `it()`            | ✅ Yes       | Identical API                             |
| Assertions         | `expect()`         | `expect()`                   | ✅ Yes       | Identical API                             |
| Before/After hooks | `beforeEach()` etc | `beforeEach()` etc           | ✅ Yes       | Identical API                             |
| Mock functions     | `mock()`           | `jest.fn()`                  | ⚠️ Similar   | Different function names, same behavior   |
| Spy functions      | `spyOn()`          | `jest.spyOn()`               | ⚠️ Similar   | Different import paths                    |
| Mock modules       | `mock.module()`    | `jest.mock()`                | ⚠️ Different | Different API structure                   |
| Timers             | Limited            | `jest.useFakeTimers()`       | ⚠️ Different | Jest has more comprehensive timer mocking |
| Snapshots          | Basic support      | `expect().toMatchSnapshot()` | ⚠️ Different | Jest has more robust snapshot testing     |

**Key Differences**:

**1. Mock Function Creation**:

```typescript
// Bun test

// Jest
import { jest } from '@jest/globals';
import { mock } from 'bun:test';

const mockFn = mock((x: number) => x * 2);

const mockFn = jest.fn((x: number) => x * 2);
```

**2. Module Mocking**:

```typescript
// Bun test

// Jest
import { jest } from '@jest/globals';
import { mock } from 'bun:test';

mock.module('./database', () => ({ connect: mock(() => 'mocked connection') }));

jest.mock('./database', () => ({
  connect: jest.fn(() => 'mocked connection'),
}));
```

**Test File Structure**:

```typescript
// test/example.test.ts
import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/bun-sqlite';

describe('Bun SQLite Integration', () => {
  test('should create and query database', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    // Test implementation
    expect(db).toBeDefined();
  });
});
```

**Running Tests**:

```bash
# Run all tests
bun test

# Run specific test file
bun test test/integration.test.ts

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

**Bun Test Documentation**:

- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Bun Test API Reference](https://bun.sh/docs/test/writing)

#### 9.3 Node.js Environment Testing

For Node.js runtime, **MUST** use **Jest** for compatibility:

**Requirements**:

- ✅ **MUST** use `jest` command
- ✅ **MUST** ensure compatibility with Node.js testing conventions
- ❌ **DO NOT** use Bun test runner in Node.js environment
- ✅ **MUST** configure Jest for TypeScript support

**Jest Configuration** (jest.config.js):

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json', // Separate config for tests
      },
    ],
  },
  testMatch: ['**/test/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/test/integration/'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
```

**Test File Structure**:

```typescript
// test/example.test.ts
import { describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

describe('Node.js SQLite Integration', () => {
  it('should create and query database', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    // Test implementation
    expect(db).toBeDefined();
  });
});
```

**Running Tests**:

```bash
# Run all tests
npm test
# Or
jest

# Run specific test file
jest test/integration.test.ts

# Watch mode
jest --watch

# Coverage
jest --coverage
```

#### 9.4 Shared Test Code Pattern (RECOMMENDED)

**CRITICAL**: To maximize code reuse, use conditional imports for test framework APIs.

**Key Insight**: Since Bun test is Jest-compatible, most test code can be shared directly with minimal adaptation.

**Pattern 1: Simple Conditional Import (Best for most tests)**:

```typescript
// test/utils.test.ts - Shared between Bun and Jest

// Conditional import based on runtime
const testFramework =
  typeof Bun !== 'undefined' ?
    await import('bun:test')
  : await import('@jest/globals');

const { describe, expect, it } = testFramework;

// Rest of test code is identical for both environments
describe('Utility Functions', () => {
  it('should format dates correctly', () => {
    const result = formatDate(new Date('2024-01-01'));
    expect(result).toBe('2024-01-01');
  });
});
```

**Pattern 2: Adapter Layer for Mock APIs (Recommended)**:

Since mock APIs have slight differences, create an adapter to unify them. This is the **RECOMMENDED** approach for production codebases.

**Why Use an Adapter?**

- ✅ **Single source of truth**: One file controls all test framework differences
- ✅ **Type safety**: Proper TypeScript types for all test utilities
- ✅ **Easy maintenance**: Update adapter once, all tests benefit
- ✅ **Clear abstraction**: Test files don't need to know about runtime differences
- ✅ **Future-proof**: Easy to add new runtimes or frameworks later

**Basic Adapter Implementation**:

````typescript
// test/helpers/test-adapter.ts - Unified test API

/**
 * Runtime detection: Check if running in Bun environment
 * This uses a simple check for the global Bun object
 */
const isBun = typeof Bun !== 'undefined';

// Import appropriate test framework based on runtime
const bunTest = isBun ? await import('bun:test') : null;
const jestTest = !isBun ? await import('@jest/globals') : null;

// ============================================================================
// CORE TEST APIs (100% Compatible - No Adaptation Needed)
// ============================================================================
// These APIs are identical in both Bun test and Jest, so we can export them directly

export const describe = isBun ? bunTest!.describe : jestTest!.describe;
export const it = isBun ? bunTest!.it : jestTest!.it;
export const test = isBun ? bunTest!.test : jestTest!.test;
export const expect = isBun ? bunTest!.expect : jestTest!.expect;
export const beforeEach = isBun ? bunTest!.beforeEach : jestTest!.beforeEach;
export const afterEach = isBun ? bunTest!.afterEach : jestTest!.afterEach;
export const beforeAll = isBun ? bunTest!.beforeAll : jestTest!.beforeAll;
export const afterAll = isBun ? bunTest!.afterAll : jestTest!.afterAll;

// ============================================================================
// MOCK APIs (Require Adaptation)
// ============================================================================
// These APIs have different names/structures between frameworks

/**
 * Create a mock function (works in both Bun and Jest)
 *
 * Example:
 * ```typescript
 * const mockFn = createMock(() => 'hello');
 * mockFn(); // returns 'hello'
 * expect(mockFn).toHaveBeenCalled();
 * ```
 */
export function createMock<T extends (...args: any[]) => any>(
  implementation?: T,
): T {
  if (isBun) {
    return bunTest!.mock(implementation) as T;
  } else {
    return jestTest!.jest.fn(implementation) as unknown as T;
  }
}

/**
 * Create a spy on an object method (works in both Bun and Jest)
 *
 * Example:
 * ```typescript
 * const obj = { method: () => 'original' };
 * const spy = createSpyOn(obj, 'method');
 * obj.method(); // still calls original
 * expect(spy).toHaveBeenCalled();
 * ```
 */
export function createSpyOn<T extends object, K extends keyof T>(
  object: T,
  method: K,
): any {
  if (isBun) {
    return bunTest!.spyOn(object, method as any);
  } else {
    return jestTest!.jest.spyOn(object, method as any);
  }
}

// ============================================================================
// RUNTIME DETECTION FLAGS
// ============================================================================
// Export flags for conditional logic in tests when needed

export const isRunningInBun = isBun;
export const isRunningInJest = !isBun;

// ============================================================================
// OPTIONAL: Framework-Specific Utilities
// ============================================================================

/**
 * Access to Jest-specific utilities (only available in Jest environment)
 * Returns undefined in Bun environment
 */
export const jest = !isBun ? jestTest!.jest : undefined;
````

**Why This Pattern Works:**

1. **Core APIs are identical**: `describe`, `it`, `expect`, `beforeEach`, etc. work the same way in both frameworks
2. **Mock APIs need adaptation**: `mock()` vs `jest.fn()` have different names but same behavior
3. **Type safety preserved**: TypeScript types flow through the adapter correctly
4. **Runtime detection is simple**: `typeof Bun !== 'undefined'` is reliable and fast
5. **Easy to extend**: Adding new utilities is straightforward

**Advanced Adapter Example with Additional Features**:

For production use, you may want a more comprehensive adapter with module mocking, timer utilities, and mock verification helpers:

````typescript
// test/helpers/test-adapter.ts - Enhanced test adapter with advanced features

const isBun = typeof Bun !== 'undefined';

const bunTest = isBun ? await import('bun:test') : null;
const jestTest = !isBun ? await import('@jest/globals') : null;

// ============================================================================
// CORE TEST APIs (100% Compatible)
// ============================================================================

export const describe = isBun ? bunTest!.describe : jestTest!.describe;
export const it = isBun ? bunTest!.it : jestTest!.it;
export const test = isBun ? bunTest!.test : jestTest!.test;
export const expect = isBun ? bunTest!.expect : jestTest!.expect;
export const beforeEach = isBun ? bunTest!.beforeEach : jestTest!.beforeEach;
export const afterEach = isBun ? bunTest!.afterEach : jestTest!.afterEach;
export const beforeAll = isBun ? bunTest!.beforeAll : jestTest!.beforeAll;
export const afterAll = isBun ? bunTest!.afterAll : jestTest!.afterAll;

// ============================================================================
// MOCK FUNCTION APIs
// ============================================================================

/**
 * Create a mock function with optional implementation
 *
 * @example
 * ```typescript
 * // Simple mock
 * const mockFn = createMock();
 *
 * // Mock with implementation
 * const addMock = createMock((a: number, b: number) => a + b);
 *
 * // Verify calls
 * expect(mockFn).toHaveBeenCalled();
 * expect(mockFn).toHaveBeenCalledWith(1, 2);
 * ```
 */
export function createMock<T extends (...args: any[]) => any>(
  implementation?: T,
): T {
  if (isBun) {
    return bunTest!.mock(implementation) as T;
  } else {
    return jestTest!.jest.fn(implementation) as unknown as T;
  }
}

/**
 * Create a spy on an existing object method
 *
 * @example
 * ```typescript
 * const database = {
 *   query: (sql: string) => { ... }
 * };
 *
 * const spy = createSpyOn(database, 'query');
 * database.query('SELECT * FROM users'); // Original method still works
 * expect(spy).toHaveBeenCalledWith('SELECT * FROM users');
 * ```
 */
export function createSpyOn<T extends object, K extends keyof T>(
  object: T,
  method: K,
): any {
  if (isBun) {
    return bunTest!.spyOn(object, method as any);
  } else {
    return jestTest!.jest.spyOn(object, method as any);
  }
}

// ============================================================================
// MODULE MOCKING APIs
// ============================================================================

/**
 * Mock an entire module (advanced usage)
 *
 * IMPORTANT: Module mocking has different semantics in Bun vs Jest
 * - In Bun: Use mock.module() before importing the module
 * - In Jest: Use jest.mock() at the top of the file (hoisted)
 *
 * @example
 * ```typescript
 * mockModule('./database', () => ({
 *   connect: createMock(() => Promise.resolve('connected')),
 *   query: createMock(() => Promise.resolve([])),
 * }));
 * ```
 */
export function mockModule(modulePath: string, factory: () => any): void {
  if (isBun) {
    bunTest!.mock.module(modulePath, factory);
  } else {
    jestTest!.jest.mock(modulePath, factory);
  }
}

// ============================================================================
// MOCK LIFECYCLE Management
// ============================================================================

/**
 * Clear all mock call history (but keep implementations)
 *
 * @example
 * ```typescript
 * const mockFn = createMock();
 * mockFn(1, 2);
 * expect(mockFn).toHaveBeenCalledTimes(1);
 *
 * clearAllMocks();
 * expect(mockFn).toHaveBeenCalledTimes(0); // Call history cleared
 * mockFn(3, 4);
 * expect(mockFn).toHaveBeenCalledTimes(1); // New calls still tracked
 * ```
 */
export function clearAllMocks(): void {
  if (isBun) {
    // Bun automatically clears mocks between tests
    // No action needed
  } else {
    jestTest!.jest.clearAllMocks();
  }
}

/**
 * Reset all mocks (clear history AND implementations)
 *
 * @example
 * ```typescript
 * const mockFn = createMock(() => 'hello');
 * mockFn(); // returns 'hello'
 *
 * resetAllMocks();
 * mockFn(); // returns undefined (implementation reset)
 * ```
 */
export function resetAllMocks(): void {
  if (isBun) {
    // Bun automatically resets mocks between tests
    // No action needed
  } else {
    jestTest!.jest.resetAllMocks();
  }
}

/**
 * Restore all mocked functions to their original implementations
 *
 * Note: In Bun, mocks are automatically restored between tests
 * In Jest, this restores spies to their original implementations
 */
export function restoreAllMocks(): void {
  if (isBun) {
    // Bun automatically restores mocks between tests
    // No action needed
  } else {
    jestTest!.jest.restoreAllMocks();
  }
}

// ============================================================================
// TYPE-SAFE MOCK VERIFICATION HELPERS
// ============================================================================

/**
 * Type-safe mock verification interface
 * Provides type-checked methods for verifying mock calls
 */
export interface MockVerification<T extends (...args: any[]) => any> {
  /** Verify the mock was called at least once */
  toHaveBeenCalled(): void;

  /** Verify the mock was called exactly N times */
  toHaveBeenCalledTimes(times: number): void;

  /** Verify the mock was called with specific arguments (type-safe) */
  toHaveBeenCalledWith(...args: Parameters<T>): void;

  /** Verify the mock returned a specific value (type-safe) */
  toHaveReturnedWith(value: ReturnType<T>): void;

  /** Verify the mock was last called with specific arguments */
  toHaveBeenLastCalledWith(...args: Parameters<T>): void;

  /** Verify the mock was called with arguments matching a pattern */
  toHaveBeenNthCalledWith(nthCall: number, ...args: Parameters<T>): void;
}

/**
 * Create a type-safe mock verification helper
 *
 * @example
 * ```typescript
 * const addMock = createMock((a: number, b: number) => a + b);
 * addMock(1, 2);
 *
 * const verify = verifyMock(addMock);
 * verify.toHaveBeenCalled();
 * verify.toHaveBeenCalledWith(1, 2); // Type-safe: only accepts (number, number)
 * verify.toHaveReturnedWith(3); // Type-safe: only accepts number
 * ```
 */
export function verifyMock<T extends (...args: any[]) => any>(
  mockFn: T,
): MockVerification<T> {
  return {
    toHaveBeenCalled: () => expect(mockFn).toHaveBeenCalled(),
    toHaveBeenCalledTimes: (times) =>
      expect(mockFn).toHaveBeenCalledTimes(times),
    toHaveBeenCalledWith: (...args) =>
      expect(mockFn).toHaveBeenCalledWith(...args),
    toHaveReturnedWith: (value) => expect(mockFn).toHaveReturnedWith(value),
    toHaveBeenLastCalledWith: (...args) =>
      expect(mockFn).toHaveBeenLastCalledWith(...args),
    toHaveBeenNthCalledWith: (nthCall, ...args) =>
      expect(mockFn).toHaveBeenNthCalledWith(nthCall, ...args),
  };
}

// ============================================================================
// ASYNC TESTING HELPERS
// ============================================================================

/**
 * Wait for all pending promises to resolve
 * Useful for testing async operations
 *
 * @example
 * ```typescript
 * const mockAsync = createMock(() => Promise.resolve('done'));
 * const promise = mockAsync();
 *
 * await flushPromises();
 * expect(mockAsync).toHaveBeenCalled();
 * ```
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create a resolved promise (useful for mock implementations)
 *
 * @example
 * ```typescript
 * const mockDb = {
 *   query: createMock(() => resolvedPromise([{ id: 1 }])),
 * };
 * ```
 */
export function resolvedPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/**
 * Create a rejected promise (useful for testing error cases)
 *
 * @example
 * ```typescript
 * const mockDb = {
 *   query: createMock(() => rejectedPromise(new Error('Connection failed'))),
 * };
 * ```
 */
export function rejectedPromise(error: Error): Promise<never> {
  return Promise.reject(error);
}

// ============================================================================
// RUNTIME DETECTION FLAGS
// ============================================================================

/** True if running in Bun test environment */
export const isRunningInBun = isBun;

/** True if running in Jest test environment */
export const isRunningInJest = !isBun;

/**
 * Get the name of the current test framework
 * Returns 'bun' or 'jest'
 */
export function getTestFramework(): 'bun' | 'jest' {
  return isBun ? 'bun' : 'jest';
}

// ============================================================================
// FRAMEWORK-SPECIFIC UTILITIES (Optional)
// ============================================================================

/**
 * Access to Jest-specific utilities
 * Only available in Jest environment, undefined in Bun
 *
 * @example
 * ```typescript
 * if (jest) {
 *   jest.useFakeTimers(); // Jest-only feature
 * }
 * ```
 */
export const jest = !isBun ? jestTest!.jest : undefined;

/**
 * Access to Bun-specific mock utilities
 * Only available in Bun environment, undefined in Jest
 */
export const bunMock = isBun ? bunTest!.mock : undefined;
````

**Key Features of the Advanced Adapter:**

1. **Complete API coverage**: All common testing operations covered
2. **Type safety**: Full TypeScript type checking for mock verifications
3. **Async helpers**: Utilities for testing async operations
4. **Mock lifecycle management**: Clear, reset, and restore functions
5. **Comprehensive documentation**: JSDoc comments with examples
6. **Runtime detection**: Helper functions to check current environment
7. **Framework-specific access**: Optional access to Jest or Bun-specific features

**Benefits:**

- ✅ **Zero test code changes**: Tests work in both environments without modification
- ✅ **Type-safe**: TypeScript catches errors at compile time
- ✅ **Self-documenting**: JSDoc comments explain usage
- ✅ **Easy to test**: Adapter itself can be tested
- ✅ **Performance**: No runtime overhead, just conditional exports

**Usage with Adapter**:

Once you have the adapter in place, writing tests becomes simple and framework-agnostic:

```typescript
// test/data-provider.test.ts - Works in both Bun and Jest with zero changes

import { createRefineProvider } from '../src';
import {
  afterEach,
  beforeEach,
  clearAllMocks,
  createMock,
  createSpyOn,
  describe,
  expect,
  isRunningInBun,
  it,
  verifyMock,
} from './helpers/test-adapter';

// Import appropriate database driver based on runtime
const Database =
  isRunningInBun ?
    (await import('bun:sqlite')).Database
  : (await import('better-sqlite3')).default;

describe('Refine Data Provider', () => {
  let db: any;
  let provider: any;

  beforeEach(() => {
    // Both Bun and Jest support :memory: databases
    db = new Database(':memory:');

    // Setup test schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        status TEXT
      )
    `);

    // Insert test data
    db.exec(`
      INSERT INTO users (id, name, email, age, status) VALUES
      (1, 'Alice', 'alice@example.com', 30, 'active'),
      (2, 'Bob', 'bob@example.com', 25, 'active'),
      (3, 'Charlie', 'charlie@example.com', 35, 'inactive')
    `);

    provider = createRefineProvider({ db });
  });

  afterEach(() => {
    db.close();
    clearAllMocks();
  });

  describe('getList', () => {
    it('should return list of users with pagination', async () => {
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 },
      });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.data[0].name).toBe('Alice');
    });

    it('should filter users by status', async () => {
      const result = await provider.getList({
        resource: 'users',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((u: any) => u.status === 'active')).toBe(true);
    });

    it('should sort users by age descending', async () => {
      const result = await provider.getList({
        resource: 'users',
        sorters: [{ field: 'age', order: 'desc' }],
      });

      expect(result.data[0].name).toBe('Charlie'); // age 35
      expect(result.data[1].name).toBe('Alice'); // age 30
      expect(result.data[2].name).toBe('Bob'); // age 25
    });
  });

  describe('getOne', () => {
    it('should return a single user by ID', async () => {
      const result = await provider.getOne({ resource: 'users', id: 1 });

      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('Alice');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        provider.getOne({ resource: 'users', id: 999 }),
      ).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const newUser = {
        name: 'David',
        email: 'david@example.com',
        age: 28,
        status: 'active',
      };

      const result = await provider.create({
        resource: 'users',
        variables: newUser,
      });

      expect(result.data.id).toBeDefined();
      expect(result.data.name).toBe('David');

      // Verify it's in the database
      const allUsers = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 100 },
      });
      expect(allUsers.total).toBe(4);
    });
  });

  describe('with mocks', () => {
    it('should handle mocked database calls', async () => {
      // Create a mock database object
      const mockDb = {
        exec: createMock(),
        prepare: createMock(() => ({
          all: createMock(() => [
            { id: 1, name: 'Mocked User', email: 'mock@example.com' },
          ]),
        })),
      };

      // Use the mock in your provider
      const mockProvider = createRefineProvider({ db: mockDb });

      // Verify mock was called (this works in both Bun and Jest)
      const verify = verifyMock(mockDb.exec);
      verify.toHaveBeenCalled(); // If provider calls exec during setup
    });

    it('should spy on database methods', () => {
      // Create a spy on the real database
      const execSpy = createSpyOn(db, 'exec');

      // Perform operations
      db.exec('CREATE TABLE test (id INTEGER)');

      // Verify spy was called with correct SQL
      const verify = verifyMock(execSpy);
      verify.toHaveBeenCalledWith('CREATE TABLE test (id INTEGER)');
    });
  });
});
```

**What Makes This Test Framework-Agnostic:**

1. **All imports from adapter**: No direct `bun:test` or `@jest/globals` imports
2. **Conditional database import**: Uses `isRunningInBun` to load correct SQLite driver
3. **Standard test structure**: `describe`, `it`, `expect` work identically
4. **Unified mocking**: `createMock()` and `createSpyOn()` work the same way
5. **Type-safe verification**: `verifyMock()` provides type-checked assertions

**Running the Tests:**

```bash
# In Bun environment
bun test test/data-provider.test.ts

# In Node.js environment with Jest
jest test/data-provider.test.ts

# Both commands run THE SAME test file with zero modifications!
```

**Advanced Usage Example with Type Safety**:

The adapter supports full TypeScript type safety for mock verification:

```typescript
// test/service.test.ts - Type-safe testing with adapter
import {
  beforeEach,
  clearAllMocks,
  createMock,
  describe,
  expect,
  flushPromises,
  it,
  rejectedPromise,
  resolvedPromise,
  verifyMock,
} from './helpers/test-adapter';

// Define typed interfaces for your service
interface User {
  id: number;
  name: string;
  email: string;
}

interface DatabaseClient {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
}

class UserService {
  constructor(private db: DatabaseClient) {}

  async getUsers(): Promise<User[]> {
    return this.db.query<User>('SELECT * FROM users');
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const result = await this.db.query<User>(
      'INSERT INTO users (name, email) VALUES (?, ?) RETURNING *',
      [user.name, user.email],
    );
    return result[0];
  }
}

describe('User Service (Type-Safe)', () => {
  let service: UserService;
  let mockDb: DatabaseClient;

  beforeEach(() => {
    // Create typed mocks
    mockDb = {
      query: createMock(<T>(sql: string, params?: any[]) =>
        resolvedPromise([
          { id: 1, name: 'Alice', email: 'alice@example.com' } as T,
        ]),
      ),
      execute: createMock((sql: string, params?: any[]) =>
        resolvedPromise(undefined),
      ),
    };

    service = new UserService(mockDb);
  });

  it('should fetch users with type-safe verification', async () => {
    const users = await service.getUsers();

    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice');

    // Type-safe verification: TypeScript ensures we pass correct types
    const verify = verifyMock(mockDb.query);
    verify.toHaveBeenCalledWith('SELECT * FROM users');
    verify.toHaveBeenCalledTimes(1);
  });

  it('should create user with type-safe mock', async () => {
    const newUser = { name: 'Bob', email: 'bob@example.com' };

    // Mock returns a User object
    mockDb.query = createMock(() => resolvedPromise([{ id: 2, ...newUser }]));

    const result = await service.createUser(newUser);

    expect(result.id).toBe(2);
    expect(result.name).toBe('Bob');

    const verify = verifyMock(mockDb.query);
    verify.toHaveBeenCalledWith(
      'INSERT INTO users (name, email) VALUES (?, ?) RETURNING *',
      ['Bob', 'bob@example.com'],
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock error scenario with type-safe rejected promise
    mockDb.query = createMock(() =>
      rejectedPromise(new Error('Database connection failed')),
    );

    await expect(service.getUsers()).rejects.toThrow(
      'Database connection failed',
    );

    const verify = verifyMock(mockDb.query);
    verify.toHaveBeenCalled();
  });

  it('should handle async operations correctly', async () => {
    let promiseResolved = false;

    // Create an async mock
    mockDb.query = createMock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      promiseResolved = true;
      return [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
    });

    const usersPromise = service.getUsers();

    // Promise hasn't resolved yet
    expect(promiseResolved).toBe(false);

    // Wait for all promises
    await flushPromises();
    await usersPromise;

    // Now it's resolved
    expect(promiseResolved).toBe(true);
  });
});
```

**Key Takeaways:**

1. **Full type safety**: TypeScript ensures mock calls match actual function signatures
2. **Promise helpers**: `resolvedPromise()` and `rejectedPromise()` simplify async testing
3. **Type-safe verification**: `verifyMock()` provides autocomplete and type checking
4. **Works identically in Bun and Jest**: Same code, same behavior, zero modifications

#### 9.5 Adapter Pattern Summary

**Why the Adapter Pattern is Recommended:**

| Aspect               | Without Adapter                          | With Adapter                          |
| -------------------- | ---------------------------------------- | ------------------------------------- |
| **Code duplication** | Separate test files for Bun/Jest         | Single test file for both             |
| **Maintenance**      | Update tests in multiple places          | Update once, works everywhere         |
| **Type safety**      | Manual type casting needed               | Automatic type inference              |
| **Readability**      | Runtime checks in every test             | Clean, framework-agnostic tests       |
| **Onboarding**       | Developers need to learn both frameworks | Single unified API to learn           |
| **Refactoring**      | High risk of breaking one environment    | Low risk, adapter handles differences |

**Implementation Checklist:**

- [ ] Create `test/helpers/test-adapter.ts` with runtime detection
- [ ] Export core test APIs (`describe`, `it`, `expect`, etc.)
- [ ] Implement `createMock()` wrapper for `mock()` vs `jest.fn()`
- [ ] Implement `createSpyOn()` wrapper for spy functions
- [ ] Add mock lifecycle functions (`clearAllMocks`, `resetAllMocks`)
- [ ] Implement `verifyMock()` for type-safe assertions
- [ ] Add async helpers (`flushPromises`, `resolvedPromise`, `rejectedPromise`)
- [ ] Export runtime detection flags (`isRunningInBun`, `isRunningInJest`)
- [ ] Document usage with JSDoc comments and examples
- [ ] Update all test files to import from adapter instead of framework directly
- [ ] Test in both Bun and Jest environments
- [ ] Add adapter to CI/CD pipeline

**Expected Results:**

- ✅ **90%+ code reuse** between Bun and Jest test suites
- ✅ **Zero test modifications** when switching environments
- ✅ **Type-safe testing** with full TypeScript support
- ✅ **Easy maintenance** - update adapter once, all tests benefit
- ✅ **Developer productivity** - write tests once, run anywhere

**Pattern 3: TypeScript Configuration for Shared Tests**:

```json
// tsconfig.test.json - For Jest compatibility
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "verbatimModuleSyntax": false, // Disable for Jest compatibility
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 9.6 API Compatibility Summary

**Complete API Comparison Table**:

| Feature              | Bun Test                     | Jest                         | Notes                                 |
| -------------------- | ---------------------------- | ---------------------------- | ------------------------------------- |
| **Imports**          | `bun:test`                   | `@jest/globals`              | Conditional import required           |
| **Test Suites**      | `describe(name, fn)`         | `describe(name, fn)`         | ✅ Identical                          |
| **Test Cases**       | `test(name, fn)` / `it()`    | `test(name, fn)` / `it()`    | ✅ Identical                          |
| **Assertions**       | `expect(value)`              | `expect(value)`              | ✅ Identical                          |
| **beforeEach**       | `beforeEach(fn)`             | `beforeEach(fn)`             | ✅ Identical                          |
| **afterEach**        | `afterEach(fn)`              | `afterEach(fn)`              | ✅ Identical                          |
| **beforeAll**        | `beforeAll(fn)`              | `beforeAll(fn)`              | ✅ Identical                          |
| **afterAll**         | `afterAll(fn)`               | `afterAll(fn)`               | ✅ Identical                          |
| **Mock Creation**    | `mock(fn)`                   | `jest.fn(fn)`                | ⚠️ Different API (use adapter)        |
| **Spy Creation**     | `spyOn(obj, method)`         | `jest.spyOn(obj, method)`    | ⚠️ Different import path              |
| **Module Mocking**   | `mock.module(path, factory)` | `jest.mock(path, factory)`   | ⚠️ Different API (use adapter)        |
| **Clear Mocks**      | Auto-cleared                 | `jest.clearAllMocks()`       | Bun auto-clears between tests         |
| **Reset Mocks**      | Auto-reset                   | `jest.resetAllMocks()`       | Bun auto-resets between tests         |
| **Restore Mocks**    | N/A                          | `jest.restoreAllMocks()`     | Jest-specific                         |
| **Mock Timers**      | Limited support              | `jest.useFakeTimers()`       | Jest has more complete timer support  |
| **Snapshot Testing** | Limited support              | `expect().toMatchSnapshot()` | Jest has more robust snapshot support |

**Shared Compatible APIs (No Adapter Needed)**:

```typescript
// These work identically in both Bun and Jest
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
} from 'bun:test'; // or '@jest/globals'

describe('My Tests', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should work the same way', () => {
    expect(2 + 2).toBe(4);
    expect([1, 2, 3]).toHaveLength(3);
    expect({ name: 'Alice' }).toEqual({ name: 'Alice' });
    expect(() => {
      throw new Error('fail');
    }).toThrow('fail');
  });

  afterEach(() => {
    // Cleanup code
  });
});
```

**APIs Requiring Adapter**:

```typescript
// test/helpers/test-adapter.ts

// Mock function creation - DIFFERENT API
// Bun:  import { mock } from 'bun:test'; const fn = mock(() => {});
// Jest: import { jest } from '@jest/globals'; const fn = jest.fn(() => {});
export const createMock = /* adapter implementation */;

// Module mocking - DIFFERENT API
// Bun:  mock.module('./module', () => ({}));
// Jest: jest.mock('./module', () => ({}));
export const mockModule = /* adapter implementation */;

// Spy creation - SIMILAR but different import
// Bun:  import { spyOn } from 'bun:test'; spyOn(obj, 'method');
// Jest: import { jest } from '@jest/globals'; jest.spyOn(obj, 'method');
export const createSpyOn = /* adapter implementation */;
```

**Migration Checklist for Shared Tests**:

- [ ] Use conditional imports for test framework APIs (`bun:test` vs `@jest/globals`)
- [ ] Create test adapter helpers for mock/spy APIs
- [ ] Use unified test structure (`describe`, `it`, `expect`) - no changes needed
- [ ] Implement `createMock()` wrapper for both `mock()` and `jest.fn()`
- [ ] Implement `mockModule()` wrapper for both `mock.module()` and `jest.mock()`
- [ ] Add runtime detection: `typeof Bun !== 'undefined'`
- [ ] Use `tsconfig.test.json` with `verbatimModuleSyntax: false` for Jest
- [ ] Test in both environments (`bun test` and `jest`)
- [ ] Ensure CI/CD runs both Bun and Node.js test suites

#### 9.7 Package.json Test Scripts

**MANDATORY**: Must include environment-specific test scripts:

```json
{
  "scripts": {
    "test": "bun test",
    "test:bun": "bun test",
    "test:node": "jest",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

#### 9.8 CI/CD Testing Strategy

**GitHub Actions** must test both environments:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test-bun:
    name: Test (Bun)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test

  test-node:
    name: Test (Node.js)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

#### 9.9 General Testing Requirements

Regardless of runtime environment:

- ✅ Write tests for all database operations
- ✅ Use in-memory databases (`:memory:`) for unit tests
- ✅ Mock Drizzle ORM instances for integration tests
- ✅ Test runtime detection logic separately
- ✅ Verify cross-platform compatibility
- ✅ Maintain >80% code coverage
- ✅ Test error handling and edge cases
- ✅ **Share test logic between Bun and Jest whenever possible**
- ✅ **Use conditional imports to handle framework differences**
- ✅ **Extract common test utilities into shared functions**

#### 9.10 Best Practices for Shared Tests

**DO**:

- ✅ Use the same test file structure for both Bun and Jest
- ✅ Extract test logic into framework-agnostic functions
- ✅ Use conditional imports: `typeof Bun !== 'undefined' ? 'bun:test' : '@jest/globals'`
- ✅ Share test fixtures, schemas, and seed data
- ✅ Use `tsconfig.test.json` with `verbatimModuleSyntax: false` for Jest
- ✅ Keep test assertions simple and framework-compatible
- ✅ Use `describe`, `it`, and `expect` consistently (both support these)

**DON'T**:

- ❌ Hard-code `bun:test` imports in shared test files
- ❌ Hard-code `@jest/globals` imports in shared test files
- ❌ Use Bun-specific APIs (like `Bun.file()`) without runtime checks
- ❌ Use Jest-specific APIs (like `jest.fn()` vs `mock()`) without runtime checks
- ❌ Duplicate entire test files for different frameworks
- ❌ Skip testing in one environment because "it works in the other"

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
    "bundlesize": "^0.18.x",
    "jest": "^29.x.x",
    "ts-jest": "^29.x.x",
    "@types/jest": "^29.x.x"
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

### 13. Task Completion Requirements

**MANDATORY**: After completing ANY task (feature implementation, bug fix, refactoring, etc.), you MUST perform the following checks:

#### 13.1 TypeScript Type Checking

**Requirements**:

- ✅ **MUST** run TypeScript type checking after every task completion
- ✅ **MUST** fix all TypeScript type errors before considering the task complete
- ✅ **MUST** ensure zero type errors in the codebase
- ❌ **DO NOT** mark a task as complete if type errors exist

**Type Checking Commands**:

```bash
# Run TypeScript compiler in check mode
bun run typecheck
# Or directly use tsc
npx tsc --noEmit

# Check specific file or directory
npx tsc --noEmit src/specific-file.ts
```

**Package.json Script**:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch"
  }
}
```

#### 13.2 Type Error Resolution Workflow

When type errors are found:

**1. Identify the Error**:

```bash
bun run typecheck
# Output example:
# src/adapters/d1.ts(42,15): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

**2. Fix the Error**:

- Correct type annotations
- Update function signatures
- Add proper type guards
- Use TypeScript utility types (Partial, Pick, Omit, etc.)
- Avoid using `any` types (use `unknown` instead)

**3. Verify the Fix**:

```bash
# Re-run type checking
bun run typecheck

# Should output:
# No errors found
```

**4. Continuous Type Checking (Optional)**:

```bash
# Watch mode for real-time feedback during development
bun run typecheck:watch
```

#### 13.3 Common Type Errors and Solutions

**Error 1: Type 'X' is not assignable to type 'Y'**

```typescript
// ❌ INCORRECT
const id: number = '123';

// ✅ CORRECT
const id: number = 123;
// Or with conversion
const id: number = parseInt('123', 10);
```

**Error 2: Property 'X' does not exist on type 'Y'**

```typescript
// ❌ INCORRECT
interface User {
  name: string;
}
const user: User = { name: 'Alice', email: 'alice@example.com' };

// ✅ CORRECT
interface User {
  name: string;
  email: string;
}
const user: User = { name: 'Alice', email: 'alice@example.com' };
```

**Error 3: Argument of type 'X' is not assignable to parameter of type 'Y'**

```typescript
// ❌ INCORRECT
function greet(name: string) {
  console.log(`Hello, ${name}`);
}
greet(123);

// ✅ CORRECT
greet('Alice');
// Or update function signature
function greet(name: string | number) {
  console.log(`Hello, ${name}`);
}
```

**Error 4: Object is possibly 'undefined'**

```typescript
// ❌ INCORRECT
function getLength(arr: string[] | undefined) {
  return arr.length; // Error: arr is possibly undefined
}

// ✅ CORRECT - Option 1: Type guard
function getLength(arr: string[] | undefined) {
  if (arr === undefined) return 0;
  return arr.length;
}

// ✅ CORRECT - Option 2: Optional chaining
function getLength(arr: string[] | undefined) {
  return arr?.length ?? 0;
}

// ✅ CORRECT - Option 3: Non-null assertion (use with caution)
function getLength(arr: string[] | undefined) {
  return arr!.length; // Only if you're certain arr is not undefined
}
```

#### 13.4 Integration with Development Workflow

**Before Committing Code**:

```bash
# 1. Run type checking
bun run typecheck

# 2. If errors found, fix them
# (iterate until no errors)

# 3. Run tests
bun test

# 4. Run build
bun run build

# 5. Commit only when all checks pass
git add .
git commit -m "feat: implement new feature"
```

**Pre-commit Hook (Recommended)**:

Install husky and lint-staged:

```bash
bun add -D husky lint-staged
bunx husky install
```

**.husky/pre-commit**:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type checking before commit
bun run typecheck || (echo "❌ Type errors found. Please fix before committing." && exit 1)

# Run other checks
bun test
```

**package.json**:

```json
{
  "scripts": { "prepare": "husky install" },
  "lint-staged": {
    "*.ts": ["prettier --write", "eslint --fix", "tsc --noEmit"]
  }
}
```

#### 13.5 CI/CD Integration

Add type checking to your CI pipeline:

**.github/workflows/ci.yml**:

```yaml
name: CI

on: [push, pull_request]

jobs:
  typecheck:
    name: Type Checking
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
        name: Check TypeScript types

  test:
    name: Tests
    needs: typecheck # Only run tests if type checking passes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test

  build:
    name: Build
    needs: [typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
```

#### 13.6 Task Completion Checklist

Before marking any task as complete, verify:

- [ ] **Type checking passes**: `bun run typecheck` shows zero errors
- [ ] **All type errors fixed**: No `@ts-ignore` or `@ts-expect-error` comments added to bypass errors
- [ ] **No `any` types introduced**: Used proper type definitions instead
- [ ] **Tests pass**: `bun test` completes successfully
- [ ] **Build succeeds**: `bun run build` completes without errors
- [ ] **Code formatted**: `prettier --write .` applied
- [ ] **Linting passes**: No ESLint errors (if configured)
- [ ] **Documentation updated**: README, JSDoc comments, etc.
- [ ] **Changeset created**: For user-facing changes

**Automation Note**: Consider using a task management tool or checklist system to track these requirements for each task.

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
- [ ] **For Bun environment: Using `bun test` (NOT Jest, Vitest, or other Node.js test runners)** ✨ NEW
- [ ] **For Node.js environment: Using `jest` (NOT Bun test runner)** ✨ NEW
- [ ] **Shared test code: Using conditional imports for test framework APIs** ✨ NEW
- [ ] **Shared test code: Maximizing code reuse between Bun and Jest test environments** ✨ NEW
- [ ] **Package.json includes both `test:bun` and `test:node` scripts** ✨ NEW
- [ ] **CI/CD pipeline tests both Bun and Node.js environments** ✨ NEW
- [ ] **tsconfig.test.json configured with verbatimModuleSyntax: false for Jest** ✨ NEW
- [ ] Tests written and passing with >80% coverage
- [ ] Documentation updated
- [ ] **TypeScript type checking passes (`bun run typecheck`)** ✨ NEW
- [ ] **All TypeScript type errors fixed** ✨ NEW
- [ ] **No `any` types or type bypasses (`@ts-ignore`) introduced** ✨ NEW
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

- **v1.9.0** (2025-10-15): Comprehensive Bun test and Jest compatibility documentation
  - **MAJOR UPDATE**: Added detailed adapter layer pattern documentation
  - Updated Section 9.2: Expanded Bun Test API Compatibility table with Notes column
  - Added comprehensive "Basic Adapter Implementation" example with inline documentation
  - Added "Advanced Adapter Example" with full feature set:
    - Mock function creation (`createMock`)
    - Spy creation (`createSpyOn`)
    - Module mocking (`mockModule`)
    - Mock lifecycle management (`clearAllMocks`, `resetAllMocks`, `restoreAllMocks`)
    - Type-safe mock verification helpers (`verifyMock`, `MockVerification` interface)
    - Async testing helpers (`flushPromises`, `resolvedPromise`, `rejectedPromise`)
    - Runtime detection flags and utilities (`isRunningInBun`, `getTestFramework`)
  - Added comprehensive "Usage with Adapter" real-world example
  - Added "Advanced Usage Example with Type Safety" showing full TypeScript integration
  - **NEW Section 9.5**: Adapter Pattern Summary with:
    - Comparison table (With vs Without Adapter)
    - Implementation checklist (12 steps)
    - Expected results and benefits
  - Documented why adapter pattern is recommended for production codebases
  - Emphasized 90%+ code reuse between environments
  - Added JSDoc-style comments to all adapter functions with usage examples
  - Clarified timer and snapshot testing differences between frameworks
  - Updated all code examples to use comprehensive adapter pattern
- **v1.8.0** (2025-10-15): Enhanced testing requirements with code sharing emphasis
  - Updated Section 9: Testing Requirements
  - **NEW**: Added Core Principles section (9.1) emphasizing code sharing
  - **MANDATORY**: Maximize code sharing between Bun and Node.js test environments
  - **MANDATORY**: Use conditional imports for test framework APIs
  - Added Section 9.4: Shared Test Code Pattern (RECOMMENDED)
  - Documented 3 patterns for sharing test code:
    - Pattern 1: Conditional import for test APIs
    - Pattern 2: Separate import files (alternative)
    - Pattern 3: TypeScript configuration for shared tests
  - Added Section 9.8: Best Practices for Shared Tests
  - Required `tsconfig.test.json` with `verbatimModuleSyntax: false` for Jest
  - Updated Jest configuration to use separate `tsconfig.test.json`
  - Updated compliance checklist with code sharing requirements
  - Renumbered sections (9.2-9.8 instead of 9.1-9.5)
  - Emphasized framework-agnostic test logic
  - Added DO/DON'T lists for shared test best practices
- **v1.7.0** (2025-10-15): Added mandatory environment-specific testing requirements
  - Added Section 9: Testing Requirements with environment-specific mandates
  - **MANDATORY**: Bun environment MUST use `bun test` (native test runner)
  - **MANDATORY**: Node.js environment MUST use `jest` for compatibility
  - Prohibited use of Jest/Vitest in Bun environment
  - Prohibited use of Bun test runner in Node.js environment
  - Added Bun test file structure and example with `bun:test` API
  - Added Jest configuration with ts-jest preset for Node.js
  - Added Jest test file structure example with Node.js drivers
  - Required package.json scripts: `test:bun` and `test:node`
  - Documented CI/CD testing strategy for both environments (GitHub Actions)
  - Added general testing requirements: >80% coverage, in-memory databases, etc.
  - Updated compliance checklist with testing framework requirements
  - Clarified that testing framework choice depends on runtime environment
- **v1.6.0** (2025-10-15): Added mandatory TypeScript type checking requirements
  - Added Section 13: Task Completion Requirements
  - Mandated TypeScript type checking after every task completion
  - Required zero type errors before marking tasks as complete
  - Provided type error resolution workflow
  - Added common type errors and solutions with examples
  - Documented integration with development workflow (pre-commit hooks)
  - Included CI/CD integration examples for automated type checking
  - Added comprehensive task completion checklist
  - Updated compliance checklist with new type checking requirements
  - Prohibited use of `@ts-ignore` or `@ts-expect-error` to bypass errors
  - Required proper type definitions instead of `any` types
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
