# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
