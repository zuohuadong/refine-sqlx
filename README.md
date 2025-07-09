# Refine SQL X

`refine-sqlx` is a refine data provider that provides a standard SQL query interface allowing you to customize query clients for any database. It has built-in support for SQLite databases, you can directly pass `bun:sqlite`/`node:sqlite`/`cloudflare d1`/`better-sqlite3` instances to `refine-sqlx`; you can also directly pass a `:memory:` string to use memory or pass a local file path, and it will automatically select the best SQLite driver for your runtime.

## Installation

Install `refine-sqlx` using this command:

```bash
# Bun
bun add refine-sqlx

# NPM
npm install refine-sqlx

# pnpm
pnpm add refine-sqlx

# yarn
yarn add refine-sqlx

# Deno
deno install -A https://github.com/zuohuadong/refine-sqlx/mod.ts # TODO
```

## Basic Usage

```typescript
import { Refine } from "@refinedev/core";
import { createRefineSQLite } from "refine-sqlx";

const sqlite = createRefineSQLite(":memory:");
const App = () => {
  <Refine dataProvider={sqlite} />
};
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
