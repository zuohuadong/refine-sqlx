# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun test` or `vitest` - Run tests using Vitest
- `bun run build` or `unbuild` - Build the library using unbuild
- `prettier --write .` - Format code (Prettier with import sorting plugin)

## Architecture Overview

This is a TypeScript library that provides a Refine data provider for SQL databases with cross-platform SQLite support. The architecture consists of:

### Core Components

- `src/data-provider.ts` - Main export that implements Refine's DataProvider interface with CRUD operations (getList, getMany, getOne, create, createMany, update, updateMany, deleteOne, deleteMany)
- `src/client.d.ts` - Defines the SqlClient interface that abstracts database operations (query, execute, transaction, batch)
- `src/detect-sqlite.ts` - Runtime detection and client factory creation for different SQLite implementations

### Database Adapters

The library supports multiple SQLite runtimes through dedicated adapters:

- `src/bun-sqlite.ts` - Bun's native SQLite (`bun:sqlite`)
- `src/node-sqlite.ts` - Node.js native SQLite (`node:sqlite`)
- `src/cloudflare-d1.ts` - Cloudflare D1 database
- `src/better-sqlite3.ts` - better-sqlite3 package (fallback)

### Utilities

- `src/utils.ts` - SQL query builders and result processing utilities for CRUD operations, filtering, sorting, and pagination

### Design Patterns

- **Factory Pattern**: `SqlClientFactory` interface for lazy database connection initialization
- **Adapter Pattern**: Multiple database implementations behind a unified `SqlClient` interface
- **Runtime Detection**: Automatic selection of best SQLite driver based on environment
- **Overloaded Functions**: Multiple function signatures for flexible database instance passing

### Key Features

- Automatic runtime detection (Cloudflare Worker, Bun, Node.js >=24, fallback to better-sqlite3)
- Support for both memory (`:memory:`) and file-based databases
- Transaction and batch operation support where available
- Lazy connection initialization through factory pattern
- Type-safe integration with Refine's DataProvider interface

The library exports `createRefineSQL` function that accepts various input types (database instances, file paths, or `:memory:`) and returns a configured Refine DataProvider.
