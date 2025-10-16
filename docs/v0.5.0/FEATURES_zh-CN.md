# Refine SQLx v0.5.0 - 企业级与开发者体验

**状态**: 已计划
**目标发布**: 2025年第二/三季度
**Refine 版本**: 5.0+

## 概述

版本 0.5.0 专注于企业级功能（P2）和开发者体验改进（P3），使 refine-sqlx 为大规模应用的生产环境做好准备。

---

## 优先级 P1 - 核心集成

### 0. 将功能模块集成到 DataProvider 中

**状态**: 📋 计划在 v0.5.0 实现

将 v0.4.0 中的所有功能模块（关系查询、聚合、事务、JSON 支持）整合到主 DataProvider 实现中。

#### 当前状态

目前，v0.4.0 的功能作为独立模块实现：
- `src/relations/` - 关系查询支持
- `src/aggregations/` - 聚合函数
- `src/transactions/` - 事务管理
- `src/json/` - JSON 字段支持
- `src/views/` - 数据库视图支持

#### 目标架构

所有功能应集成到主 DataProvider 中：

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  features: {
    relations: { enabled: true, maxDepth: 3 },
    aggregations: { enabled: true },
    transactions: { enabled: true, isolationLevel: 'serializable' },
    json: { enabled: true },
    views: { enabled: true },
  },
});
```

#### 实现任务

1. **合并查询构建器**：将关系和聚合查询构建器整合到核心 getList/getOne 中
2. **事务集成**：使事务支持成为 DataProvider 的一等功能
3. **JSON 字段处理**：自动检测和处理 schema 中的 JSON 列
4. **视图检测**：自动检测 schema 中的视图与表
5. **统一配置**：所有功能的单一配置接口

#### 优势

- 更简单的 API 接口
- 更好的功能可发现性
- 统一的错误处理
- 改进的性能（更少的抽象层）
- 更容易的测试和维护

---

## 优先级 P2 - 企业级功能

### 1. 乐观锁（并发控制）

**状态**: 📋 计划在 v0.5.0 实现

在并发环境中使用基于版本的乐观锁防止更新丢失。

#### Schema 设置

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull(),
  version: integer('version').notNull().default(1), // 乐观锁的版本字段
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

#### 配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  optimisticLocking: {
    enabled: true,
    versionField: 'version', // 默认字段名
    strategy: 'version', // 或 'timestamp'
  },
});
```

#### 使用示例

**带版本检查的更新**:

```typescript
// 用户 A 读取产品（version = 5）
const { data: product } = await dataProvider.getOne({
  resource: 'products',
  id: 1,
});
// product = { id: 1, name: "Widget", price: 100, version: 5 }

// 用户 A 尝试更新
const { data } = await dataProvider.update({
  resource: 'products',
  id: 1,
  variables: { price: 120 },
  meta: {
    version: 5, // 包含当前版本
  },
});

// 成功！返回更新后的记录，version = 6
```

**冲突检测**:

```typescript
// 用户 B 在用户 A 编辑时更新了同一产品
// 版本从 5 变为 6

// 用户 A 的更新尝试（仍使用版本 5）
try {
  await dataProvider.update({
    resource: 'products',
    id: 1,
    variables: { price: 120 },
    meta: {
      version: 5, // 过期版本！
    },
  });
} catch (error) {
  // 抛出 OptimisticLockError
  console.error('检测到冲突！其他人更新了此记录。');
  console.log(error.currentVersion); // 6
  console.log(error.expectedVersion); // 5

  // 处理冲突：重新获取、合并或询问用户
  const latest = await dataProvider.getOne({ resource: 'products', id: 1 });
  // 显示冲突解决 UI
}
```

**基于时间戳的锁定**（替代方案）:

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
  meta: { lastUpdated: new Date('2024-01-15T10:30:00Z') },
});
```

#### 实现

```typescript
import { OptimisticLockError } from './errors';

async function update<T extends BaseRecord = BaseRecord>(
  params: UpdateParams,
): Promise<UpdateResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';
  const versionField = config.optimisticLocking?.versionField ?? 'version';

  if (config.optimisticLocking?.enabled && params.meta?.version !== undefined) {
    // 使用版本检查构建更新
    const [result] = await db
      .update(table)
      .set({
        ...params.variables,
        [versionField]: sql`${table[versionField]} + 1`, // 增加版本
      } as any)
      .where(
        and(
          eq(table[idColumn], params.id),
          eq(table[versionField], params.meta.version), // 版本检查
        ),
      )
      .returning();

    if (!result) {
      // 版本不匹配 - 获取当前版本
      const [current] = await db
        .select({ version: table[versionField] })
        .from(table)
        .where(eq(table[idColumn], params.id));

      throw new OptimisticLockError(
        params.resource,
        params.id,
        params.meta.version,
        current?.version,
      );
    }

    return { data: result as T };
  }

  // 不带版本检查的标准更新
  // ... 现有实现
}
```

**错误处理**:

```typescript
export class OptimisticLockError extends RefineSQLError {
  constructor(
    resource: string,
    id: BaseKey,
    expectedVersion: number,
    currentVersion?: number,
  ) {
    super(
      `乐观锁冲突：${resource}#${id} ` +
        `(期望版本 ${expectedVersion}，当前版本 ${currentVersion})`,
    );
    this.name = 'OptimisticLockError';
  }
}
```

**优势**:

- 在并发环境中防止更新丢失
- 比悲观锁更好（无数据库锁定）
- 与 Refine 的 useForm 乐观更新配合良好
- 行业标准模式

---

### 2. 实时查询/实时订阅

**状态**: 📋 计划在 v0.5.0 实现

使用 Refine 的实时提供者接口启用实时数据更新。

#### 配置

```typescript
import { createRefineSQL } from 'refine-sqlx';

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  liveMode: {
    enabled: true,
    strategy: 'polling', // 或 'websocket'（仅 Bun/Node）
    pollingInterval: 5000, // 5秒
  },
});

// WebSocket 支持（Bun/Node.js）
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  liveMode: { enabled: true, strategy: 'websocket', port: 3001 },
});
```

#### 与 Refine Hooks 一起使用

```typescript
import { useList } from '@refinedev/core';

function NotificationsList() {
  const { data, isLoading } = useList({
    resource: 'notifications',
    liveMode: 'auto', // 启用实时更新
  });

  // 数据库更改时数据自动更新
  return (
    <ul>
      {data?.data.map(notification => (
        <li key={notification.id}>{notification.message}</li>
      ))}
    </ul>
  );
}
```

#### 实现策略

**策略 1：轮询**（所有平台）:

```typescript
// 自动后台轮询
setInterval(async () => {
  const latestData = await db.select().from(table).where(updatedSince);
  if (hasChanges(latestData)) {
    notifySubscribers(latestData);
  }
}, config.liveMode.pollingInterval);
```

**策略 2：WebSocket**（Bun/Node.js）:

```typescript
import { Server } from 'bun';

// 使用 SQLite 触发器监视数据库更改
const watcher = db.prepare(`
  CREATE TRIGGER IF NOT EXISTS notify_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  BEGIN
    SELECT notify_websocket(NEW.id, 'users', TG_OP);
  END
`);

// 广播到 WebSocket 客户端
websocketServer.publish('users', {
  type: 'UPDATE',
  resource: 'users',
  ids: [1, 2, 3],
});
```

**策略 3：Cloudflare D1**（有限支持）:

```typescript
// D1 原生不支持实时查询
// 回退到轮询或外部 pub/sub（Durable Objects、Queue）

const dataProvider = await createRefineSQL({
  connection: env.DB,
  schema,
  liveMode: {
    enabled: true,
    strategy: 'durable-objects',
    durableObjectNamespace: env.LIVE_UPDATES,
  },
});
```

#### Live Provider 接口

```typescript
import { LiveProvider } from '@refinedev/core';

export const liveProvider: LiveProvider = {
  subscribe: ({ channel, types, callback }) => {
    const subscription = eventEmitter.on(channel, (event) => {
      if (types.includes(event.type)) {
        callback(event);
      }
    });

    return () => subscription.off();
  },

  unsubscribe: (subscription) => {
    subscription();
  },

  publish: ({ channel, type, payload }) => {
    eventEmitter.emit(channel, { type, payload, date: new Date() });
  },
};
```

**优势**:

- 无需手动刷新的实时 UI 更新
- 协作应用的更好用户体验
- Refine 的内置实时提供者支持
- 多种实现策略

**限制**:

- Cloudflare D1：无原生支持（需要变通方法）
- 轮询：更高的数据库负载
- WebSocket：额外的基础设施

---

### 3. 多租户/行级安全

**状态**: 📋 计划在 v0.5.0 实现

为 SaaS 应用自动将所有查询限定到特定租户。

#### 配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  multiTenancy: {
    enabled: true,
    tenantField: 'organization_id', // 所有表中的字段名
    tenantId: 'org_123', // 当前租户 ID
    strictMode: true, // 如果缺少 tenantField 则抛出错误
  },
});
```

#### Schema 设置

```typescript
// 所有表必须包含租户字段
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

#### 自动租户范围

```typescript
// 所有查询自动包含租户过滤
const { data, total } = await dataProvider.getList({
  resource: 'users',
  // 自动添加：WHERE organization_id = 'org_123'
});

const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  // 自动添加：WHERE id = 1 AND organization_id = 'org_123'
});

const { data } = await dataProvider.create({
  resource: 'posts',
  variables: {
    title: 'New Post',
    content: 'Hello world',
    // organization_id 自动注入
  },
});
```

#### 动态租户切换

```typescript
// 每个请求切换租户
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    tenantId: 'org_456', // 覆盖默认租户
  },
});

// 禁用租户范围（管理员查询）
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    bypassTenancy: true, // 需要管理员权限
  },
});
```

#### 实现

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);
  const tenantField = config.multiTenancy?.tenantField;
  const tenantId = params.meta?.tenantId ?? config.multiTenancy?.tenantId;

  const query = db.select().from(table).$dynamic();

  // 应用租户过滤
  if (config.multiTenancy?.enabled && !params.meta?.bypassTenancy) {
    if (!tenantId) {
      throw new Error('多租户模式下需要租户 ID');
    }

    if (!(tenantField in table)) {
      if (config.multiTenancy.strictMode) {
        throw new Error(
          `表 ${params.resource} 缺少租户字段：${tenantField}`,
        );
      }
    } else {
      query.where(eq(table[tenantField], tenantId));
    }
  }

  // 应用用户过滤
  const where = filtersToWhere(params.filters, table);
  if (where) query.where(where);

  // ... 其余实现
}

async function create<T extends BaseRecord = BaseRecord>(
  params: CreateParams,
): Promise<CreateResponse<T>> {
  const table = getTable(params.resource);
  const tenantField = config.multiTenancy?.tenantField;
  const tenantId = config.multiTenancy?.tenantId;

  // 自动注入租户 ID
  const dataWithTenant = {
    ...params.variables,
    ...(config.multiTenancy?.enabled && tenantId ?
      { [tenantField]: tenantId }
    : {}),
  };

  const [result] = await db
    .insert(table)
    .values(dataWithTenant as any)
    .returning();

  return { data: result as T };
}
```

**优势**:

- 每个租户的数据隔离
- 防止数据泄漏
- 简化应用逻辑
- SaaS 平台必备

**安全考虑**:

- 始终验证来自经过身份验证的用户的租户 ID
- 切勿信任来自客户端输入的租户 ID
- 如果可用，使用数据库级 RLS（PostgreSQL）

---

### 4. 查询缓存

**状态**: 📋 计划在 v0.5.0 实现

通过缓存频繁访问的数据来减少数据库负载。

#### 配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  cache: {
    enabled: true,
    adapter: 'memory', // 或 'redis'、'cloudflare-kv'
    ttl: 300, // 默认 TTL（秒）
    maxSize: 1000, // 最大缓存项（内存适配器）
  },
});
```

#### 使用示例

**缓存静态数据**:

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

**禁用动态数据缓存**:

```typescript
const { data } = await dataProvider.getList({
  resource: 'notifications',
  meta: {
    cache: {
      enabled: false, // 不缓存
    },
  },
});
```

**缓存失效**:

```typescript
// 写操作时自动失效
await dataProvider.create({
  resource: 'categories',
  variables: { name: 'New Category' },
  // 自动清除 'categories' 缓存
});

// 手动失效
await dataProvider.custom({
  url: 'cache/invalidate',
  method: 'post',
  payload: {
    resource: 'categories',
    pattern: 'categories:*', // 清除所有分类缓存
  },
});
```

#### 缓存适配器

**内存适配器**（默认）:

```typescript
class MemoryCacheAdapter {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.data;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.cache.set(key, { data: value, expiresAt: Date.now() + ttl * 1000 });
  }

  async delete(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Cloudflare KV 适配器**:

```typescript
class CloudflareKVAdapter {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
  }

  async delete(pattern: string): Promise<void> {
    const list = await this.kv.list({ prefix: pattern.replace('*', '') });
    await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
  }
}
```

**实现**:

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const cacheConfig = params.meta?.cache ?? config.cache;

  if (cacheConfig?.enabled) {
    const cacheKey = generateCacheKey('getList', params);
    const cached = await cacheAdapter.get<GetListResponse<T>>(cacheKey);

    if (cached) {
      return cached; // 返回缓存结果
    }
  }

  // 执行查询
  const result = await executeGetListQuery(params);

  // 缓存结果
  if (cacheConfig?.enabled) {
    const cacheKey = generateCacheKey('getList', params);
    await cacheAdapter.set(cacheKey, result, cacheConfig.ttl);
  }

  return result;
}
```

**优势**:

- 减少数据库负载
- 更快的响应时间
- 节省成本（特别是 D1）
- 可按资源配置

---

## 优先级 P3 - 开发者体验

### 5. TypeScript Schema 生成器

**状态**: 📋 计划在 v0.5.0 实现

自动为 Refine 资源生成 TypeScript 类型。

#### CLI 命令

```bash
# 从 Drizzle schema 生成类型
refine-sqlx generate-types

# 带选项
refine-sqlx generate-types \
  --schema ./src/schema.ts \
  --output ./src/types/resources.ts \
  --format refine
```

#### 生成输出

```typescript
// src/types/resources.generated.ts
import type { BaseRecord } from '@refinedev/core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import * as schema from '../schema';

// 资源类型
export interface User extends BaseRecord {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  created_at: Date;
}

export interface Post extends BaseRecord {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  published_at: Date | null;
}

// 插入类型（用于创建操作）
export type UserInsert = InferInsertModel<typeof schema.users>;
export type PostInsert = InferInsertModel<typeof schema.posts>;

// 资源名称类型
export type ResourceName = 'users' | 'posts';

// 资源映射
export interface ResourceMap {
  users: User;
  posts: Post;
}

// 类型安全资源助手
export function getResourceType<T extends ResourceName>(
  resource: T,
): ResourceMap[T] {
  return null as any;
}
```

#### 在应用中使用

```typescript
import { useList, useCreate } from '@refinedev/core';
import type { User, UserInsert } from './types/resources.generated';

function UsersList() {
  // 完全类型化
  const { data } = useList<User>({
    resource: 'users',
  });

  const { mutate } = useCreate<User, {}, UserInsert>();

  const handleCreate = () => {
    mutate({
      resource: 'users',
      values: {
        name: 'John',
        email: 'john@example.com',
        status: 'active', // 类型安全枚举
        created_at: new Date(),
      }
    });
  };

  return <div>{/* ... */}</div>;
}
```

---

### 6. 数据验证集成

**状态**: 📋 计划在 v0.5.0 实现

与 Zod 或 Drizzle 的验证集成以实现类型安全的数据操作。

#### 带验证的 Schema

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

// 从 Drizzle 生成 Zod schema
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email('无效的电子邮件格式'),
  name: z.string().min(2, '名称至少需要 2 个字符'),
  status: z.enum(['active', 'inactive']),
});

export const selectUserSchema = createSelectSchema(users);
```

#### 带验证的使用

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  validation: {
    enabled: true,
    schemas: {
      users: { insert: insertUserSchema, update: insertUserSchema.partial() },
    },
    throwOnError: true,
  },
});

// 自动验证
try {
  await dataProvider.create({
    resource: 'users',
    variables: {
      name: 'A', // 太短！
      email: 'invalid-email', // 无效格式！
      status: 'active',
    },
  });
} catch (error) {
  // ValidationError 包含详细消息
  console.log(error.issues);
  // [
  //   { path: ['name'], message: '名称至少需要 2 个字符' },
  //   { path: ['email'], message: '无效的电子邮件格式' }
  // ]
}
```

---

### 7. 增强的日志记录和调试

**状态**: 📋 计划在 v0.5.0 实现

详细的日志记录和性能监控。

#### 配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  logging: {
    enabled: true,
    level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
    logQueries: true,
    logPerformance: true,
    slowQueryThreshold: 1000, // 记录 > 1s 的查询
    onQuery: (event) => {
      console.log(`[${event.duration}ms] ${event.sql}`);
      console.log('参数:', event.params);

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

#### 日志输出

```
[DEBUG] [12ms] getList(users) - 过滤器: status=active, 分页: 1-10
[DEBUG] SQL: SELECT * FROM users WHERE status = ? LIMIT ? OFFSET ?
[DEBUG] 参数: ['active', 10, 0]
[INFO] 查询在 12ms 内完成
[WARN] 检测到慢查询: getList(orders) 耗时 1250ms
```

---

### 8. 迁移管理

**状态**: 📋 计划在 v0.5.0 实现

集成的数据库迁移工具。

```bash
# 创建迁移
refine-sqlx migrate create add_users_table

# 应用迁移
refine-sqlx migrate up

# 回滚
refine-sqlx migrate rollback

# 状态
refine-sqlx migrate status
```

---

## 开发路线图

| 功能             | 优先级 | 目标日期  | 依赖项                 |
| ---------------- | ------ | --------- | ---------------------- |
| 功能模块集成     | P1     | 2025年Q1  | v0.4.0 完成            |
| 乐观锁           | P2     | 2025年Q2  | 无                     |
| 实时查询         | P2     | 2025年Q2  | WebSocket 基础设施     |
| 多租户           | P2     | 2025年Q2  | 无                     |
| 查询缓存         | P2     | 2025年Q2  | 缓存适配器             |
| 类型生成器       | P3     | 2025年Q3  | CLI 框架               |
| 验证             | P3     | 2025年Q3  | Zod 集成               |
| 增强日志         | P3     | 2025年Q3  | 无                     |
| 迁移工具         | P3     | 2025年Q3  | Drizzle Kit            |

---

## 破坏性变更

**计划最小破坏性变更：**

1. **配置结构** 可能为了清晰而重组
2. **错误类** 可能为了更好的类型安全而重构
3. **v0.4.0 的废弃方法** 可能被移除

发布前将提供迁移指南。

---

## 贡献

v0.5.0 的优先贡献：

1. **缓存适配器** - Redis、Cloudflare KV 实现
2. **实时查询策略** - WebSocket、轮询优化
3. **多租户** - 跨不同租户场景的测试
4. **文档** - 企业部署指南

查看 [CONTRIBUTING.md](../../CONTRIBUTING.md) 获取指南。

---

**最后更新**: 2025-01-15
**维护者**: Refine SQLx Team
