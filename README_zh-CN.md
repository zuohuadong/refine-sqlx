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
- 🔌 **统一 API** - 所有数据库类型的单一接口
- 🔍 **高级过滤** - 完整支持 Refine 过滤操作符
- 💾 **事务支持** - 批量操作和原子事务
- 📊 **完整 CRUD** - 完整的创建、读取、更新、删除操作
- 🚀 **仅 ESM** - 现代 ES 模块架构
- 🎛️ **灵活连接** - 自带 Drizzle 实例 (BYO)

## 📦 安装

```bash
# 使用 Bun
bun add refine-sqlx drizzle-orm

# 使用 npm
npm install refine-sqlx drizzle-orm

# 使用 pnpm
pnpm add refine-sqlx drizzle-orm
```

### 数据库驱动

安装你需要的驱动程序：

**SQLite**:

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

只需 3 个简单步骤即可开始：

### 1. 安装依赖

```bash
npm install refine-sqlx drizzle-orm
# 安装你的数据库驱动程序（例如：Node.js 使用 better-sqlite3）
npm install better-sqlite3
npm install --save-dev drizzle-kit @types/better-sqlite3
```

### 2. 配置 Drizzle

定义你的模式并创建 Drizzle 数据库实例。

```typescript
// schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
});
```

### 3. 初始化 Refine 提供程序（依赖注入）

**v0.6.0 中的破坏性变更**：`refine-sqlx` 不再内部创建数据库连接。你必须传递一个配置好的 Drizzle `db` 实例。这确保了与 Edge 运行时（Cloudflare D1）和各种驱动程序的兼容性。

#### Node.js (better-sqlite3)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
});
```

#### Cloudflare D1

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { createRefineSQL } from 'refine-sqlx/d1';
import * as schema from './schema';

export default {
  async fetch(request, env) {
    const db = drizzle(env.DB, { schema });

    // 使用 D1 Drizzle 实例创建 Refine 提供程序
    const dataProvider = await createRefineSQL({
      connection: db,
      schema,
    });

    // ... 在 Refine Core 中使用提供程序 ...
    return Response.json({ ok: true });
  }
}
```

#### Bun

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
});
```

### 4. 高级配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,

  // 可选：启用软删除
  softDelete: {
    enabled: true,
    field: 'deleted_at',
  },

  // 可选：日志记录
  logger: true,
});
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
  connection: db, // 传递你的 Drizzle 实例
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
  connection: db, // Drizzle 实例

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

### 当前版本（v0.6.x）

- **[v0.6.0 发布说明](./.changeset/v0-6-0-release.md)** - 破坏性变更和新 API
- **[D1 示例](./example/D1_EXAMPLE.md)** - Cloudflare Workers 设置指南
- **[示例代码](./example/main-v0.3.0.ts)** - 完整使用示例
- **[技术规范](./docs/specs/CLAUDE_SPEC.md)** - 架构和标准

### 路线图和未来版本

- **[v0.7.0 功能（计划中）](./docs/features/FEATURES_v0.7.0.md)** - 核心功能和增强
  - custom() 方法用于原始 SQL 查询
  - 嵌套关系加载
  - 聚合支持
  - 字段选择/投影
  - 软删除支持
- **[v0.8.0 功能（计划中）](./docs/features/FEATURES_v0.8.0.md)** - 企业和开发者体验
  - 乐观锁定
  - 实时查询/实时订阅
  - 多租户/行级安全
  - 查询缓存
  - TypeScript 模式生成器
  - 增强的日志记录和调试

## 🔄 从 v0.5.x 迁移

v0.6.0 引入了破坏性变更以支持 Edge 运行时：

### 破坏性更改

- **连接注入**：`createRefineSQL` 不再接受连接字符串。你必须传递一个预配置的 Drizzle 实例。
- **移除检测**：已移除自动数据库类型检测，转而支持显式依赖注入。

### 迁移步骤

1. 将 `refine-sqlx` 更新到 v0.6.0
2. 安装适当的 Drizzle 驱动程序（例如 `better-sqlite3`、`mysql2`）
3. 更新 `createRefineSQL` 调用以传递 `db` 实例而不是字符串

## 📈 性能

- **标准构建**：~8 KB（主入口点）
- **D1 构建**：~18 KB gzipped
- **零外部依赖**：通过对等/显式依赖管理 Drizzle ORM
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
