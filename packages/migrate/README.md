# @@refine-sqlx/orm/migrate

Migration tools for @refine-sqlx/orm packages.

## Overview

This package provides tools to help you migrate between different versions of @refine-sqlx/orm packages, including:

- `@refine-sqlx/sql` - SQLite data provider
- `@refine-sqlx/ormlti-database ORM provider (using Drizzle ORM)
- `@@refine-sqlx/orm/core` - Core utilities shared across packages

## Installation

```bash
npm install @@refine-sqlx/orm/migrate
# or
yarn add @@refine-sqlx/orm/migrate
# or
pnpm add @@refine-sqlx/orm/migrate
# or
bun add @@refine-sqlx/orm/migrate
```

## Usage

### CLI

```bash
npx @@refine-sqlx/orm/migrate
```

### Programmatic API

```typescript
import { migrate } from '@@refine-sqlx/orm/migrate';

// Run migration
await migrate({
  from: '@refine-sqlx/sql',
  to: '@refine-sqlx/sql',
  path: './src'
});
```

## Migration Guides

### From @refine-sqlx/sql to @refine-sqlx/sql

Update your imports:

```diff
- import { createDataProvider } from '@refine-sqlx/sql';
+ import { createDataProvider } from '@refine-sqlx/sql';
```

### From @refine-sqlx/orm (old) to @@refine-sqlx/orm

Update your imports:

```diff
- import { createDataProvider } from '@refine-sqlx/orm';
+ import { createDataProvider } from '@refine-sqlx/orm';
```

### From @refine-sqlx/core to @@refine-sqlx/orm/core

Update your imports:

```diff
- import { utils } from '@@refine-sqlx/orm/core';
+ import { utils } from '@@refine-sqlx/orm/core';
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
