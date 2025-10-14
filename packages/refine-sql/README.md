# Refine SQL

[English](#english) | [中文](#中文)

## English

A lightweight, cross-platform SQL data provider for [Refine](https://refine.dev) with native runtime support.

[![npm version](https://img.shields.io/npm/v/refine-d1.svg)](https://www.npmjs.com/package/refine-d1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- 🚀 **Cross-platform**: Works with Bun, Node.js, and Cloudflare Workers
- ⚡ **Native performance**: Uses runtime-specific SQL drivers
- 🔒 **Type-safe**: Full TypeScript support with schema inference
- 📦 **Lightweight**: Minimal dependencies and optimized bundle size
- 🎯 **Simple**: Easy to use with raw SQL
- 🔄 **Transactions**: Built-in transaction support
- 🔗 **Chain Queries**: Fluent interface for building complex queries (optional)
- 🔄 **Polymorphic Relations**: Support for morphTo/morphMany relationships (optional)
- 🛡️ **ORM Compatibility**: Enhanced type-safe CRUD operations (optional)
- 📦 **Modular**: Import only what you need with tree-shaking support

## Installation

```bash
npm install refine-d1
# or
bun add refine-d1
```

### Advanced Features (On-demand)

Import advanced features only when needed:

```typescript
// Import the main provider
import { createProvider } from 'refine-d1';

// Optional: Polymorphic relations
import { SqlxMorphQuery } from 'refine-d1/morph-query';

// Optional: Type-safe methods
import { SqlxTypedMethods } from 'refine-d1/typed-methods';
```

### Optional Dependencies

Install database drivers based on your runtime:

```bash
# For Node.js with SQLite
npm install better-sqlite3

# Bun and Cloudflare Workers use built-in drivers
```

## Quick Start

### Basic Usage

```typescript
import { createRefineSQL } from 'refine-d1';

// File database (Bun/Node.js)
const dataProvider = createRefineSQL('./database.db');

// In-memory database
const dataProvider = createRefineSQL(':memory:');

// Cloudflare D1 (Workers)
const dataProvider = createRefineSQL(env.DB);
```

### With Refine

```typescript
import { Refine } from '@refinedev/core';
import { createRefineSQL } from 'refine-d1';

const dataProvider = createRefineSQL('./database.db');

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        {
          name: 'users',
          list: '/users',
          create: '/users/create',
          edit: '/users/edit/:id',
          show: '/users/show/:id',
        },
      ]}>
      {/* Your app components */}
    </Refine>
  );
}
```

## Database Schema

Create your tables using standard SQL:

```sql
-- users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- posts table
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Advanced Usage

### Custom SQL Queries

```typescript
// The data provider automatically handles CRUD operations
// based on your table structure and Refine's conventions

// For custom queries, you can access the underlying client:
const client = dataProvider.client;

// Raw SQL query
const result = await client.query('SELECT * FROM users WHERE active = ?', [
  true,
]);

// With transactions
await client.transaction(async tx => {
  await tx.execute('INSERT INTO users (name, email) VALUES (?, ?)', [
    'John',
    'john@example.com',
  ]);
  await tx.execute('INSERT INTO posts (title, user_id) VALUES (?, ?)', [
    'Hello World',
    1,
  ]);
});
```

### Filtering and Sorting

The data provider automatically converts Refine's filter and sort parameters to SQL:

```typescript
// This Refine query:
const { data } = useList({
  resource: 'users',
  filters: [
    { field: 'name', operator: 'contains', value: 'john' },
    { field: 'active', operator: 'eq', value: true },
  ],
  sorters: [{ field: 'created_at', order: 'desc' }],
  pagination: { current: 1, pageSize: 10 },
});

// Becomes this SQL:
// SELECT * FROM users
// WHERE name LIKE '%john%' AND active = true
// ORDER BY created_at DESC
// LIMIT 10 OFFSET 0
```

### Supported Filter Operators

- `eq` - Equal
- `ne` - Not equal
- `lt` - Less than
- `lte` - Less than or equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `in` - In array
- `nin` - Not in array
- `contains` - Contains (LIKE %value%)
- `ncontains` - Not contains
- `startswith` - Starts with (LIKE value%)
- `endswith` - Ends with (LIKE %value)
- `between` - Between two values
- `null` - Is null
- `nnull` - Is not null

## Runtime Support

| Runtime            | SQLite Support | Driver         |
| ------------------ | -------------- | -------------- |
| Bun                | ✅             | bun:sqlite     |
| Node.js            | ✅             | better-sqlite3 |
| Cloudflare Workers | ✅             | D1 Database    |

## Configuration Options

```typescript
const dataProvider = createRefineSQL('./database.db', {
  // Enable debug logging
  debug: true,

  // Custom logger
  logger: (query, params) => {
    console.log('SQL:', query);
    console.log('Params:', params);
  },

  // Connection options (Node.js only)
  options: { readonly: false, fileMustExist: false, timeout: 5000 },
});
```

## Error Handling

```typescript
import { createRefineSQL } from 'refine-d1';

try {
  const dataProvider = createRefineSQL('./database.db');
  const result = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  console.error('Database error:', error.message);
}
```

## Migration from Other Providers

### From Simple REST

```typescript
// Before
const dataProvider = simpleRestProvider('http://localhost:3000/api');

// After
const dataProvider = createRefineSQL('./database.db');
```

### From Supabase

```typescript
// Before
const dataProvider = supabaseDataProvider(supabaseClient);

// After
const dataProvider = createRefineSQL('./database.db');
// Note: You'll need to migrate your data from Supabase to SQLite
```

## Examples

### Bun Application

```typescript
// server.ts
import { Hono } from 'hono';
import { createRefineSQL } from 'refine-d1';

const app = new Hono();
const dataProvider = createRefineSQL('./app.db');

app.get('/api/users', async c => {
  const users = await dataProvider.getList({ resource: 'users' });
  return c.json(users);
});

export default app;
```

### Cloudflare Workers

```typescript
// worker.ts
import { createRefineSQL } from 'refine-d1';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataProvider = createRefineSQL(env.DB);

    const users = await dataProvider.getList({ resource: 'users' });

    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

### Node.js with Express

```typescript
// server.js
import express from 'express';
import { createRefineSQL } from 'refine-d1';

const app = express();
const dataProvider = createRefineSQL('./database.db');

app.get('/api/users', async (req, res) => {
  try {
    const users = await dataProvider.getList({ resource: 'users' });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## ORM Compatibility Features

The `refine-d1` package now includes enhanced ORM compatibility features for a more modern development experience:

### Chain Query Builder

```typescript
import createRefineSQL, {
  type EnhancedDataProvider,
  type TableSchema,
} from 'refine-d1';

// Define your schema for type safety
interface MySchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'inactive';
  };
}

const dataProvider: EnhancedDataProvider<MySchema> =
  createRefineSQL<MySchema>('./database.db');

// Chain query example
const activeUsers = await dataProvider
  .from<MySchema['users']>('users')
  .where('status', 'eq', 'active')
  .where('age', 'gte', 18)
  .orderBy('name', 'asc')
  .limit(10)
  .get();

// Aggregation queries
const userCount = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .count();
```

### Polymorphic Relationships

```typescript
// Load polymorphic relationships
const commentsWithRelations = await dataProvider
  .morphTo('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .get();
```

### Type-Safe Operations

```typescript
// Type-safe create
const newUser = await dataProvider.createTyped({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active', // TypeScript ensures correct values
  },
});

// Type-safe queries
const users = await dataProvider.findManyTyped(
  'users',
  { status: 'active' },
  { limit: 10, orderBy: [{ field: 'created_at', order: 'desc' }] }
);
```

For complete documentation on ORM compatibility features, see [ORM_COMPATIBILITY.md](./ORM_COMPATIBILITY.md).

## API Reference

### Main Functions

- `createRefineSQL(database, options?)` - Create SQL data provider

### Data Provider Methods

- `getList(params)` - Get paginated list of records
- `getOne(params)` - Get single record by ID
- `getMany(params)` - Get multiple records by IDs
- `create(params)` - Create new record
- `createMany(params)` - Create multiple records
- `update(params)` - Update existing record
- `updateMany(params)` - Update multiple records
- `deleteOne(params)` - Delete single record
- `deleteMany(params)` - Delete multiple records

### Enhanced ORM Methods

- `from(table)` - Create chain query builder
- `morphTo(table, config)` - Create polymorphic query
- `getTyped(params)` - Type-safe get operation
- `createTyped(params)` - Type-safe create operation
- `updateTyped(params)` - Type-safe update operation
- `findTyped(table, conditions)` - Find single record
- `findManyTyped(table, conditions, options)` - Find multiple records
- `existsTyped(table, conditions)` - Check record existence

### Client Methods

- `client.query(sql, params?)` - Execute SELECT query
- `client.execute(sql, params?)` - Execute INSERT/UPDATE/DELETE
- `client.transaction(callback)` - Execute in transaction
- `client.batch(statements)` - Execute batch of statements

## Troubleshooting

### Common Issues

1. **File not found error**

   ```typescript
   // Make sure the database file exists or use :memory:
   const dataProvider = createRefineSQL(':memory:');
   ```

2. **Permission errors**

   ```bash
   # Ensure the process has write permissions to the database file
   chmod 666 database.db
   ```

3. **Better-sqlite3 installation issues**
   ```bash
   # For Node.js, make sure better-sqlite3 is installed
   npm install better-sqlite3
   ```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

## MIT © [RefineORM Team](https://github.com/zuohuadong/refine-d1)

## 中文

一个轻量级、跨平台的 [Refine](https://refine.dev) SQL 数据提供器，支持原生运行时。

[![npm version](https://img.shields.io/npm/v/refine-d1.svg)](https://www.npmjs.com/package/refine-d1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 功能特性

- 🚀 **跨平台**: 支持 Bun、Node.js 和 Cloudflare Workers
- ⚡ **原生性能**: 使用运行时特定的 SQL 驱动
- 🔒 **类型安全**: 完整的 TypeScript 支持和模式推断
- 📦 **超轻量级**: 核心版本仅 ~3kB，完整版本 ~23kB
- 🎯 **简单**: 易于使用原生 SQL
- 🔄 **事务**: 内置事务支持
- 🔗 **链式查询**: 构建复杂查询的流畅接口（可选）
- 🔄 **多态关系**: 支持 morphTo/morphMany 关系（可选）
- 🛡️ **ORM 兼容性**: 增强的类型安全 CRUD 操作（可选）
- 📦 **模块化**: 通过 tree-shaking 支持按需导入

## 安装

```bash
npm install refine-d1
# 或
bun add refine-d1
```

## 包大小优化

根据您的需求选择合适的版本：

```typescript
// 导入主要提供器
import { createProvider } from 'refine-d1';
```

### 可选依赖

根据您的运行时安装数据库驱动：

```bash
# 用于 Node.js 的 SQLite
npm install better-sqlite3

# Bun 和 Cloudflare Workers 使用内置驱动
```

## 快速开始

### 基础用法

```typescript
import { createRefineSQL } from 'refine-d1';

// 文件数据库 (Bun/Node.js)
const dataProvider = createRefineSQL('./database.db');

// 内存数据库
const dataProvider = createRefineSQL(':memory:');

// Cloudflare D1 (Workers)
const dataProvider = createRefineSQL(env.DB);
```

### 与 Refine 一起使用

```typescript
import { Refine } from '@refinedev/core';
import { createRefineSQL } from 'refine-d1';

const dataProvider = createRefineSQL('./database.db');

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        {
          name: 'users',
          list: '/users',
          create: '/users/create',
          edit: '/users/edit/:id',
          show: '/users/show/:id',
        },
      ]}>
      {/* 您的应用组件 */}
    </Refine>
  );
}
```

## 数据库模式

使用标准 SQL 创建表：

```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文章表
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 高级用法

### 自定义 SQL 查询

```typescript
// 数据提供器自动处理基于表结构和 Refine 约定的 CRUD 操作

// 对于自定义查询，您可以访问底层客户端：
const client = dataProvider.client;

// 原生 SQL 查询
const result = await client.query('SELECT * FROM users WHERE active = ?', [
  true,
]);

// 使用事务
await client.transaction(async tx => {
  await tx.execute('INSERT INTO users (name, email) VALUES (?, ?)', [
    'John',
    'john@example.com',
  ]);
  await tx.execute('INSERT INTO posts (title, user_id) VALUES (?, ?)', [
    'Hello World',
    1,
  ]);
});
```

### 过滤和排序

数据提供器自动将 Refine 的过滤器和排序参数转换为 SQL：

```typescript
// 这个 Refine 查询：
const { data } = useList({
  resource: 'users',
  filters: [
    { field: 'name', operator: 'contains', value: 'john' },
    { field: 'active', operator: 'eq', value: true },
  ],
  sorters: [{ field: 'created_at', order: 'desc' }],
  pagination: { current: 1, pageSize: 10 },
});

// 转换为这个 SQL：
// SELECT * FROM users
// WHERE name LIKE '%john%' AND active = true
// ORDER BY created_at DESC
// LIMIT 10 OFFSET 0
```

### 支持的过滤操作符

- `eq` - 等于
- `ne` - 不等于
- `lt` - 小于
- `lte` - 小于等于
- `gt` - 大于
- `gte` - 大于等于
- `in` - 在数组中
- `nin` - 不在数组中
- `contains` - 包含 (LIKE %value%)
- `ncontains` - 不包含
- `startswith` - 开始于 (LIKE value%)
- `endswith` - 结束于 (LIKE %value)
- `between` - 在两个值之间
- `null` - 为空
- `nnull` - 不为空

## 运行时支持

| 运行时             | SQLite 支持 | 驱动           |
| ------------------ | ----------- | -------------- |
| Bun                | ✅          | bun:sqlite     |
| Node.js            | ✅          | better-sqlite3 |
| Cloudflare Workers | ✅          | D1 数据库      |

## 配置选项

```typescript
const dataProvider = createRefineSQL('./database.db', {
  // 启用调试日志
  debug: true,

  // 自定义日志记录器
  logger: (query, params) => {
    console.log('SQL:', query);
    console.log('参数:', params);
  },

  // 连接选项（仅 Node.js）
  options: { readonly: false, fileMustExist: false, timeout: 5000 },
});
```

## 错误处理

```typescript
import { createRefineSQL } from 'refine-d1';

try {
  const dataProvider = createRefineSQL('./database.db');
  const result = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  console.error('数据库错误:', error.message);
}
```

## 从其他提供器迁移

### 从 Simple REST

```typescript
// 之前
const dataProvider = simpleRestProvider('http://localhost:3000/api');

// 之后
const dataProvider = createRefineSQL('./database.db');
```

### 从 Supabase

```typescript
// 之前
const dataProvider = supabaseDataProvider(supabaseClient);

// 之后
const dataProvider = createRefineSQL('./database.db');
// 注意：您需要将数据从 Supabase 迁移到 SQLite
```

## 示例

### Bun 应用

```typescript
// server.ts
import { Hono } from 'hono';
import { createRefineSQL } from 'refine-d1';

const app = new Hono();
const dataProvider = createRefineSQL('./app.db');

app.get('/api/users', async c => {
  const users = await dataProvider.getList({ resource: 'users' });
  return c.json(users);
});

export default app;
```

### Cloudflare Workers

```typescript
// worker.ts
import { createRefineSQL } from 'refine-d1';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataProvider = createRefineSQL(env.DB);

    const users = await dataProvider.getList({ resource: 'users' });

    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

### Node.js 与 Express

```typescript
// server.js
import express from 'express';
import { createRefineSQL } from 'refine-d1';

const app = express();
const dataProvider = createRefineSQL('./database.db');

app.get('/api/users', async (req, res) => {
  try {
    const users = await dataProvider.getList({ resource: 'users' });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## ORM 兼容性功能

`refine-d1` 包现在包含增强的 ORM 兼容性功能，提供更现代的开发体验：

### 链式查询构建器

```typescript
import createRefineSQL, {
  type EnhancedDataProvider,
  type TableSchema,
} from 'refine-d1';

// 为类型安全定义您的模式
interface MySchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'inactive';
  };
}

const dataProvider: EnhancedDataProvider<MySchema> =
  createRefineSQL<MySchema>('./database.db');

// 链式查询示例
const activeUsers = await dataProvider
  .from<MySchema['users']>('users')
  .where('status', 'eq', 'active')
  .where('age', 'gte', 18)
  .orderBy('name', 'asc')
  .limit(10)
  .get();

// 聚合查询
const userCount = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .count();
```

### 多态关系

```typescript
// 加载多态关系
const commentsWithRelations = await dataProvider
  .morphTo('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .get();
```

### 类型安全操作

```typescript
// 类型安全创建
const newUser = await dataProvider.createTyped({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active', // TypeScript 确保正确的值
  },
});

// 类型安全查询
const users = await dataProvider.findManyTyped(
  'users',
  { status: 'active' },
  { limit: 10, orderBy: [{ field: 'created_at', order: 'desc' }] }
);
```

有关 ORM 兼容性功能的完整文档，请参阅 [ORM_COMPATIBILITY.md](./ORM_COMPATIBILITY.md)。

## API 参考

### 主要函数

- `createRefineSQL(database, options?)` - 创建 SQL 数据提供器

### 数据提供器方法

- `getList(params)` - 获取分页记录列表
- `getOne(params)` - 通过 ID 获取单个记录
- `getMany(params)` - 通过 ID 获取多个记录
- `create(params)` - 创建新记录
- `createMany(params)` - 创建多个记录
- `update(params)` - 更新现有记录
- `updateMany(params)` - 更新多个记录
- `deleteOne(params)` - 删除单个记录
- `deleteMany(params)` - 删除多个记录

### 增强 ORM 方法

- `from(table)` - 创建链式查询构建器
- `morphTo(table, config)` - 创建多态查询
- `getTyped(params)` - 类型安全获取操作
- `createTyped(params)` - 类型安全创建操作
- `updateTyped(params)` - 类型安全更新操作
- `findTyped(table, conditions)` - 查找单个记录
- `findManyTyped(table, conditions, options)` - 查找多个记录
- `existsTyped(table, conditions)` - 检查记录存在性

### 客户端方法

- `client.query(sql, params?)` - 执行 SELECT 查询
- `client.execute(sql, params?)` - 执行 INSERT/UPDATE/DELETE
- `client.transaction(callback)` - 在事务中执行
- `client.batch(statements)` - 执行批量语句

## 故障排除

### 常见问题

1. **文件未找到错误**

   ```typescript
   // 确保数据库文件存在或使用 :memory:
   const dataProvider = createRefineSQL(':memory:');
   ```

2. **权限错误**

   ```bash
   # 确保进程对数据库文件有写权限
   chmod 666 database.db
   ```

3. **Better-sqlite3 安装问题**
   ```bash
   # 对于 Node.js，确保安装了 better-sqlite3
   npm install better-sqlite3
   ```

## 贡献

我们欢迎贡献！请查看我们的 [贡献指南](../../CONTRIBUTING.md) 了解详情。

## 许可证

MIT © [RefineORM Team](https://github.com/zuohuadong/refine-d1)
