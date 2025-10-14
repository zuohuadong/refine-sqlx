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

- Initial release of refine-d1 package as part of monorepo structure
- Enhanced SQLite-focused data provider for Refine applications
- Runtime detection for optimal SQLite drivers (bun:sqlite vs better-sqlite3)
- Chain query builder for fluent SQL operations
- Polymorphic relationship support (morph queries)
- Type-safe methods with schema validation
- ORM compatibility features for gradual migration to refine-sqlx
- Shared utilities with @refine-sqlx/core-utils for consistency
- Support for multiple SQLite runtimes:
  - Bun with bun:sqlite (native)
  - Node.js with better-sqlite3
  - Cloudflare D1 (Workers environment)
- ESM/CJS dual module support with proper exports
- Comprehensive test suite with runtime-specific tests

### Enhanced

- **Chain Query API**: Fluent interface for building complex queries
- **Morph Queries**: Lightweight polymorphic relationship support
- **Typed Methods**: Type-safe CRUD operations with validation
- **Runtime Optimization**: Automatic detection and optimal driver selection
- **Error Handling**: Improved error messages and debugging support
- **Performance**: Optimized query building and execution

### Features

- **Multi-Runtime Support**: Works seamlessly across Bun, Node.js, and Cloudflare
- **Type Safety**: TypeScript support with runtime validation
- **Lightweight**: Minimal dependencies, focused on SQLite
- **Extensible**: Plugin architecture for custom functionality
- **Developer Experience**: Simple API with powerful features

### Technical Details

- Built on native SQL with runtime-specific optimizations
- Automatic driver detection and fallback mechanisms
- Shared transformation layer with refine-sqlx for consistency
- Modular exports for tree-shaking and optimal bundle size
- Comprehensive test coverage across all supported runtimes

### Migration Path

- Provides compatibility layer for migration to refine-sqlx
- Shared utilities ensure consistent behavior between packages
- Gradual migration support with feature parity

[Unreleased]: https://github.com/zuohuadong/refine-d1/compare/refine-d1@0.0.1...HEAD
[0.0.1]: https://github.com/zuohuadong/refine-d1/releases/tag/refine-d1@0.0.1
