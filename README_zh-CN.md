# 🚀 Refine SQL X

[English](./README.md) | [中文](./README_zh-CN.md)

一个类型安全、跨平台的 SQL 数据提供程序，适用于 [Refine](https://refine.dev)，由 [Drizzle ORM](https://orm.drizzle.team) 驱动。

[![npm version](https://img.shields.io/npm/v/refine-sqlx.svg)](https://www.npmjs.com/package/refine-sqlx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🎯 为什么选择 Refine SQL X？

**Refine SQL X** 结合了 [Refine](https://refine.dev) 和 [Drizzle ORM](https://orm.drizzle.team) 的强大功能，提供：

- ✅ **完整的 TypeScript 类型安全** - 在编译时捕获错误，而不是运行时
- ✅ **单一数据源** - 定义一次模式，到处使用
- ✅ **多数据库支持** - SQLite、MySQL、PostgreSQL 和 Cloudflare D1 使用相同的 API
- ✅ **随处可用的智能提示** - 表、列和类型的自动补全
- ✅ **零运行时成本** - 类型检查在构建时进行

### 为什么选择 Drizzle ORM？

本库使用 [Drizzle ORM](https://orm.drizzle.team) 进行模式定义，因为它提供：

1. **类型安全** - 从模式自动推断 TypeScript 类型
2. **跨数据库兼容性** - 编写一次，在 SQLite、MySQL 或 PostgreSQL 上运行
3. **熟悉的 API** - 类似 SQL 的语法，易于学习
4. **零魔法** - 明确、可预测的行为，没有隐藏的抽象
5. **轻量级** - 最小的运行时开销

## ✨ 特性

- 🎯 **模式驱动开发** - 在 TypeScript 中定义数据库模式
- 🔄 **多数据库支持** - SQLite、MySQL、PostgreSQL 和 Cloudflare D1
- 🌐 **多运行时支持** - Bun、Node.js 24+、Cloudflare Workers、better-sqlite3
- 📦 **优化的 D1 构建** - 适用于 Cloudflare Workers 的树摇优化包（~18KB gzipped）
- 🛡️ **类型推断** - 从 Drizzle 模式自动推断类型
- 🔌 **统一 API** - 所有数据库类型的单一接口，自动检测
- 🔍 **高级过滤** - 完整支持 Refine 过滤操作符
- 💾 **事务支持** - 批量操作和原子事务
- ⏰ **时间旅行** - SQLite 数据库的自动备份和恢复
- 📊 **完整 CRUD** - 完整的创建、读取、更新、删除操作
- 🚀 **仅 ESM** - 现代 ES 模块架构
- 🎛️ **自动检测** - 根据连接字符串智能选择最佳驱动程序

## 📦 安装

```bash
# 使用 Bun
bun add refine-sqlx drizzle-orm

# 使用 npm
npm install refine-sqlx drizzle-orm

# 使用 pnpm
pnpm add refine-sqlx drizzle-orm
```

### 可选数据库驱动

**SQLite**（作为可选依赖自动安装）：

```bash
npm install better-sqlite3  # 适用于 Node.js < 24
```

**MySQL**：

```bash
npm install mysql2
```

**PostgreSQL**：

```bash
npm install postgres
```

注意：Bun 和 Node.js 24+ 具有原生 SQLite 支持。Cloudflare D1 是内置的。

## 🚀 快速开始

通过 3 个简单步骤开始：

### 1. 安装依赖

```bash
npm install refine-sqlx drizzle-orm
```

### 2. 定义模式

使用 Drizzle ORM 创建一个包含数据库结构的 `schema.ts` 文件。

> ⚠️ **重要**：Drizzle ORM 使用**特定于数据库的模式函数**（`sqliteTable`、`mysqlTable`、`pgTable`）。选择与目标数据库匹配的函数。

**适用于 SQLite**（Bun、Node.js、Cloudflare D1）：

```typescript
// schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
});
```

**适用于 MySQL**：

```typescript
// schema.ts
import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = mysqlTable('posts', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  publishedAt: timestamp('published_at'),
});
```

**适用于 PostgreSQL**：

```typescript
// schema.ts
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  publishedAt: timestamp('published_at'),
});
```

> 💡 **跨数据库兼容性**：如果需要支持多个数据库，请创建单独的模式文件（例如，`schema.sqlite.ts`、`schema.mysql.ts`）或使用基于环境的导入。
>
> 📚 **了解更多**：[Drizzle 模式语法](https://orm.drizzle.team/docs/sql-schema-declaration)

### 3. 创建数据提供程序

**SQLite 快速设置**（最常见）

```typescript
import { Refine } from '@refinedev/core';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// SQLite - 文件路径或 :memory:
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
});

// MySQL - 连接字符串（自动检测）
const dataProvider = await createRefineSQL({
  connection: 'mysql://user:pass@localhost:3306/mydb',
  schema,
});

// MySQL - 配置对象
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'secret',
    database: 'mydb',
  },
  schema,
});

// PostgreSQL - 连接字符串（自动检测）
const dataProvider = await createRefineSQL({
  connection: 'postgresql://user:pass@localhost:5432/mydb',
  schema,
});

// PostgreSQL - 配置对象
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'secret',
    database: 'mydb',
  },
  schema,
});

// Cloudflare D1 - 数据库实例
const dataProvider = await createRefineSQL({
  connection: env.DB, // D1Database 实例
  schema,
});

// Drizzle 实例 - 任何数据库（最灵活）
const dataProvider = await createRefineSQL({
  connection: drizzleInstance,
  schema,
});

const App = () => (
  <Refine
    dataProvider={dataProvider}
    resources={[
      { name: 'users', list: '/users' },
      { name: 'posts', list: '/posts' },
    ]}>
    {/* 你的应用组件 */}
  </Refine>
);
```

### 3. 使用类型安全操作

```typescript
import type { InferSelectModel } from 'refine-sqlx';
import { users } from './schema';

// 自动类型推断
type User = InferSelectModel<typeof users>;

// 创建时具有类型安全
const { data } = await dataProvider.create<User>({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    createdAt: new Date(),
  },
});
```

## 🏗️ 运行时和平台示例

### SQLite 运行时

**Bun（原生 SQLite）**：

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema'; // 你的 SQLite 模式

const dataProvider = await createRefineSQL({
  connection: './database.sqlite', // 自动检测 bun:sqlite
  schema,
});
```

**Node.js 24+（原生 SQLite）**：

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = await createRefineSQL({
  connection: './database.sqlite', // 自动检测 node:sqlite
  schema,
});
```

**Node.js <24（better-sqlite3）**：

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// 如果已安装，自动回退到 better-sqlite3
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
});
```

**Cloudflare D1（优化构建）**：

```typescript
import { createRefineSQL } from 'refine-sqlx/d1';
import * as schema from './schema'; // 你的 SQLite 模式

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const dataProvider = createRefineSQL({ connection: env.DB, schema });
    // 你的 worker 逻辑
    return Response.json({ ok: true });
  },
};
```

**包大小（D1）**：~66KB 未压缩，~18KB gzipped（包括 Drizzle ORM！）

### MySQL 连接

**连接字符串**（自动检测）：

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema'; // 你的 MySQL 模式

const dataProvider = await createRefineSQL({
  connection: 'mysql://root:password@localhost:3306/mydb',
  schema,
});
```

**配置对象**（高级）：

```typescript
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    ssl: { rejectUnauthorized: false },
    pool: { max: 20, min: 5 },
  },
  schema,
});
```

### PostgreSQL 连接

**连接字符串**（自动检测）：

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema'; // 你的 PostgreSQL 模式

const dataProvider = await createRefineSQL({
  connection: 'postgresql://postgres:password@localhost:5432/mydb',
  schema,
});
```

**配置对象**（高级）：

```typescript
const dataProvider = await createRefineSQL({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
    ssl: true,
    max: 20,
    idle_timeout: 30,
  },
  schema,
});
```

### 使用现有的 Drizzle 实例

如果你已经配置了 Drizzle 实例：

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('./database.sqlite');
const db = drizzle(sqlite, { schema });

const dataProvider = createRefineSQL({ connection: db, schema });
```

## 📊 完整 CRUD 示例

### 创建操作

```typescript
import type { InferInsertModel } from 'refine-sqlx';
import { users } from './schema';

type UserInsert = InferInsertModel<typeof users>;

// 创建单条记录
const { data } = await dataProvider.create<User, UserInsert>({
  resource: 'users',
  variables: {
    name: 'Alice Smith',
    email: 'alice@example.com',
    status: 'active',
    createdAt: new Date(),
  },
});

// 创建多条记录
const { data: users } = await dataProvider.createMany<User, UserInsert>({
  resource: 'users',
  variables: [
    {
      name: 'Bob',
      email: 'bob@example.com',
      status: 'active',
      createdAt: new Date(),
    },
    {
      name: 'Carol',
      email: 'carol@example.com',
      status: 'active',
      createdAt: new Date(),
    },
  ],
});
```

### 读取操作

```typescript
// 获取列表，支持过滤、排序和分页
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  filters: [
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'name', operator: 'contains', value: 'John' },
  ],
  sorters: [{ field: 'createdAt', order: 'desc' }],
});

// 获取单条记录
const { data: user } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
});

// 通过 ID 获取多条记录
const { data: users } = await dataProvider.getMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
});
```

### 更新操作

```typescript
// 更新单条记录
const { data } = await dataProvider.update<User>({
  resource: 'users',
  id: 1,
  variables: { status: 'inactive' },
});

// 更新多条记录
const { data: users } = await dataProvider.updateMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
  variables: { status: 'active' },
});
```

### 删除操作

```typescript
// 删除单条记录
const { data } = await dataProvider.deleteOne<User>({
  resource: 'users',
  id: 1,
});

// 删除多条记录
const { data: users } = await dataProvider.deleteMany<User>({
  resource: 'users',
  ids: [1, 2, 3],
});
```

## ⏰ 时间旅行（仅限 SQLite）

为 SQLite 数据库启用自动备份和恢复功能：

```typescript
import { createRefineSQL, type DataProviderWithTimeTravel } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider: DataProviderWithTimeTravel = await createRefineSQL({
  connection: './database.sqlite',
  schema,
  timeTravel: {
    enabled: true,
    backupDir: './.time-travel', // 备份目录（默认：'./.time-travel'）
    intervalSeconds: 86400, // 备份间隔（秒）（默认：86400 = 1 天）
    retentionDays: 30, // 保留备份 30 天（默认：30）
  },
});

// 列出所有可用的快照
const snapshots = await dataProvider.listSnapshots?.();
console.log(snapshots);
// [
//   {
//     timestamp: '2025-10-16T10:30:00.000Z',
//     path: './.time-travel/snapshot-2025-10-16T10-30-00-000Z-auto.db',
//     createdAt: 1729077000000
//   }
// ]

// 创建手动快照
const snapshot = await dataProvider.createSnapshot?.('before-migration');

// 恢复到特定时间戳
await dataProvider.restoreToTimestamp?.('2025-10-16T10:30:00.000Z');

// 恢复到日期之前的最近快照
await dataProvider.restoreToDate?.(new Date('2025-10-16'));

// 清理旧快照
const deletedCount = await dataProvider.cleanupSnapshots?.();

// 停止自动备份（关闭时）
dataProvider.stopAutoBackup?.();
```

### 时间旅行特性

- 🔄 **自动备份**：可配置的基于间隔的快照
- 📸 **手动快照**：按需创建带标签的快照
- 🕰️ **时间点恢复**：恢复到特定时间戳或日期
- 🧹 **自动清理**：旧快照的保留策略
- 🔒 **恢复前备份**：恢复前自动创建备份
- 📁 **基于文件**：简单、高效的文件系统操作

**注意**：时间旅行仅适用于基于文件存储的 SQLite 数据库（不支持 `:memory:`）。

## 🔍 高级过滤

支持所有标准 Refine 过滤操作符：

```typescript
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  filters: [
    // 相等性
    { field: 'status', operator: 'eq', value: 'active' },
    { field: 'status', operator: 'ne', value: 'deleted' },

    // 比较
    { field: 'createdAt', operator: 'gte', value: new Date('2024-01-01') },
    { field: 'createdAt', operator: 'lte', value: new Date() },

    // 字符串操作
    { field: 'name', operator: 'contains', value: 'John' },
    { field: 'email', operator: 'startswith', value: 'admin' },

    // 数组操作
    { field: 'status', operator: 'in', value: ['active', 'pending'] },
    { field: 'status', operator: 'nin', value: ['deleted', 'banned'] },

    // 空值检查
    { field: 'deletedAt', operator: 'null' },
    { field: 'email', operator: 'nnull' },

    // 范围
    { field: 'age', operator: 'between', value: [18, 65] },
  ],
  sorters: [
    { field: 'createdAt', order: 'desc' },
    { field: 'name', order: 'asc' },
  ],
});
```

### 支持的过滤操作符

- `eq`、`ne` - 相等/不相等
- `lt`、`lte`、`gt`、`gte` - 比较
- `in`、`nin` - 数组成员资格
- `contains`、`ncontains` - 子字符串搜索（不区分大小写）
- `containss`、`ncontainss` - 子字符串搜索（区分大小写）
- `startswith`、`nstartswith`、`endswith`、`nendswith` - 字符串位置
- `between`、`nbetween` - 范围检查
- `null`、`nnull` - 空值检查

## ⚙️ 配置

```typescript
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const dataProvider = createRefineSQL({
  // 数据库连接
  connection: './database.sqlite', // 或 D1Database、Drizzle 实例等

  // Drizzle 模式（必需）
  schema,

  // 可选的 Drizzle 配置
  config: {
    logger: true, // 启用查询日志
  },

  // 字段命名约定（默认：'snake_case'）
  casing: 'camelCase', // 或 'snake_case' 或 'none'

  // 自定义日志记录器
  logger: true, // 或自定义 Logger 实例
});
```

## 🎯 类型导出

```typescript
import type {
  // 带时间旅行的扩展 DataProvider
  DataProviderWithTimeTravel,
  InferInsertModel,
  // 从模式推断类型
  InferSelectModel,
  // 配置
  RefineSQLConfig,
  // 运行时检测
  RuntimeEnvironment,
  // 表名助手
  TableName,
  // 时间旅行
  TimeTravelOptions,
  TimeTravelSnapshot,
} from 'refine-sqlx';

// 用法
type User = InferSelectModel<typeof users>;
type UserInsert = InferInsertModel<typeof users>;
```

## 📋 要求

- **TypeScript**：5.0+
- **Node.js**：20.0+（推荐 24.0+ 以支持原生 SQLite）
- **Bun**：1.0+（可选）
- **对等依赖**：`@refinedev/core ^5.0.0`、`@tanstack/react-query ^5.0.0`
- **依赖**：`drizzle-orm ^0.44.0`
- **可选**：`better-sqlite3 ^12.0.0`（Node.js < 24 的回退方案）

## 🧪 测试

```bash
# 运行测试
bun test

# 运行集成测试
bun run test:integration-bun
bun run test:integration-node
bun run test:integration-better-sqlite3

# 构建
bun run build

# 格式化代码
bun run format
```

## 📚 文档

提供全面的文档：

### 当前版本（v0.3.x）

- **[v0.3.0 发布说明](./.changeset/v0-3-0-release.md)** - 使用 Drizzle ORM 完全重写
- **[D1 示例](./example/D1_EXAMPLE.md)** - Cloudflare Workers 设置指南
- **[示例代码](./example/main-v0.3.0.ts)** - 完整使用示例
- **[技术规范](./docs/specs/CLAUDE_SPEC.md)** - 架构和标准

### 路线图和未来版本

- **[v0.4.0 功能（计划中）](./docs/features/FEATURES_v0.4.0.md)** - 核心功能和增强（2025 年第一季度）
  - custom() 方法用于原始 SQL 查询
  - 嵌套关系加载
  - 聚合支持
  - 字段选择/投影
  - 软删除支持
- **[v0.5.0 功能（计划中）](./docs/features/FEATURES_v0.5.0.md)** - 企业和开发者体验（2025 年第二至第三季度）
  - 乐观锁定
  - 实时查询/实时订阅
  - 多租户/行级安全
  - 查询缓存
  - TypeScript 模式生成器
  - 增强的日志记录和调试

## 🔄 从 v0.2.x 迁移

v0.3.0 是完全重写，具有破坏性更改：

### 破坏性更改

- **必需**：Drizzle ORM 模式定义（不再支持无模式使用）
- **新 API**：`createRefineSQL({ connection, schema })` 而不是 `createRefineSQL(path)`
- **仅 ESM**：不支持 CommonJS
- **TypeScript 5.0+**：现代类型功能所需
- **Node.js 20+**：最低版本提高

### 迁移步骤

1. 安装 Drizzle ORM：`npm install drizzle-orm`
2. 使用 Drizzle 定义模式
3. 更新 `createRefineSQL` 调用以使用新 API
4. 将 TypeScript 更新到 5.0+
5. 验证所有导入都是 ESM

查看 [CHANGELOG.md](./CHANGELOG.md) 获取详细的迁移指南。

## 📈 性能

- **标准构建**：8.06 KB（主入口点）
- **D1 构建**：66 KB 未压缩，~18 KB gzipped
- **零外部依赖**：Drizzle ORM 完全树摇并打包（仅 D1）
- **类型安全**：类型检查零运行时开销

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。对于重大更改，请先开 issue 讨论你想要更改的内容。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🔗 链接

- [Refine 文档](https://refine.dev/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [GitHub 仓库](https://github.com/medz/refine-sqlx)
- [npm 包](https://www.npmjs.com/package/refine-sqlx)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)

---
