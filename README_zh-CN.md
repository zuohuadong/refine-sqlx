# 🚀 Refine SQL X

[English](./README.md) | [中文](./README_zh-CN.md)

一个类型安全、框架无关的 SQL 数据提供程序，由 [Drizzle ORM](https://orm.drizzle.team) 驱动。兼容 [Refine](https://refine.dev)、[svadmin](https://github.com/zuohuadong/svadmin) 及任何基于 DataProvider 模式的框架。

[![npm version](https://img.shields.io/npm/v/refine-sqlx.svg)](https://www.npmjs.com/package/refine-sqlx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🎯 为什么选择 Refine SQL X？

**Refine SQL X** 结合了 [Drizzle ORM](https://orm.drizzle.team) 与 DataProvider 模式的强大功能，提供：

- ✅ **完整的 TypeScript 类型安全** - 在编译时捕获错误，而不是运行时
- ✅ **单一数据源** - 定义一次模式，到处使用
- ✅ **多数据库支持** - SQLite、MySQL、PostgreSQL 和 Cloudflare D1 使用相同的 API
- ✅ **框架无关** - 支持 Refine (React)、svadmin (Svelte) 或任何 DataProvider 消费者
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
- 🔍 **高级过滤** - 完整支持过滤操作符（eq、contains、between 等）
- 💾 **事务支持** - 批量操作和原子事务
- 🔄 **智能 ID 转换** - 自动将字符串 ID 转换为正确的类型
- 🔗 **关系查询** - 支持嵌套关系加载
- 🛠️ **Simple REST 适配器** - 轻松适配 simple-rest 风格的 API
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
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({ connection: db, schema });
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
    const dataProvider = await createRefineSQL({ connection: db, schema });

    // ... 在 Refine Core 中使用提供程序 ...
    return Response.json({ ok: true });
  },
};
```

#### Bun

**使用 Bun 原生 SQLite 驱动：**

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

const dataProvider = await createRefineSQL({ connection: db, schema });
```

**使用 Bun 原生 SQL 驱动（PostgreSQL/MySQL）：**

```typescript
import { drizzle } from 'drizzle-orm/bun-sql';
import { createRefineSQL } from 'refine-sqlx';
import * as schema from './schema';

// PostgreSQL
const db = drizzle('postgres://user:pass@localhost:5432/mydb', { schema });

// MySQL
const db = drizzle('mysql://user:pass@localhost:3306/mydb', { schema });

const dataProvider = await createRefineSQL({ connection: db, schema });
```

### 3. 初始化 Refine 提供程序（零配置）

如果你有一个包含 schema 的 Drizzle 实例，可以使用快捷方式：

```typescript
import { drizzleDataProvider } from 'refine-sqlx';

const dataProvider = await drizzleDataProvider(db);
```

## 🔌 框架集成

refine-sqlx 是**框架无关**的 —— 它创建的 `DataProvider` 可以用于任何遵循 DataProvider 模式的框架。以下是两个官方支持的框架示例：

### Refine (React)

```tsx
import { Refine } from '@refinedev/core';
import { drizzleDataProvider } from 'refine-sqlx';

// 创建数据提供程序（服务端）
const dataProvider = await drizzleDataProvider(db);

// 在 React 应用中使用
function App() {
  return (
    <Refine dataProvider={dataProvider}>{/* 你的 Refine 资源和页面 */}</Refine>
  );
}
```

完整的 Refine 设置请参考 [Refine 文档](https://refine.dev/docs)。

### svadmin (Svelte)

```typescript
// src/lib/server/data-provider.ts
import { drizzleDataProvider } from 'refine-sqlx';
import { db } from './db';

export const dataProvider = await drizzleDataProvider(db);
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { SvAdmin } from '@svadmin/core';
  import { dataProvider } from '$lib/server/data-provider';
</script>

<SvAdmin {dataProvider}>
  <!-- 你的 svadmin 资源和页面 -->
</SvAdmin>
```

完整的 svadmin 设置请参考 [svadmin 文档](https://github.com/zuohuadong/svadmin)。

### 在任何框架中使用

`DataProvider` 接口简单且自包含。你可以在任何服务端框架中直接使用：

```typescript
import { drizzleDataProvider } from 'refine-sqlx';

const dataProvider = await drizzleDataProvider(db);

// 在 Elysia / Express / Hono 路由处理器中使用
app.get('/api/users', async () => {
  const { data, total } = await dataProvider.getList({
    resource: 'users',
    pagination: { current: 1, pageSize: 20 },
    sorters: [{ field: 'createdAt', order: 'desc' }],
  });
  return { data, total };
});
```

### 4. 初始化 Refine 提供程序（高级配置）

包含安全配置和其他选项：

```typescript
import { createRefineSQL } from 'refine-sqlx';

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  security: {
    // 仅允许访问这些表
    allowedTables: ['posts', 'users'],
    // 隐藏敏感字段
    hiddenFields: { users: ['password'] },
    // 限制操作
    allowedOperations: ['read', 'create', 'update'],
    // 每次请求最大记录数
    maxLimit: 1000,
  },
  softDelete: { enabled: true, field: 'deleted_at' },
});
```

### 5. 已配置的提供程序

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,

  // 可选：启用软删除
  softDelete: { enabled: true, field: 'deleted_at' },

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

## 🔄 智能 ID 类型转换

从 v0.7.0 开始，refine-sqlx 会自动将 ID 转换为正确的类型：

```typescript
// 即使 schema 中 id 是 integer，字符串也会自动转换
const { data } = await dataProvider.getOne({
  resource: 'users',
  id: '123', // 自动转换为数字 123
});

// 批量操作同样支持
const { data } = await dataProvider.getMany({
  resource: 'users',
  ids: ['1', '2', '3'], // 自动转换为 [1, 2, 3]
});
```

### 手动使用 ID 转换工具

```typescript
import { normalizeId, normalizeIds } from 'refine-sqlx';

// 单个 ID 转换
const id = normalizeId(table.id, '123'); // 123

// 批量 ID 转换
const ids = normalizeIds(table.id, ['1', '2', '3']); // [1, 2, 3]
```

## 💾 事务支持

启用事务功能后，可以在事务中执行多个操作：

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  features: {
    transactions: {
      enabled: true,
      timeout: 5000, // 事务超时时间（毫秒）
      autoRollback: true, // 出错时自动回滚
    },
  },
});

// 在事务中执行多个操作
await dataProvider.transaction(async (tx) => {
  const order = await tx.create({
    resource: 'orders',
    variables: { userId: 1, total: 100 },
  });

  await tx.create({
    resource: 'order_items',
    variables: { orderId: order.data.id, productId: 1, quantity: 2 },
  });

  await tx.update({
    resource: 'products',
    id: 1,
    variables: { stock: sql`stock - 2` },
  });
});
```

## 🔗 关系查询

启用关系功能后，可以加载关联数据：

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  features: {
    relations: {
      enabled: true,
      maxDepth: 3, // 最大嵌套深度
      cache: false, // 是否缓存关系查询
    },
  },
});

// 加载关联数据
const { data } = await dataProvider.getOne({
  resource: 'posts',
  id: 1,
  meta: {
    include: {
      author: true, // 加载作者
      comments: {
        include: {
          author: true, // 嵌套加载评论的作者
        },
      },
    },
  },
});

// 结果包含关联数据
console.log(data.author.name);
console.log(data.comments[0].author.name);
```

## 🛠️ Simple REST 适配器

如果你需要适配 simple-rest 风格的 API 参数，可以使用内置的转换工具：

```typescript
import { convertSimpleRestParams } from 'refine-sqlx';

// 从 URL 查询参数转换
// GET /posts?_start=0&_end=10&_sort=title&_order=asc&status=active
const query = {
  _start: 0,
  _end: 10,
  _sort: 'title',
  _order: 'asc',
  status: 'active',
};

const { pagination, sorters, filters } = convertSimpleRestParams(query);

// pagination: { current: 1, pageSize: 10 }
// sorters: [{ field: 'title', order: 'asc' }]
// filters: [{ field: 'status', operator: 'eq', value: 'active' }]

// 使用转换后的参数
const { data, total } = await dataProvider.getList({
  resource: 'posts',
  ...pagination,
  sorters,
  filters,
});
```

### 支持的 Simple REST 参数

| 参数                                                     | 说明                           |
| -------------------------------------------------------- | ------------------------------ |
| `_start`, `_end`                                         | 偏移量分页                     |
| `_page`, `_perPage`                                      | 页码分页                       |
| `_sort`                                                  | 排序字段（支持逗号分隔多字段） |
| `_order`                                                 | 排序方向（asc/desc）           |
| `_fields`                                                | 选择字段                       |
| `_embed`                                                 | 嵌入关联                       |
| `{field}`                                                | 相等过滤                       |
| `{field}_ne`                                             | 不相等                         |
| `{field}_gt`, `{field}_gte`, `{field}_lt`, `{field}_lte` | 比较                           |
| `{field}_contains`                                       | 包含（不区分大小写）           |
| `{field}_startswith`, `{field}_endswith`                 | 前缀/后缀匹配                  |

## 📡 实时订阅

refine-sqlx 提供两种实时订阅策略：

### 方式 1：轮询（所有平台）

```typescript
import { createLiveProvider, LiveEventEmitter } from 'refine-sqlx';

const emitter = new LiveEventEmitter();
const liveProvider = createLiveProvider(
  {
    strategy: 'polling',
    pollingInterval: 5000, // 每 5 秒轮询一次
  },
  emitter,
  dataProvider,
);

// 订阅数据变化
liveProvider.subscribe({
  channel: 'users',
  types: ['created', 'updated', 'deleted'],
  callback: (event) => {
    console.log('User changed:', event);
  },
});
```

### 方式 2：PostgreSQL LISTEN/NOTIFY（仅 PostgreSQL）

> ⚠️ **注意**：此功能是临时实现，当 Drizzle ORM 支持原生实时订阅后将被移除。

```typescript
import {
  createLiveProviderAsync,
  createPostgresNotifyTriggerSQL,
} from 'refine-sqlx';

// 1. 首先在数据库中创建触发器（只需执行一次）
const triggerSQL = createPostgresNotifyTriggerSQL('users', 'users', 'id');
await db.execute(triggerSQL);

// 2. 创建实时订阅提供者
const liveProvider = await createLiveProviderAsync({
  strategy: 'postgres-notify',
  postgresConfig: {
    connectionString: process.env.DATABASE_URL,
    channels: ['users', 'posts', 'comments'],
  },
});

// 3. 订阅数据变化
const unsubscribe = liveProvider.subscribe({
  channel: 'users',
  types: ['created', 'updated', 'deleted'],
  callback: (event) => {
    console.log('User changed:', event);
    // event.payload.ids - 变化的记录 ID
    // event.payload.data - 新数据（INSERT/UPDATE）
  },
});

// 4. 应用关闭时断开连接
await liveProvider.disconnect();
```

### 生成触发器 SQL

```typescript
import {
  createPostgresNotifyTriggerSQL,
  dropPostgresNotifyTriggerSQL,
} from 'refine-sqlx';

// 为表创建触发器
const sql = createPostgresNotifyTriggerSQL('users', 'users_changes', 'id');
console.log(sql);
// 执行此 SQL 来创建触发器

// 删除触发器
const dropSQL = dropPostgresNotifyTriggerSQL('users');
```

| `{field}_in` | 数组包含（逗号分隔） |
| `{field}_between` | 范围（逗号分隔两个值） |

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
  DataProviderWithAggregations,
  // 扩展的 DataProvider 类型
  DataProviderWithTransactions,
  ExtendedDataProvider,
  FeaturesConfig,
  // 从模式推断类型
  InferInsertModel,
  InferSelectModel,
  // 配置
  RefineSQLConfig,
  // 运行时检测
  RuntimeEnvironment,
  // 表名助手
  TableName,
  // 时间旅行
  TimeTravelOptions,
} from 'refine-sqlx';
// 导入工具函数
import {
  calculatePagination,
  // Simple REST 适配器
  convertSimpleRestParams,
  // 过滤器工具
  filtersToWhere,
  // ID 类型转换
  normalizeId,
  normalizeIds,
  sortersToOrderBy,
  toSimpleRestParams,
} from 'refine-sqlx';

// 用法
type User = InferSelectModel<typeof users>;
type UserInsert = InferInsertModel<typeof users>;
```

## 📋 要求

- **TypeScript**：5.0+
- **Node.js**：20.0+（推荐 24.0+ 以支持原生 SQLite）
- **Bun**：1.0+（可选）
- **对等依赖**：无（框架无关）
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

- **[v0.7.0 功能（已发布）](./docs/features/FEATURES_v0.7.0.md)** - 核心功能和增强
  - ✅ custom() 方法用于原始 SQL 查询
  - ✅ 嵌套关系加载
  - ✅ 聚合支持
  - ✅ 字段选择/投影
  - ✅ 软删除支持
  - ✅ 智能 ID 类型转换
  - ✅ Simple REST 适配器
  - ✅ 事务支持暴露到 DataProvider
  - ✅ Bun SQL 驱动支持（PostgreSQL/MySQL）

- **[v0.8.0 功能（已发布）](./docs/features/FEATURES_v0.8.0.md)** - 企业和开发者体验
  - ✅ 乐观锁定
  - ✅ 多租户/行级安全
  - ✅ 查询缓存
  - ✅ 增强的错误处理
  - ✅ 增强的日志记录和调试

- **v0.9.0 功能（已发布）** - 高级功能
  - ✅ 实时查询/实时订阅（轮询 + PostgreSQL LISTEN/NOTIFY）
  - ✅ 框架无关的 DataProvider（兼容 Refine、svadmin 等）
  - 🔄 Mock DataProvider 用于测试

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
- [svadmin 文档](https://github.com/zuohuadong/svadmin)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [GitHub 仓库](https://github.com/zuohuadong/refine-sqlx)
- [npm 包](https://www.npmjs.com/package/refine-sqlx)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)

---
