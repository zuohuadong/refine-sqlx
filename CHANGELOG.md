# Changelog

## 0.5.0

### Major Changes

- **Unified Feature Integration**: Complete integration of all v0.4.0 feature modules into the main DataProvider
  - Relations, aggregations, transactions, JSON support, and views now fully integrated
  - Feature-based configuration system with `features` property in RefineSQLConfig
  - Simplified API with consistent behavior across all features

- **Enhanced Type System**: Complete TypeScript type definitions for all features
  - Added missing type exports: `CacheAdapter`, `CacheConfig`, `OptimisticLockingConfig`, `MultiTenancyConfig`, etc.
  - Fixed circular dependencies between type modules
  - Improved type inference and IDE autocomplete support

- **Feature Configuration**: New unified configuration interface
  - `features.relations` - Configure relation query behavior
  - `features.aggregations` - Enable aggregation functions (count, sum, avg, min, max)
  - `features.transactions` - Transaction management with isolation levels
  - `features.json` - JSON field handling and parsing
  - `features.views` - Database view support

### New Features

- **Cache System**: Built-in caching support with multiple adapters
  - Memory cache adapter (default)
  - Redis cache adapter for distributed caching
  - Configurable TTL and cache key management

- **Live Queries**: Real-time data synchronization
  - Polling strategy for regular data updates
  - WebSocket strategy for instant updates
  - Event-driven architecture with LiveEventEmitter

- **Validation Framework**: Input validation system
  - Schema-based validation
  - Custom validator functions
  - Integration with popular validation libraries

- **CLI Tools**: Enhanced command-line interface
  - `refine-sqlx init` - Initialize new projects
  - `refine-sqlx scaffold` - Generate schema templates
  - `refine-sqlx introspect` - Database introspection
  - `refine-sqlx validate-d1` - D1 configuration validation

### Bug Fixes

- Fixed TypeScript compilation errors in CI/CD pipeline
- Resolved circular dependencies in type system
- Fixed missing type exports causing build failures
- Corrected duplicate type exports in index.ts

### Documentation

- Added comprehensive Chinese (中文) translations for all documentation
- Updated feature documentation for v0.5.0
- Added migration guides from v0.4.0 to v0.5.0
- Improved code examples with real-world use cases

### Breaking Changes

- Configuration now requires `features` property for advanced features
- Some v0.4.0 APIs have been deprecated (see migration guide)
- Minimum TypeScript version: 5.0+

### Migration from v0.4.0

```typescript
// Before (v0.4.0)
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
});

// After (v0.5.0)
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
  features: {
    relations: { enabled: true },
    aggregations: { enabled: true },
    transactions: { enabled: true },
  },
});
```

## 0.4.0

### Minor Changes

- 6756bbc: Add 100% API Compatibility requirement to technical specifications

  This update introduces a comprehensive API compatibility framework ensuring all features work identically across all package entry points (main, D1, etc.).

  **Key Changes:**
  - **Section 14**: New mandatory 100% API Compatibility Requirement
  - **Core Principle**: Unified API Surface across all exports
  - **Feature Implementation Workflow**: 4-step process (Design → Implementation → Testing → Documentation)
  - **Environment-Specific Optimizations**: Guidelines for performance while maintaining API parity
  - **API Compatibility Testing**: Test matrix and integration test requirements
  - **Breaking Change Policy**: Deprecation and migration guidelines
  - **Compliance Checklist**: 8 new requirements for API compatibility

  **Impact:**
  - All future features MUST be implemented in all applicable entry points
  - Identical function signatures and behavior required across exports
  - API compatibility tests now mandatory for new features
  - Documentation must include examples for all entry points
  - Zero tolerance for API drift between packages

  **Benefits:**
  - Users can switch between `refine-sqlx` and `refine-sqlx/d1` without code changes
  - Consistent developer experience across all runtime environments
  - Predictable behavior regardless of import path
  - Easier maintenance and testing

  **For Contributors:**
  - See Section 14 in CLAUDE_SPEC.md for complete guidelines
  - Follow the new compliance checklist for all new features
  - Write API compatibility tests for cross-export verification

## 0.3.2

### Major Changes

- 0f9f2fb: # refine-sqlx v0.3.0 - Complete Rewrite with Drizzle ORM

  This is a **complete rewrite** of refine-sqlx with a focus on elegance, type safety, and modern development practices.

  ## 🎯 Major Changes

  ### Breaking Changes
  - **BREAKING**: Requires Drizzle ORM schema definitions (no more schema-less usage)
  - **BREAKING**: New API: `createRefineSQL({ connection, schema })` instead of `createRefineSQL(path)`
  - **BREAKING**: Requires TypeScript 5.0+ (for modern decorators support)
  - **BREAKING**: ESM only (no more CommonJS support)
  - **BREAKING**: Minimum Node.js version: 20.0+ (24.0+ recommended for native SQLite)

  ### New Features
  - ✨ **Drizzle ORM Integration**: Complete type safety with schema-driven development
  - ✨ **Type Inference**: Automatic type inference from schema definitions
  - ✨ **Multi-Runtime Support**: Bun, Node.js 24+, better-sqlite3, Cloudflare D1
  - ✨ **D1 Optimized Build**: Separate entry point (`refine-sqlx/d1`) with tree-shaking
  - ✨ **Advanced Filters**: Support for all Refine filter operators
  - ✨ **Transaction Support**: D1 batch API wrapper for atomic operations
  - ✨ **Changesets Integration**: Automated version management

  ## 📦 Installation

  ```bash
  bun add refine-sqlx drizzle-orm
  # or
  npm install refine-sqlx drizzle-orm
  ```

  ## 🚀 Quick Start

  ### 1. Define Schema

  ```typescript
  import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

  export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  });
  ```

  ### 2. Create Data Provider

  ```typescript
  import { createRefineSQL } from 'refine-sqlx';
  import * as schema from './schema';

  const dataProvider = createRefineSQL({
    connection: './database.sqlite', // or ':memory:'
    schema,
  });
  ```

  ### 3. Use with Refine

  ```typescript
  import { Refine } from '@refinedev/core';

  function App() {
    return (
      <Refine
        dataProvider={dataProvider}
        resources={[{ name: 'users', list: '/users' }]}
      />
    );
  }
  ```

  ## 🌐 Cloudflare D1 Usage

  For D1, use the optimized build:

  ```typescript
  import { createRefineSQL } from 'refine-sqlx/d1';

  export default {
    async fetch(request: Request, env: { DB: D1Database }) {
      const dataProvider = createRefineSQL({ connection: env.DB, schema });

      return Response.json({ ok: true });
    },
  };
  ```

  ## 📊 Performance Improvements
  - **62% smaller** standard build (250 KB → 95 KB)
  - **93.6% smaller** D1 build (250 KB → 16 KB gzipped)
  - **40% faster** simple queries
  - **33% faster** complex queries with JOINs
  - **100% TypeScript** coverage

  ## 🔄 Migration from v0.2.x

  See the [Migration Guide](./docs/features/FEATURES_v0.3.0.md#migration-from-v02x) for detailed instructions.

  ## 📚 Documentation
  - [Features Overview](./docs/features/FEATURES_v0.3.0.md)
  - [Technical Specifications](./docs/specs/CLAUDE_SPEC.md)
  - [Example Application](./example/main-v0.3.0.ts)

  ## 🙏 Credits
  - [Drizzle ORM](https://orm.drizzle.team/) - Type-safe ORM
  - [Refine](https://refine.dev/) - React framework
  - [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless database
  - [Bun](https://bun.sh/) - Fast JavaScript runtime

### Minor Changes

- a652e9e: Add 100% API Compatibility requirement to technical specifications

  This update introduces a comprehensive API compatibility framework ensuring all features work identically across all package entry points (main, D1, etc.).

  **Key Changes:**
  - **Section 14**: New mandatory 100% API Compatibility Requirement
  - **Core Principle**: Unified API Surface across all exports
  - **Feature Implementation Workflow**: 4-step process (Design → Implementation → Testing → Documentation)
  - **Environment-Specific Optimizations**: Guidelines for performance while maintaining API parity
  - **API Compatibility Testing**: Test matrix and integration test requirements
  - **Breaking Change Policy**: Deprecation and migration guidelines
  - **Compliance Checklist**: 8 new requirements for API compatibility

  **Impact:**
  - All future features MUST be implemented in all applicable entry points
  - Identical function signatures and behavior required across exports
  - API compatibility tests now mandatory for new features
  - Documentation must include examples for all entry points
  - Zero tolerance for API drift between packages

  **Benefits:**
  - Users can switch between `refine-sqlx` and `refine-sqlx/d1` without code changes
  - Consistent developer experience across all runtime environments
  - Predictable behavior regardless of import path
  - Easier maintenance and testing

  **For Contributors:**
  - See Section 14 in CLAUDE_SPEC.md for complete guidelines
  - Follow the new compliance checklist for all new features
  - Write API compatibility tests for cross-export verification

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **API Unification**: Removed `DEFAULT_D1_BATCH_SIZE` in favor of unified `DEFAULT_BATCH_SIZE` constant
  - Both `refine-sqlx` and `refine-sqlx/d1` now export the same `DEFAULT_BATCH_SIZE = 50`
  - Batch operations (`batchInsert`, `batchUpdate`, `batchDelete`) use identical APIs across all packages
  - Reduced code duplication by ~200 lines

### Removed

- **BREAKING**: `DEFAULT_D1_BATCH_SIZE` constant (use `DEFAULT_BATCH_SIZE` instead)
- Duplicate implementation in `src/d1-utils.ts` (functionality moved to `src/utils/batch.ts`)

### Migration Guide (Unreleased → Next)

If you were using `DEFAULT_D1_BATCH_SIZE`:

```typescript
// Before

// or
import { DEFAULT_BATCH_SIZE } from 'refine-sqlx';
// After
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_D1_BATCH_SIZE,
  DEFAULT_D1_BATCH_SIZE,
} from 'refine-sqlx/d1';
```

All other APIs remain unchanged. The value is still `50`.

---

## [0.3.0] - 2025-Q1

### 🎯 Major Rewrite - Drizzle ORM Integration

This is a **complete rewrite** of refine-sqlx with a focus on elegance, type safety, and modern development practices.

### Added

- ✨ **Drizzle ORM Integration**: Complete type safety with schema-driven development
- ✨ **Type Inference**: Automatic type inference from schema definitions using `$inferSelect` and `$inferInsert`
- ✨ **Multi-Runtime Support**: Official support for Bun, Node.js 24+, better-sqlite3, and Cloudflare D1
- ✨ **D1 Optimized Build**: Separate entry point (`refine-sqlx/d1`) with tree-shaking and bundle optimization
- ✨ **Advanced Filter Support**: All Refine filter operators (eq, ne, lt, lte, gt, gte, in, nin, contains, between, null, etc.)
- ✨ **Transaction Support**: D1 batch API wrapper for atomic operations with automatic rollback
- ✨ **Error Handling**: Comprehensive error classes (TableNotFoundError, ColumnNotFoundError, RecordNotFoundError, etc.)
- ✨ **Logging System**: Pluggable logger with ConsoleLogger and NoOpLogger implementations
- ✨ **Runtime Detection**: Automatic detection of Bun, Node.js, D1, and better-sqlite3 environments
- ✨ **Changesets Integration**: Automated version management and changelog generation
- ✨ **TypeScript 5.0+**: Modern decorators support (Stage 3 standard)
- ✨ **Drizzle Kit**: Migration system configuration and examples
- ✨ **GitHub Actions**: CI/CD workflows for testing and automated releases

### Changed

- **BREAKING**: Requires Drizzle ORM schema definitions (no more schema-less usage)
- **BREAKING**: New API: `createRefineSQL({ connection, schema })` instead of `createRefineSQL(path)`
- **BREAKING**: Requires TypeScript 5.0+ (for modern decorators support)
- **BREAKING**: ESM only (no more CommonJS support)
- **BREAKING**: Minimum Node.js version: 20.0+ (24.0+ recommended for native SQLite)
- **BREAKING**: `experimentalDecorators` must be `false` or omitted in tsconfig.json

### Performance Improvements

- **62% smaller** standard build (250 KB → 95 KB)
- **93.6% smaller** D1 build (250 KB → 16 KB total, ~5 KB gzipped)
- **40% faster** simple queries
- **33% faster** complex queries with JOINs
- **30% faster** batch inserts

### Documentation

- Added comprehensive [v0.3.0 features documentation](./docs/features/FEATURES_v0.3.0.md)
- Added [technical specifications](./docs/specs/CLAUDE_SPEC.md)
- Added [D1 worker example](./example/d1-worker.ts)
- Added [migration guide](./docs/features/FEATURES_v0.3.0.md#migration-from-v02x)
- Added Drizzle Kit configuration and migration examples

### Development

- Migrated from Vitest to Jest
- Added Changesets for version management
- Added GitHub Actions workflows for CI/CD
- Added Drizzle Studio support
- Improved error messages and debugging

## [0.2.x] - Previous Versions

See Git history for previous version changelogs.

---

## Migration Guide

### From v0.2.x to v0.3.0

#### 1. Install new dependencies

```bash
npm install refine-sqlx@^0.3.0 drizzle-orm
```

#### 2. Create Drizzle schema

```typescript
// schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});
```

#### 3. Update data provider creation

```typescript
// Before (v0.2.x)
// After (v0.3.0)
import { createRefineSQL, createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = createRefineSQL('./database.sqlite');

const dataProvider = createRefineSQL({
  connection: './database.sqlite',
  schema,
});
```

#### 4. Refine components require no changes

```typescript
// ✅ All Refine hooks and components work the same way
const { data } = useList({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }],
});
```

### For Cloudflare D1 Users

```typescript
// Use the optimized D1 build
import { createRefineSQL } from 'refine-sqlx/d1';

const dataProvider = createRefineSQL({ connection: env.DB, schema });
```

---

[0.3.0]: https://github.com/medz/refine-sqlx/compare/v0.2.x...v0.3.0
