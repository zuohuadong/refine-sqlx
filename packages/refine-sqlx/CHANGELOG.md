# Changelog

## 0.3.2

### Patch Changes

- Continue using TypeScript new decorators and add publishConfig for npm publishing

- Updated dependencies []:
  - refine-core-utils@0.3.2

## 0.3.1

### Patch Changes

- 9308ad4: Initial monorepo setup with Bun workspace structure and Changeset version management
- Release version 0.3.1
  - Updated README documentation
  - Removed @refine-sqlx/core-utils package description from README
  - Minor documentation improvements and formatting fixes

- Updated dependencies
  - @refine-sqlx/core-utils@0.3.1

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2025-01-12

### Added

- Initial release of refine-sqlx package
- Multi-database support for PostgreSQL, MySQL, and SQLite using drizzle-orm
- Runtime detection for optimal database drivers (Bun vs Node.js)
- Type-safe CRUD operations with automatic schema inference
- Chain query builder for fluent API
- Polymorphic relationship support (morph queries)
- Native query builders for advanced SQL operations
- Transaction management with rollback support
- Connection pooling and performance optimization
- Comprehensive error handling with detailed error types
- Factory functions for easy database provider creation:
  - `createPostgreSQLProvider()` - Auto-detects bun:sql vs postgres driver
  - `createMySQLProvider()` - Uses mysql2 driver (bun:sql MySQL support pending)
  - `createSQLiteProvider()` - Auto-detects bun:sqlite vs better-sqlite3
- Full TypeScript support with type inference from drizzle schemas
- ESM/CJS dual module support
- Comprehensive test suite with unit and integration tests
- Performance monitoring and optimization features
- Shared utilities with @refine-sqlx/core-utils for code reuse

### Features

- **Database Support**: PostgreSQL, MySQL, SQLite with runtime-optimized drivers
- **Type Safety**: Full TypeScript support with schema-based type inference
- **Query Builder**: Fluent chain query API and native SQL builders
- **Relationships**: Support for polymorphic and standard relationships
- **Transactions**: Robust transaction management with error handling
- **Performance**: Connection pooling, query optimization, and caching
- **Developer Experience**: Zero-config setup with intelligent runtime detection

### Technical Details

- Built with drizzle-orm for type-safe database operations
- Automatic runtime detection (Bun vs Node.js) for optimal performance
- Comprehensive error handling with specific error types
- Modular architecture with pluggable database adapters
- Shared transformation layer to reduce code duplication
- Full test coverage with mock and integration tests

[Unreleased]: https://github.com/medz/refine-sql/compare/refine-sqlx@0.0.1...HEAD
[0.0.1]: https://github.com/medz/refine-sql/releases/tag/refine-sqlx@0.0.1
