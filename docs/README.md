# Documentation

This directory contains all project documentation for refine-sqlx.

## Directory Structure

```
docs/
├── specs/              # Technical specifications and standards
│   └── CLAUDE_SPEC.md      # Claude Code project specifications
├── features/           # Feature documentation and release notes
│   └── FEATURES_v0.4.0.md  # v0.4.0 feature documentation
├── analysis/           # Technical analysis and research
│   └── D1_BUNDLE_SIZE_ANALYSIS.md  # D1 bundle size analysis
└── README.md          # This file
```

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
