# refine-sqlx v0.5.0 - 功能使用示例

本文档展示如何使用 v0.5.0 中所有新功能的完整示例。

## 目录
- [完整配置示例](#完整配置示例)
- [P2 功能：企业级](#p2-功能企业级)
  - [乐观锁](#1-乐观锁optimistic-locking)
  - [多租户](#2-多租户multi-tenancy)
  - [查询缓存](#3-查询缓存query-caching)
- [P3 功能：开发者体验](#p3-功能开发者体验)
  - [增强日志](#4-增强日志记录)
  - [数据验证](#5-数据验证zod)
- [v0.4.0 功能集成](#v04功能集成)
  - [JSON 字段](#6-json-字段支持)
  - [视图检测](#7-视图检测)
  - [事务管理](#8-事务管理)
  - [关系查询](#9-关系查询)
  - [聚合功能](#10-聚合功能)

---

## 完整配置示例

```typescript
import { createRefineSQL } from 'refine-sqlx';
import { createInsertSchema } from 'drizzle-zod';
import * as schema from './schema';

const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,

  // P2-1: 乐观锁
  optimisticLocking: {
    enabled: true,
    versionField: 'version',
    strategy: 'version', // or 'timestamp'
  },

  // P2-2: 多租户
  multiTenancy: {
    enabled: true,
    tenantField: 'organization_id',
    tenantId: 'org_123',
    strictMode: true,
  },

  // P2-3: 查询缓存
  cache: {
    enabled: true,
    adapter: 'memory', // or custom CacheAdapter
    ttl: 300, // 5 minutes
    maxSize: 1000,
  },

  // P3-1: 增强日志
  logging: {
    enabled: true,
    level: 'info',
    logQueries: true,
    logPerformance: true,
    slowQueryThreshold: 1000,
    onQuery: (event) => {
      console.log(`[${event.duration}ms] ${event.operation}(${event.resource})`);
    },
  },

  // P3-2: 数据验证
  validation: {
    enabled: true,
    schemas: {
      users: {
        insert: createInsertSchema(schema.users),
        update: createInsertSchema(schema.users).partial(),
      },
    },
    throwOnError: true,
  },

  // v0.4.0 功能集成
  features: {
    relations: { enabled: true, maxDepth: 3 },
    aggregations: { enabled: true },
    transactions: { enabled: true, timeout: 5000 },
    json: { enabled: true, strictMode: false },
    views: { enabled: true, strictMode: true },
  },
});
```

---

## P2 功能：企业级

### 1. 乐观锁（Optimistic Locking）

防止并发更新冲突。

#### Schema 设置
```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  version: integer('version').notNull().default(1), // 版本字段
  updated_at: integer('updated_at', { mode: 'timestamp' }),
});
```

#### 使用示例
```typescript
// 1. 读取产品（version = 5）
const { data: product } = await dataProvider.getOne({
  resource: 'products',
  id: 1,
});
// product = { id: 1, name: "Widget", price: 100, version: 5 }

// 2. 更新时包含版本号
try {
  const { data } = await dataProvider.update({
    resource: 'products',
    id: 1,
    variables: { price: 120 },
    meta: {
      version: 5, // 当前版本
    },
  });
  // 成功！返回 { id: 1, name: "Widget", price: 120, version: 6 }
} catch (error) {
  if (error instanceof OptimisticLockError) {
    console.error('有人已经更新了这条记录！');
    console.log('期望版本:', error.expectedVersion); // 5
    console.log('当前版本:', error.currentVersion);   // 6

    // 处理冲突
    const latest = await dataProvider.getOne({ resource: 'products', id: 1 });
    // 显示冲突解决 UI
  }
}
```

#### 时间戳策略
```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  optimisticLocking: {
    enabled: true,
    strategy: 'timestamp',
    timestampField: 'updated_at',
  },
});

await dataProvider.update({
  resource: 'products',
  id: 1,
  variables: { price: 120 },
  meta: { lastUpdated: product.updated_at },
});
```

---

### 2. 多租户（Multi-tenancy）

自动为所有查询添加租户过滤。

#### Schema 设置
```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organization_id: text('organization_id').notNull(), // 租户字段
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organization_id: text('organization_id').notNull(), // 租户字段
  user_id: integer('user_id').notNull(),
  title: text('title').notNull(),
});
```

#### 自动租户过滤
```typescript
// 所有查询自动添加 WHERE organization_id = 'org_123'
const { data, total } = await dataProvider.getList({
  resource: 'users',
  // 自动过滤: WHERE organization_id = 'org_123'
});

const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  // 自动过滤: WHERE id = 1 AND organization_id = 'org_123'
});
```

#### 创建时自动注入租户 ID
```typescript
const { data } = await dataProvider.create({
  resource: 'posts',
  variables: {
    title: 'New Post',
    content: 'Hello',
    // organization_id 自动注入 'org_123'
  },
});
```

#### 动态切换租户
```typescript
// 每个请求覆盖租户
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    tenantId: 'org_456', // 覆盖默认租户
  },
});

// 管理员查询：绕过租户过滤
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    bypassTenancy: true, // 需要管理员权限
  },
});
```

---

### 3. 查询缓存（Query Caching）

减少数据库负载，提升性能。

#### 缓存静态数据
```typescript
const { data } = await dataProvider.getList({
  resource: 'categories',
  meta: {
    cache: {
      enabled: true,
      ttl: 3600, // 缓存 1 小时
      key: 'all-categories', // 自定义缓存键
    },
  },
});
```

#### 禁用动态数据缓存
```typescript
const { data } = await dataProvider.getList({
  resource: 'notifications',
  meta: {
    cache: {
      enabled: false, // 不缓存实时数据
    },
  },
});
```

#### 自动缓存失效
```typescript
// 写操作自动清除缓存
await dataProvider.create({
  resource: 'categories',
  variables: { name: 'New Category' },
  // 自动清除 'categories' 相关缓存
});
```

#### 自定义缓存适配器

使用内置的 Redis 适配器（支持 ioredis 和 redis 包）：

```typescript
import { RedisCacheAdapter } from 'refine-sqlx';
import Redis from 'ioredis';

// 使用 ioredis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  cache: {
    enabled: true,
    adapter: new RedisCacheAdapter({
      client: redis,
    }),
    ttl: 600, // 10 分钟
  },
});
```

使用 redis v4 包：

```typescript
import { createClient } from 'redis';
import { RedisCacheAdapter } from 'refine-sqlx';

const redis = createClient({
  url: 'redis://localhost:6379',
});
await redis.connect();

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  cache: {
    enabled: true,
    adapter: new RedisCacheAdapter({
      client: redis,
    }),
  },
});
```

自定义序列化和错误处理：

```typescript
const adapter = new RedisCacheAdapter({
  client: redis,
  serialization: {
    // 自定义序列化（如使用 MessagePack）
    serialize: (value) => msgpack.encode(value),
    deserialize: (value) => msgpack.decode(Buffer.from(value)),
  },
  errorHandling: {
    silent: false, // 抛出错误而不是静默失败
    onError: (error, operation) => {
      console.error(`Redis ${operation} failed:`, error);
      // 发送到错误监控服务
      Sentry.captureException(error);
    },
  },
});
```

实现自定义缓存适配器：

```typescript
import type { CacheAdapter } from 'refine-sqlx';

class CustomCacheAdapter implements CacheAdapter {
  async get<T>(key: string): Promise<T | null> {
    // 实现获取逻辑
    const value = await yourCacheService.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // 实现设置逻辑（ttl 单位为秒）
    await yourCacheService.set(key, JSON.stringify(value), ttl);
  }

  async delete(pattern: string): Promise<void> {
    // 实现删除逻辑（支持通配符，如 'users:*'）
    const keys = await yourCacheService.keys(pattern);
    if (keys.length > 0) {
      await yourCacheService.delete(...keys);
    }
  }

  async clear(): Promise<void> {
    // 可选：清除所有缓存
    await yourCacheService.flush();
  }
}
```

---

## P3 功能：开发者体验

### 4. 增强日志记录

详细的查询日志和性能监控。

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  logging: {
    enabled: true,
    level: 'debug',
    logQueries: true,
    logPerformance: true,
    slowQueryThreshold: 1000,
    onQuery: (event) => {
      console.log(`[${event.duration}ms] ${event.sql}`);

      // 发送到监控服务
      analytics.track('database_query', {
        resource: event.resource,
        operation: event.operation,
        duration: event.duration,
      });
    },
  },
});
```

#### 日志输出示例
```
[refine-sqlx][INFO] [12ms] getList(users)
[refine-sqlx][DEBUG] SQL: SELECT * FROM users WHERE status = ? LIMIT ? OFFSET ?
[refine-sqlx][DEBUG] Params: ['active', 10, 0]
[refine-sqlx][WARN] Slow query detected: getList(orders) took 1250ms
```

---

### 5. 数据验证（Zod）

自动验证插入和更新数据。

#### Schema 定义
```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email('无效的邮箱格式'),
  name: z.string().min(2, '名称至少 2 个字符'),
  age: z.number().min(0).max(150),
});

export const updateUserSchema = insertUserSchema.partial();
```

#### 配置
```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  validation: {
    enabled: true,
    schemas: {
      users: {
        insert: insertUserSchema,
        update: updateUserSchema,
      },
    },
    throwOnError: true,
  },
});
```

#### 使用
```typescript
try {
  await dataProvider.create({
    resource: 'users',
    variables: {
      name: 'A', // 太短！
      email: 'invalid', // 无效格式！
      age: -5, // 无效值！
    },
  });
} catch (error) {
  console.log(error.issues);
  // [
  //   { path: ['name'], message: '名称至少 2 个字符' },
  //   { path: ['email'], message: '无效的邮箱格式' },
  //   { path: ['age'], message: '必须大于等于 0' }
  // ]
}
```

---

## v0.4.0功能集成

### 6. JSON 字段支持

自动解析和序列化 JSON 字段。

#### Schema
```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name'),
  metadata: text('metadata', { mode: 'json' }), // JSON 字段
  preferences: text('preferences', { mode: 'json' }),
});
```

#### 自动解析
```typescript
const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
});
// data.metadata 自动从 JSON 字符串解析为对象
console.log(data.metadata.theme); // 'dark'
```

#### 自动序列化
```typescript
await dataProvider.create({
  resource: 'users',
  variables: {
    name: 'John',
    metadata: { theme: 'dark', language: 'en' }, // 对象
    // 自动序列化为 JSON 字符串存储
  },
});
```

---

### 7. 视图检测

防止对数据库视图进行写操作。

#### 创建视图
```sql
CREATE VIEW active_users AS
  SELECT * FROM users WHERE status = 'active';
```

#### 自动检测
```typescript
// 读操作：正常工作
const { data } = await dataProvider.getList({
  resource: 'active_users',
});

// 写操作：自动抛出错误
try {
  await dataProvider.create({
    resource: 'active_users',
    variables: { name: 'John' },
  });
} catch (error) {
  console.error('Cannot write to view: active_users');
}
```

---

### 8. 事务管理

执行多个操作在同一个事务中。

```typescript
import type { DataProviderWithTransactions } from 'refine-sqlx';

const provider = dataProvider as DataProviderWithTransactions;

await provider.transaction(async (tx) => {
  // 创建用户
  const user = await tx.create({
    resource: 'users',
    variables: { name: 'John', email: 'john@example.com' },
  });

  // 创建关联文章
  await tx.create({
    resource: 'posts',
    variables: {
      user_id: user.data.id,
      title: 'First Post',
    },
  });

  // 如果任何操作失败，所有操作都会回滚
});
```

---

### 9. 关系查询

通过 `meta.include` 加载关联数据。

```typescript
const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  meta: {
    include: ['posts', 'posts.comments'], // 加载关联
  },
});

// data = {
//   id: 1,
//   name: 'John',
//   posts: [
//     {
//       id: 1,
//       title: 'First Post',
//       comments: [...]
//     }
//   ]
// }
```

---

### 10. 聚合功能

执行聚合查询，支持 GROUP BY 和 HAVING 子句。

#### 基础聚合

```typescript
import type { DataProviderWithAggregations } from 'refine-sqlx';

const provider = dataProvider as DataProviderWithAggregations;

const result = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'total' },
    { type: 'sum', field: 'amount', alias: 'revenue' },
    { type: 'avg', field: 'amount', alias: 'average' },
  ],
  groupBy: ['status'],
  filters: [
    { field: 'created_at', operator: 'gte', value: '2024-01-01' },
  ],
});

// result = {
//   data: [
//     { status: 'completed', total: 150, revenue: 45000, average: 300 },
//     { status: 'pending', total: 25, revenue: 5000, average: 200 },
//   ]
// }
```

#### HAVING 子句过滤

HAVING 子句用于过滤聚合后的结果（在 GROUP BY 之后应用）：

```typescript
// 查找订单数量超过 100 的状态
const result = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'orderCount' },
    { type: 'sum', field: 'amount', alias: 'totalRevenue' },
  ],
  groupBy: ['status'],
  having: [
    { field: 'orderCount', operator: 'gt', value: 100 }, // HAVING orderCount > 100
  ],
});

// result = {
//   data: [
//     { status: 'completed', orderCount: 150, totalRevenue: 45000 },
//   ]
// }
```

#### 多个 HAVING 条件（AND）

```typescript
// 查找订单数量 > 50 且总收入 >= 10000 的地区
const result = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'orders' },
    { type: 'sum', field: 'amount', alias: 'revenue' },
  ],
  groupBy: ['region'],
  having: [
    { field: 'orders', operator: 'gt', value: 50 },
    { field: 'revenue', operator: 'gte', value: 10000 },
  ],
});
```

#### HAVING with OR 逻辑

```typescript
// 查找高价值客户：订单数 = 1（新客户）或总消费 >= 5000（VIP）
const result = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'orderCount' },
    { type: 'sum', field: 'amount', alias: 'totalSpent' },
  ],
  groupBy: ['customerId'],
  having: [
    {
      operator: 'or',
      conditions: [
        { field: 'orderCount', operator: 'eq', value: 1 },
        { field: 'totalSpent', operator: 'gte', value: 5000 },
      ],
    },
  ],
});
```

#### HAVING 操作符

支持的操作符：
- `eq` / `ne` - 等于 / 不等于
- `lt` / `lte` - 小于 / 小于等于
- `gt` / `gte` - 大于 / 大于等于
- `between` / `nbetween` - 在范围内 / 不在范围内

```typescript
// BETWEEN 示例
const result = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'avg', field: 'amount', alias: 'avgAmount' },
  ],
  groupBy: ['region'],
  having: [
    { field: 'avgAmount', operator: 'between', value: [100, 500] },
  ],
});
```

#### 实际应用场景

**查找高价值客户**：
```typescript
// 平均订单价值 > 200 的客户
const highValueCustomers = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'orderCount' },
    { type: 'avg', field: 'amount', alias: 'avgOrderValue' },
    { type: 'sum', field: 'amount', alias: 'totalRevenue' },
  ],
  filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
  groupBy: ['customerId'],
  having: [{ field: 'avgOrderValue', operator: 'gt', value: 200 }],
});
```

**查找热门商品**：
```typescript
// 销售数量 >= 100 的商品
const popularProducts = await provider.aggregate({
  resource: 'order_items',
  functions: [
    { type: 'count', alias: 'salesCount' },
    { type: 'sum', field: 'quantity', alias: 'totalQuantity' },
  ],
  groupBy: ['productId'],
  having: [{ field: 'salesCount', operator: 'gte', value: 100 }],
});
```

**查找profitable regions**：
```typescript
// 总收入 > 10000 且订单数 >= 50 的地区
const profitableRegions = await provider.aggregate({
  resource: 'orders',
  functions: [
    { type: 'count', alias: 'orderCount' },
    { type: 'sum', field: 'amount', alias: 'totalRevenue' },
  ],
  filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
  groupBy: ['region'],
  having: [
    { field: 'totalRevenue', operator: 'gt', value: 10000 },
    { field: 'orderCount', operator: 'gte', value: 50 },
  ],
});
```

---

## 组合使用示例

将多个功能组合使用以实现复杂场景。

### SaaS 应用场景
```typescript
// 配置：多租户 + 乐观锁 + 缓存 + 验证
const dataProvider = await createRefineSQL({
  connection: db,
  schema,

  multiTenancy: {
    enabled: true,
    tenantField: 'organization_id',
    tenantId: getCurrentOrgId(),
  },

  optimisticLocking: {
    enabled: true,
    versionField: 'version',
  },

  cache: {
    enabled: true,
    ttl: 300,
  },

  validation: {
    enabled: true,
    schemas: validationSchemas,
  },

  logging: {
    enabled: true,
    level: 'info',
  },

  features: {
    relations: { enabled: true },
    transactions: { enabled: true },
    json: { enabled: true },
  },
});

// 使用
await dataProvider.transaction(async (tx) => {
  // 1. 更新订单（带乐观锁 + 多租户过滤）
  const order = await tx.update({
    resource: 'orders',
    id: 1,
    variables: { status: 'completed' },
    meta: { version: 5 },
  });

  // 2. 创建发票（自动注入租户 ID + JSON 序列化）
  await tx.create({
    resource: 'invoices',
    variables: {
      order_id: 1,
      metadata: { paymentMethod: 'credit_card' },
    },
  });
});
```

---

## 类型安全

利用 TypeScript 获得完整类型推断。

```typescript
import type {
  DataProviderWithTransactions,
  DataProviderWithAggregations,
  InferSelectModel,
} from 'refine-sqlx';
import { users } from './schema';

// 类型推断
type User = InferSelectModel<typeof users>;

// 扩展 DataProvider 类型
const typedProvider = dataProvider as DataProviderWithTransactions &
  DataProviderWithAggregations;

// 完整类型安全
await typedProvider.transaction(async (tx) => {
  const user: User = await tx.create({
    resource: 'users',
    variables: {
      name: 'John',
      email: 'john@example.com',
    },
  });
});

const result = await typedProvider.aggregate<User>({
  resource: 'users',
  functions: [{ type: 'count', alias: 'total' }],
});
```

---

## 迁移指南

从 v0.3.x 迁移到 v0.5.0

### 1. 更新配置
```typescript
// 旧版 (v0.3.x)
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
});

// 新版 (v0.5.0) - 添加新功能
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  multiTenancy: { enabled: true, tenantId: 'org_123' },
  optimisticLocking: { enabled: true },
  cache: { enabled: true },
  features: {
    relations: { enabled: true },
    transactions: { enabled: true },
  },
});
```

### 2. 使用扩展功能
```typescript
// 导入扩展类型
import type {
  DataProviderWithTransactions,
  DataProviderWithAggregations,
} from 'refine-sqlx';

// 类型断言
const provider = dataProvider as DataProviderWithTransactions;

// 使用事务
await provider.transaction(async (tx) => {
  // ...
});
```

---

## 最佳实践

1. **启用需要的功能**：只启用实际使用的功能以获得最佳性能
2. **使用类型推断**：利用 TypeScript 类型获得编译时安全
3. **缓存策略**：为静态数据启用缓存，为实时数据禁用缓存
4. **多租户严格模式**：在生产环境启用 `strictMode: true`
5. **日志级别**：开发环境使用 `debug`，生产环境使用 `info` 或 `warn`
6. **验证模式**：为所有用户输入启用数据验证

---

## 故障排除

### 乐观锁冲突
```typescript
try {
  await dataProvider.update({ ... });
} catch (error) {
  if (error instanceof OptimisticLockError) {
    // 重新获取最新数据
    const latest = await dataProvider.getOne({ ... });
    // 提示用户重试或合并更改
  }
}
```

### 多租户字段缺失
```typescript
// 错误: Table "users" missing tenant field: organization_id
// 解决: 添加租户字段到表或禁用严格模式
multiTenancy: {
  strictMode: false, // 允许部分表没有租户字段
}
```

### 缓存未失效
```typescript
// 手动清除缓存
await cacheManager.invalidate('users');
// 或清除特定模式
await cacheManager.invalidatePattern('users:*');
```

---

## 更多资源

- [完整 API 文档](../API.md)
- [Schema 设计指南](../SCHEMA_DESIGN.md)
- [性能优化](../PERFORMANCE.md)
- [安全最佳实践](../SECURITY.md)

---

**版本**: v0.5.0
**更新日期**: 2025-01-16
