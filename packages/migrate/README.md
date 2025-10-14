# @@refine-sqlx/sqlx/migrate

Migration tools for @refine-sqlx/sqlx packages.

## Overview

This package provides tools to help you migrate between different versions of @refine-sqlx/sqlx packages, including:

- `@@refine-sqlx/sqlx/sql` - SQLite data provider
- `@@refine-sqlx/sqlx/orm` - Multi-database ORM provider (using Drizzle ORM)
- `@@refine-sqlx/sqlx/core` - Core utilities shared across packages

## Installation

```bash
npm install @@refine-sqlx/sqlx/migrate
# or
yarn add @@refine-sqlx/sqlx/migrate
# or
pnpm add @@refine-sqlx/sqlx/migrate
# or
bun add @@refine-sqlx/sqlx/migrate
```

## Usage

### CLI

```bash
npx @@refine-sqlx/sqlx/migrate
```

### Programmatic API

```typescript
import { migrate } from '@@refine-sqlx/sqlx/migrate';

// Run migration
await migrate({
  from: '@refine-sqlx/sql',
  to: '@@refine-sqlx/sqlx/sql',
  path: './src'
});
```

## Migration Guides

### From @refine-sqlx/sql to @@refine-sqlx/sqlx/sql

Update your imports:

```diff
- import { createDataProvider } from '@@refine-sqlx/sqlx/sql';
+ import { createDataProvider } from '@@refine-sqlx/sqlx/sql';
```

### From @refine-sqlx/sqlx (old) to @@refine-sqlx/sqlx/orm

Update your imports:

```diff
- import { createDataProvider } from '@refine-sqlx/sqlx';
+ import { createDataProvider } from '@@refine-sqlx/sqlx/orm';
```

### From @refine-sqlx/core to @@refine-sqlx/sqlx/core

Update your imports:

```diff
- import { utils } from '@@refine-sqlx/sqlx/core';
+ import { utils } from '@@refine-sqlx/sqlx/core';
```

## Features

- Automatic code transformation
- Import statement updates
- Package.json dependency updates
- Comprehensive migration reports
- Rollback support

## Contributing

Contributions are welcome! Please read our [contributing guide](../../CONTRIBUTING.md) for details.

## License

MIT
