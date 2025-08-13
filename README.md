# Refine SQL Monorepo

[English](#english) | [中文](#中文)

## English

A collection of powerful, type-safe data providers for [Refine](https://refine.dev) with comprehensive database support.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Packages

### 🚀 [refine-orm](./packages/refine-orm)

A powerful, type-safe data provider with multi-database support using Drizzle ORM.

- **Multi-database**: PostgreSQL, MySQL, SQLite
- **Type-safe**: Full TypeScript support with schema inference
- **Advanced features**: Polymorphic relationships, chain queries, transactions
- **Runtime detection**: Automatic driver selection (Bun, Node.js, Cloudflare)

```bash
npm install refine-orm drizzle-orm
```

### ⚡ [refine-sql](./packages/refine-sql)

A lightweight, cross-platform SQL data provider with native runtime support.

- **Cross-platform**: Bun, Node.js, Cloudflare Workers
- **Native performance**: Runtime-specific SQL drivers
- **Simple**: Easy to use with raw SQL
- **Lightweight**: Minimal dependencies

```bash
npm install refine-sql
```

### 🔧 [@refine-orm/core-utils](./packages/refine-core-utils)

Shared utilities and transformers for Refine data providers.

- **Parameter transformation**: Convert Refine filters/sorting to SQL/ORM queries
- **Type-safe**: Generic TypeScript support
- **Extensible**: Configurable operators and transformers
- **Performance**: Optimized for high-throughput applications

```bash
npm install @refine-orm/core-utils
```

## Quick Start

### Choose Your Package

#### For Advanced ORM Features (Recommended)

Use **refine-orm** if you need:

- Type-safe schema definitions
- Complex relationships and joins
- Polymorphic associations
- Advanced query building
- Multi-database support

``typescript
import { createPostgreSQLProvider } from 'refine-orm';
import { schema } from './schema';

const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:pass@localhost/db',
  schema
);
```

#### For Simple SQL Operations

Use **refine-sql** if you need:

- Lightweight SQLite-only solution
- Raw SQL control
- Cross-platform compatibility
- Minimal setup

``typescript
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./database.db');
```

#### 🔄 ORM Compatibility - Near 100% API Compatibility!

**refine-sql** now provides **near 100% API compatibility** with refine-orm, allowing users to seamlessly migrate or use both API styles simultaneously:

``typescript
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./database.db');

// 🎯 Both API styles are fully compatible and can be mixed!

// refine-sql style (native)
const posts1 = await dataProvider
  .from('posts')
  .where('status', 'eq', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// refine-orm style (compatible)
const posts2 = await dataProvider.query
  .select('posts')
  .where('status', 'eq', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// Results are identical!
console.log(posts1.length === posts2.length); // true

// Relationship queries - both styles supported
const userWithPosts = await dataProvider.getWithRelations(
  'users',
  1,
  ['posts', 'comments']
);

// ORM-style convenience methods
const { data, created } = await dataProvider.firstOrCreate({
  resource: 'users',
  where: { email: 'user@example.com' },
  defaults: { name: 'New User' }
});

// Transaction support
await dataProvider.transaction(async (tx) => {
  const user = await tx.create({ resource: 'users', variables: userData });
  const post = await tx.create({ resource: 'posts', variables: { ...postData, user_id: user.data.id } });
  return { user, post };
});
```

### 🎯 Compatibility Matrix

| Feature Category | refine-sql | refine-orm | Compatibility | Notes |
|------------------|-------------|------------|---------------|-------|
| Basic CRUD | ✅ | ✅ | 100% | Fully compatible |
| Chain Queries | `from()` | `query.select()` | 100% | Both APIs coexist |
| Relationship Queries | ✅ | ✅ | 95% | Basic functionality compatible |
| Polymorphic Relations | ✅ | ✅ | 100% | API consistent |
| Transaction Support | ✅ | ✅ | 100% | Fully compatible |
| ORM Methods | ✅ | ✅ | 100% | `upsert`, `firstOrCreate`, etc. |
| Raw Queries | `raw()` | `executeRaw()` | 95% | Slight method name differences |
| Type Safety | ✅ | ✅ | 100% | Consistent type inference |

**Compatibility Advantages:**

- 🔄 **Seamless Migration**: Existing refine-orm code requires minimal changes
- 🎯 **Progressive Upgrade**: Gradual migration possible, mix both APIs
- 🚀 **Performance Boost**: Native SQLite performance, faster query execution
- 📦 **Smaller Bundle**: Lightweight implementation, reduced bundle size
- 🛡️ **Type Safety**: Maintains same TypeScript type inference

See our [Compatibility Guide](./packages/refine-sql/COMPATIBILITY.md) for detailed information.

**Test Validation**: All 36 compatibility tests pass, ensuring API behavior consistency and type safety.

## Features Comparison

| Feature                | refine-orm                   | refine-sql                         |
| ---------------------- | ---------------------------- | ---------------------------------- |
| **Databases**          | PostgreSQL, MySQL, SQLite    | SQLite only                        |
| **Type Safety**        | Full schema inference        | Basic TypeScript                   |
| **Relationships**      | Advanced (polymorphic, etc.) | Compatible API + Manual SQL        |
| **Query Builder**      | Chain queries, ORM methods   | Compatible chain queries + Raw SQL |
| **Runtime Support**    | Bun, Node.js, Cloudflare     | Bun, Node.js, Cloudflare           |
| **Bundle Size**        | Larger (full ORM)            | Smaller (minimal)                  |
| **Learning Curve**     | Moderate (Drizzle knowledge) | Low (SQL knowledge)                |
| **Migration from ORM** | N/A                          | ✅ **Excellent compatibility**     |
| **Performance**        | Good (ORM overhead)          | ✅ **Better (native SQL)**         |

## Examples

### Blog Application with refine-orm

``typescript
// schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schema = { users, posts };

// app.tsx
import { Refine } from '@refinedev/core';
import { createPostgreSQLProvider } from 'refine-orm';
import { schema } from './schema';

const dataProvider = await createPostgreSQLProvider(
  process.env.DATABASE_URL,
  schema
);

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        { name: 'users', list: '/users', create: '/users/create' },
        { name: 'posts', list: '/posts', create: '/posts/create' },
      ]}>
      {/* Your components */}
    </Refine>
  );
}
```

### Simple Todo App with refine-sql

``typescript
// app.tsx
import { Refine } from '@refinedev/core';
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./todos.db');

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        { name: 'todos', list: '/todos', create: '/todos/create' },
      ]}
    >
      {/* Your components */}
    </Refine>
  );
}

// SQL Schema (todos.sql)
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Runtime Support

| Runtime                | refine-orm            | refine-sql        |
| ---------------------- | --------------------- | ----------------- |
| **Bun**                | ✅ Native SQL drivers | ✅ bun:sqlite     |
| **Node.js**            | ✅ Standard drivers   | ✅ better-sqlite3 |
| **Cloudflare Workers** | ✅ D1 (SQLite only)   | ✅ D1 Database    |
| **Deno**               | 🔄 Coming soon        | 🔄 Coming soon    |

## Development

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Git

### Setup

```
# Clone the repository
git clone https://github.com/medz/refine-sqlx.git
cd refine-sqlx

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Type check
bun run typecheck
```

### Project Structure

```
refine-sqlx/
├── packages/
│   ├── refine-orm/          # Full-featured ORM data provider
│   ├── refine-sql/          # Lightweight SQL data provider
│   └── refine-core-utils/   # Shared utilities
├── .github/
│   └── workflows/           # CI/CD workflows
├── .changeset/              # Version management
└── docs/                    # Documentation
```

### Scripts

- `bun run build` - Build all packages
- `bun run test` - Run all tests
- `bun run typecheck` - Type check all packages
- `bun run format` - Format code with Prettier
- `bun run changeset` - Create a changeset for releases

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for your changes
5. Run tests: `bun run test`
6. Type check: `bun run typecheck`
7. Format code: `bun run format`
8. Commit your changes: `git commit -m 'Add amazing feature'`
9. Push to the branch: `git push origin feature/amazing-feature`
10. Open a Pull Request

## Roadmap

### v1.0 (Current)

- ✅ Multi-database support (PostgreSQL, MySQL, SQLite)
- ✅ Type-safe schema definitions
- ✅ Cross-platform runtime support
- ✅ Advanced query building
- ✅ Polymorphic relationships

### v1.1 (Next)

- 🔄 Deno runtime support
- 🔄 Edge runtime optimizations
- 🔄 Advanced caching strategies
- 🔄 Migration tools
- 🔄 Performance monitoring

### v2.0 (Future)

- 🔄 GraphQL integration
- 🔄 Real-time subscriptions
- 🔄 Advanced analytics
- 🔄 Multi-tenant support
- 🔄 Distributed transactions

## Community

- [GitHub Discussions](https://github.com/medz/refine-sqlx/discussions) - Ask questions and share ideas
- [Issues](https://github.com/medz/refine-sqlx/issues) - Report bugs and request features
- [Discord](https://discord.gg/refine) - Join the Refine community

## License

MIT © [RefineORM Team](https://github.com/medz/refine-sqlx)

## Acknowledgments

- [Refine](https://refine.dev) - The amazing React framework that inspired this project
- [Drizzle ORM](https://orm.drizzle.team) - The TypeScript ORM that powers refine-orm
- [Bun](https://bun.sh) - The fast JavaScript runtime and toolkit
- All our [contributors](https://github.com/medz/refine-sqlx/graphs/contributors) who help make this project better

---

## 中文

一套强大的、类型安全的 [Refine](https://refine.dev) 数据提供器集合，提供全面的数据库支持。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 包列表

### 🚀 [refine-orm](./packages/refine-orm)

一个强大的、类型安全的数据提供器，使用 Drizzle ORM 支持多数据库。

- **多数据库**: PostgreSQL, MySQL, SQLite
- **类型安全**: 完整的 TypeScript 支持和模式推断
- **高级功能**: 多态关系、链式查询、事务
- **运行时检测**: 自动驱动选择 (Bun, Node.js, Cloudflare)

```bash
npm install refine-orm drizzle-orm
```

### ⚡ [refine-sql](./packages/refine-sql)

一个轻量级、跨平台的 SQL 数据提供器，支持原生运行时。

- **跨平台**: Bun, Node.js, Cloudflare Workers
- **原生性能**: 运行时特定的 SQL 驱动
- **简单**: 易于使用原生 SQL
- **轻量级**: 最小依赖

```bash
npm install refine-sql
```

### 🔧 [@refine-orm/core-utils](./packages/refine-core-utils)

Refine 数据提供器的共享工具和转换器。

- **参数转换**: 将 Refine 过滤器/排序转换为 SQL/ORM 查询
- **类型安全**: 通用 TypeScript 支持
- **可扩展**: 可配置的操作符和转换器
- **性能**: 为高吞吐量应用优化

```bash
npm install @refine-orm/core-utils
```

## 快速开始

### 选择您的包

#### 高级 ORM 功能（推荐）

如果您需要以下功能，请使用 **refine-orm**：

- 类型安全的模式定义
- 复杂关系和连接
- 多态关联
- 高级查询构建
- 多数据库支持

``typescript
import { createPostgreSQLProvider } from 'refine-orm';
import { schema } from './schema';

const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:pass@localhost/db',
  schema
);
```

#### 简单 SQL 操作

如果您需要以下功能，请使用 **refine-sql**：

- 轻量级 SQLite 专用解决方案
- 原生 SQL 控制
- 跨平台兼容性
- 最小设置

``typescript
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./database.db');
```

#### 🔄 ORM 兼容性 - 接近 100% API 兼容性！

**refine-sql** 现在提供了与 refine-orm **接近 100% 的 API 兼容性**，让用户可以无缝迁移或同时使用两套 API：

``typescript
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./database.db');

// 🎯 两套 API 风格完全兼容，可以混用！

// refine-sql 风格 (原生)
const posts1 = await dataProvider
  .from('posts')
  .where('status', 'eq', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// refine-orm 风格 (兼容)
const posts2 = await dataProvider.query
  .select('posts')
  .where('status', 'eq', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// 结果完全相同！
console.log(posts1.length === posts2.length); // true

// 关系查询 - 两种风格都支持
const userWithPosts = await dataProvider.getWithRelations(
  'users',
  1,
  ['posts', 'comments']
);

// ORM 风格的便捷方法
const { data, created } = await dataProvider.firstOrCreate({
  resource: 'users',
  where: { email: 'user@example.com' },
  defaults: { name: 'New User' }
});

// 事务支持
await dataProvider.transaction(async (tx) => {
  const user = await tx.create({ resource: 'users', variables: userData });
  const post = await tx.create({ resource: 'posts', variables: { ...postData, user_id: user.data.id } });
  return { user, post };
});
```

### 🎯 兼容性对照表

| 功能类别 | refine-sql | refine-orm | 兼容性 | 说明 |
|---------|-------------|------------|--------|------|
| 基础 CRUD | ✅ | ✅ | 100% | 完全兼容 |
| 链式查询 | `from()` | `query.select()` | 100% | 两套 API 并存 |
| 关系查询 | ✅ | ✅ | 95% | 基本功能兼容 |
| 多态关联 | ✅ | ✅ | 100% | API 一致 |
| 事务支持 | ✅ | ✅ | 100% | 完全兼容 |
| ORM 方法 | ✅ | ✅ | 100% | `upsert`, `firstOrCreate` 等 |
| 原生查询 | `raw()` | `executeRaw()` | 95% | 方法名略有差异 |
| 类型安全 | ✅ | ✅ | 100% | 类型推断一致 |

**兼容性优势：**

- 🔄 **无缝迁移**: 现有 refine-orm 代码几乎无需修改
- 🎯 **渐进式升级**: 可以逐步迁移，两套 API 混用
- 🚀 **性能提升**: SQLite 原生性能，更快的查询执行
- 📦 **更小体积**: 轻量级实现，减少 bundle 大小
- 🛡️ **类型安全**: 保持相同的 TypeScript 类型推断

查看我们的 [兼容性指南](./packages/refine-sql/COMPATIBILITY.md) 了解详细信息。

**测试验证**: 36 个兼容性测试全部通过，确保 API 行为一致性和类型安全。

## 功能对比

| 功能 | refine-orm | refine-sql |
|------|------------|-------------|
| **数据库** | PostgreSQL, MySQL, SQLite | 仅 SQLite |
| **类型安全** | 完整模式推断 | 基础 TypeScript |
| **关系** | 高级（多态等） | 兼容 API + 手动 SQL |
| **查询构建器** | 链式查询、ORM 方法 | 兼容链式查询 + 原生 SQL |
| **运行时支持** | Bun, Node.js, Cloudflare | Bun, Node.js, Cloudflare |
| **包大小** | 较大（完整 ORM） | 较小（最小化） |
| **学习曲线** | 中等（需要 Drizzle 知识） | 低（需要 SQL 知识） |
| **从 ORM 迁移** | 不适用 | ✅ **优秀的兼容性** |
| **性能** | 良好（ORM 开销） | ✅ **更好（原生 SQL）** |

## 示例

### 使用 refine-orm 的博客应用

``typescript
// schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schema = { users, posts };

// app.tsx
import { Refine } from '@refinedev/core';
import { createPostgreSQLProvider } from 'refine-orm';
import { schema } from './schema';

const dataProvider = await createPostgreSQLProvider(
  process.env.DATABASE_URL,
  schema
);

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        { name: 'users', list: '/users', create: '/users/create' },
        { name: 'posts', list: '/posts', create: '/posts/create' },
      ]}>
      {/* 您的组件 */}
    </Refine>
  );
}
```

### 使用 refine-sql 的简单待办应用

``typescript
// app.tsx
import { Refine } from '@refinedev/core';
import { createProvider } from 'refine-sql';

const dataProvider = createProvider('./todos.db');

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        { name: 'todos', list: '/todos', create: '/todos/create' },
      ]}
    >
      {/* 您的组件 */}
    </Refine>
  );
}

// SQL 模式 (todos.sql)
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 运行时支持

| 运行时 | refine-orm | refine-sql |
|--------|------------|-------------|
| **Bun** | ✅ 原生 SQL 驱动 | ✅ bun:sqlite |
| **Node.js** | ✅ 标准驱动 | ✅ better-sqlite3 |
| **Cloudflare Workers** | ✅ D1 (仅 SQLite) | ✅ D1 数据库 |
| **Deno** | 🔄 即将推出 | 🔄 即将推出 |

## 开发

### 前置要求

- [Bun](https://bun.sh)（推荐）或 Node.js 18+
- Git

### 设置

```
# 克隆仓库
git clone https://github.com/medz/refine-sqlx.git
cd refine-sqlx

# 安装依赖
bun install

# 构建所有包
bun run build

# 运行测试
bun run test

# 类型检查
bun run typecheck
```

### 项目结构

```
refine-sqlx/
├── packages/
│   ├── refine-orm/          # 功能完整的 ORM 数据提供器
│   ├── refine-sql/          # 轻量级 SQL 数据提供器
│   └── refine-core-utils/   # 共享工具
├── .github/
│   └── workflows/           # CI/CD 工作流
├── .changeset/              # 版本管理
└── docs/                    # 文档
```

### 脚本

- `bun run build` - 构建所有包
- `bun run test` - 运行所有测试
- `bun run typecheck` - 类型检查所有包
- `bun run format` - 使用 Prettier 格式化代码
- `bun run changeset` - 为发布创建变更集

## 贡献

我们欢迎贡献！请查看我们的 [贡献指南](./CONTRIBUTING.md) 了解详情。

### 开发工作流

1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 进行更改
4. 为更改添加测试
5. 运行测试：`bun run test`
6. 类型检查：`bun run typecheck`
7. 格式化代码：`bun run format`
8. 提交更改：`git commit -m 'Add amazing feature'`
9. 推送到分支：`git push origin feature/amazing-feature`
10. 打开 Pull Request

## 路线图

### v1.0（当前）

- ✅ 多数据库支持（PostgreSQL, MySQL, SQLite）
- ✅ 类型安全的模式定义
- ✅ 跨平台运行时支持
- ✅ 高级查询构建
- ✅ 多态关系

### v1.1（下一步）

- 🔄 Deno 运行时支持
- 🔄 边缘运行时优化
- 🔄 高级缓存策略
- 🔄 迁移工具
- 🔄 性能监控

### v2.0（未来）

- 🔄 GraphQL 集成
- 🔄 实时订阅
- 🔄 高级分析
- 🔄 多租户支持
- 🔄 分布式事务

## 社区

- [GitHub 讨论](https://github.com/medz/refine-sqlx/discussions) - 提问和分享想法
- [Issues](https://github.com/medz/refine-sqlx/issues) - 报告错误和请求功能
- [Discord](https://discord.gg/refine) - 加入 Refine 社区

## 许可证

MIT © [RefineORM Team](https://github.com/medz/refine-sqlx)

## 致谢

- [Refine](https://refine.dev) - 启发这个项目的出色 React 框架
- [Drizzle ORM](https://orm.drizzle.team) - 为 refine-orm 提供动力的 TypeScript ORM
- [Bun](https://bun.sh) - 快速的 JavaScript 运行时和工具包
- 所有帮助改进这个项目的 [贡献者](https://github.com/medz/refine-sqlx/graphs/contributors)