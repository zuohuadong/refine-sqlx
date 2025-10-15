# Documentation

This directory contains all project documentation for refine-sqlx.

## Directory Structure

```
docs/
├── specs/              # Technical specifications and standards
│   └── CLAUDE_SPEC.md      # Claude Code project specifications
├── features/           # Feature documentation and release notes
│   ├── FEATURES_v0.3.0.md  # v0.3.0 feature documentation
│   └── FEATURES_v0.4.0.md  # v0.4.0 feature documentation
├── analysis/           # Technical analysis and research
│   └── D1_BUNDLE_SIZE_ANALYSIS.md  # D1 bundle size analysis
├── examples/           # Interactive examples and templates
│   ├── d1-rest-api/        # Complete REST API template
│   ├── d1-hono/            # Hono framework integration
│   ├── d1-graphql/         # GraphQL API template
│   └── d1-websocket/       # WebSocket real-time template
├── D1_FEATURES.md      # D1-specific features guide
└── README.md          # This file
```

## Quick Start

### Interactive Examples

Jump right in with ready-to-deploy templates:

- **[Examples Overview](./examples/README.md)** - All interactive examples and templates
- **[D1 REST API](./examples/d1-rest-api/)** - Complete REST API with CRUD operations
- **[D1 + Hono](./examples/d1-hono/)** - High-performance API with Hono framework
- **[D1 + GraphQL](./examples/d1-graphql/)** - Type-safe GraphQL API
- **[D1 + WebSocket](./examples/d1-websocket/)** - Real-time updates with WebSocket

### Try Online

Click to open examples in your browser:

| Template       | Description                             | Deploy                                                                                                                                                                    |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 REST API    | Complete CRUD with filters & pagination | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-rest-api)  |
| D1 + Hono      | Lightweight, fast API framework         | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-hono)      |
| D1 + GraphQL   | Type-safe GraphQL with subscriptions    | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-graphql)   |
| D1 + WebSocket | Real-time data with Durable Objects     | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-websocket) |

## Documents

### Specifications

**[CLAUDE_SPEC.md](./specs/CLAUDE_SPEC.md)** - Claude Code Project Specifications

- Technical standards for the project
- TypeScript 5.0+ decorator requirements
- Database driver requirements (Bun, Node.js, Cloudflare D1)
- Build optimization for D1 environment
- Code organization and best practices
- Compliance checklist

**Target Audience**: Developers, Claude Code AI assistant

### Features

**[FEATURES_v0.3.0.md](./features/FEATURES_v0.3.0.md)** - v0.3.0 Feature Documentation

- Drizzle ORM integration and migration
- Type-safe query builder
- D1 environment optimized build (16KB gzipped)
- Cross-platform improvements
- Migration guide from v0.2.x

**[FEATURES_v0.4.0.md](./features/FEATURES_v0.4.0.md)** - v0.4.0 Feature Documentation

- Eloquent-style chainable query API
- Automatic relationship management
- Polymorphic relations
- Dynamic relations
- Installation and usage guide
- Migration guide from Drizzle ORM

**Target Audience**: End users, npm package consumers, developers

### Analysis

**[D1_BUNDLE_SIZE_ANALYSIS.md](./analysis/D1_BUNDLE_SIZE_ANALYSIS.md)** - D1 Bundle Size Analysis

- Bundle size breakdown and estimates
- Optimization strategies
- Build configuration examples
- Performance benchmarks
- Size monitoring setup

**Target Audience**: Performance engineers, maintainers

**[D1_FEATURES.md](./D1_FEATURES.md)** - D1 Batch Operations and Time Travel Guide

- Batch operations (insert, update, delete)
- D1-specific optimizations
- Time Travel configuration
- Performance tuning
- Best practices

**Target Audience**: D1 users, Cloudflare Workers developers

### Examples & Templates

**[examples/](./examples/)** - Interactive Examples and Templates

Complete, production-ready templates for common scenarios:

1. **REST API** - Full CRUD operations with filtering, sorting, and pagination
2. **Hono Integration** - High-performance API with Hono framework
3. **GraphQL** - Type-safe GraphQL API with subscriptions
4. **WebSocket** - Real-time updates with Durable Objects

Each template includes:

- Complete source code
- Configuration files
- Database migrations
- Tests
- Deployment guide
- Best practices

**Target Audience**: Developers starting new projects, learning examples

## Quick Links

- [Project README](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Changelog](../CHANGELOG.md)
- [License](../LICENSE)

## Documentation Standards

When adding new documentation:

1. **Specifications** (`docs/specs/`):
   - Technical standards and requirements
   - Architecture decisions
   - Code style guides
   - Configuration specifications

2. **Features** (`docs/features/`):
   - Feature announcements
   - Release notes
   - User-facing documentation
   - API usage guides

3. **Analysis** (`docs/analysis/`):
   - Performance analysis
   - Technical investigations
   - Benchmark reports
   - Research documents

4. **Naming Convention**:
   - Use descriptive names: `FEATURE_NAME.md`
   - Include version for releases: `FEATURES_v0.4.0.md`
   - Use UPPERCASE for important docs: `CLAUDE_SPEC.md`
   - Use snake_case for analysis: `bundle_size_analysis.md`

## Maintenance

- Review documentation quarterly for accuracy
- Update specifications when technical decisions change
- Archive outdated documents to `docs/archive/`
- Keep README.md index up to date

---

**Last Updated**: 2025-10-14
**Maintainer**: Refine SQLx Team
