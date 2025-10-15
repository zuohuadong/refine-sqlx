# Refine SQLx v0.4.0 - 功能路线图

**状态**: 已计划
**目标发布**: 2025年第一季度
**Refine 版本**: 5.0+

## 概述

版本 0.4.0 专注于核心缺失功能（P0）和重要增强功能（P1），使 refine-sqlx 成为一个完整且可用于生产环境的 Refine 5.0 数据提供者。

---

## 优先级 P0 - 核心缺失功能

### 1. ✅ getApiUrl() 方法

**状态**: ✅ 已在 v0.3.2 完成

`getApiUrl()` 方法现已在所有数据提供者中实现。

```typescript
const dataProvider = await createRefineSQL({ connection: db, schema });

// 对于 SQL 数据库返回空字符串（没有 REST API 端点）
console.log(dataProvider.getApiUrl()); // ""
```

**实现细节**:

- 返回空字符串，因为 SQL 数据库没有传统的 API URL
- Refine 5.0 DataProvider 接口所需
- 在所有实现中可用（provider.ts、d1.ts、data-provider.ts）

---

### 2. custom() 方法 ⭐

**状态**: 🚧 计划在 v0.4.0 实现

执行自定义 SQL 查询或超出标准 CRUD 的复杂数据库操作。

#### API 设计

```typescript
interface CustomParams {
  url: string;
  method: "get" | "delete" | "head" | "options" | "post" | "put" | "patch";
  payload?: {
    sql: string;
    args?: any[];
  };
  query?: Record<string, any>;
  headers?: Record<string, string>;
}

interface CustomResponse<T = any> {
  data: T;
}

// DataProvider 签名
custom?: <T = any>(params: CustomParams) => Promise<CustomResponse<T>>;
```

#### 使用示例

**基础原始 SQL 查询**:

```typescript
const result = await dataProvider.custom<User[]>({
  url: 'query',
  method: 'post',
  payload: {
    sql: 'SELECT * FROM users WHERE created_at > ?',
    args: [new Date('2024-01-01')],
  },
});
```

**复杂聚合**:

```typescript
const stats = await dataProvider.custom<{ total: number; avg: number }>({
  url: 'query',
  method: 'post',
  payload: {
    sql: `
      SELECT
        COUNT(*) as total,
        AVG(order_value) as avg
      FROM orders
      WHERE status = ?
      GROUP BY user_id
    `,
    args: ['completed'],
  },
});
```

**执行语句（INSERT/UPDATE/DELETE）**:

```typescript
const result = await dataProvider.custom({
  url: 'execute',
  method: 'post',
  payload: {
    sql: 'UPDATE users SET last_login = ? WHERE id = ?',
    args: [new Date(), 123],
  },
});
```

**Drizzle ORM 集成**:

```typescript
import { sql } from 'drizzle-orm';

const result = await dataProvider.custom({
  url: 'drizzle',
  method: 'post',
  payload: {
    query: db
      .select()
      .from(users)
      .where(sql`json_extract(metadata, '$.premium') = true`),
  },
});
```

#### 实现计划

```typescript
// src/provider.ts
async function custom<T = any>(
  params: CustomParams,
): Promise<CustomResponse<T>> {
  const { url, payload } = params;

  if (url === 'query' && payload?.sql) {
    // 执行 SELECT 查询
    const result = await db.execute(
      sql.raw(payload.sql, ...(payload.args || [])),
    );
    return { data: result.rows as T };
  }

  if (url === 'execute' && payload?.sql) {
    // 执行 INSERT/UPDATE/DELETE
    const result = await db.execute(
      sql.raw(payload.sql, ...(payload.args || [])),
    );
    return { data: result as T };
  }

  if (url === 'drizzle' && payload?.query) {
    // 执行 Drizzle 查询构造器
    const result = await payload.query;
    return { data: result as T };
  }

  throw new UnsupportedOperatorError(`不支持的自定义操作: ${url}`);
}
```

**优势**:

- 支持超越 CRUD 的复杂查询
- 访问完整的 SQL 能力
- 与 Drizzle 查询构造器集成
- 对于实际应用至关重要

---

## 优先级 P1 - 增强功能

### 3. 嵌套关系加载

**状态**: 🚧 计划在 v0.4.0 实现

利用 Drizzle ORM 的关系查询 API 在单个查询中加载嵌套数据。

#### Schema 定义

```typescript
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id),
  content: text('content').notNull(),
});

// 定义关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
}));
```

#### 使用示例

**基础关系加载**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: true, // 加载所有帖子
    },
  },
});

// 结果:
// {
//   id: 1,
//   name: "John Doe",
//   email: "john@example.com",
//   posts: [
//     { id: 1, title: "Post 1", content: "..." },
//     { id: 2, title: "Post 2", content: "..." }
//   ]
// }
```

**嵌套关系**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: {
        include: {
          comments: true, // 为每个帖子加载评论
        },
      },
    },
  },
});
```

**选择性字段加载**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: {
        select: {
          id: true,
          title: true,
          // 排除 content 字段
        },
      },
    },
  },
});
```

**带关系的列表查询**:

```typescript
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  meta: { include: { posts: true } },
});
```

#### 实现

```typescript
async function getOne<T extends BaseRecord = BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';

  // 检查是否请求关系
  if (params.meta?.include) {
    const [data] = await db.query[params.resource].findMany({
      where: eq(table[idColumn], params.id),
      with: params.meta.include,
    });

    if (!data) throw new RecordNotFoundError(params.resource, params.id);
    return { data: data as T };
  }

  // 不带关系的标准查询
  const [data] = await db
    .select()
    .from(table)
    .where(eq(table[idColumn], params.id));

  if (!data) throw new RecordNotFoundError(params.resource, params.id);
  return { data: data as T };
}
```

---

### 4. 聚合查询支持

**状态**: 🚧 计划在 v0.4.0 实现

使用内置聚合函数执行统计分析和报告。

#### API 设计

```typescript
interface AggregationMeta {
  aggregations?: {
    [key: string]: {
      sum?: string;
      avg?: string;
      count?: string;
      min?: string;
      max?: string;
    };
  };
  groupBy?: string[];
}
```

#### 使用示例

**基础聚合**:

```typescript
const result = await dataProvider.getList<OrderStats>({
  resource: 'orders',
  meta: {
    aggregations: {
      totalRevenue: { sum: 'amount' },
      avgOrderValue: { avg: 'amount' },
      orderCount: { count: '*' },
      minOrder: { min: 'amount' },
      maxOrder: { max: 'amount' },
    },
  },
});

// 结果:
// {
//   data: [{
//     totalRevenue: 45000,
//     avgOrderValue: 150,
//     orderCount: 300,
//     minOrder: 10,
//     maxOrder: 999
//   }],
//   total: 1
// }
```

**分组查询**:

```typescript
const result = await dataProvider.getList<OrderStatsByStatus>({
  resource: 'orders',
  meta: {
    aggregations: { total: { count: '*' }, revenue: { sum: 'amount' } },
    groupBy: ['status', 'created_at'],
  },
});

// 结果:
// {
//   data: [
//     { status: 'completed', created_at: '2024-01', total: 150, revenue: 22500 },
//     { status: 'pending', created_at: '2024-01', total: 50, revenue: 7500 },
//     { status: 'completed', created_at: '2024-02', total: 200, revenue: 30000 }
//   ],
//   total: 3
// }
```

**带过滤条件**:

```typescript
const result = await dataProvider.getList<OrderStats>({
  resource: 'orders',
  filters: [
    { field: 'status', operator: 'eq', value: 'completed' },
    { field: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
  ],
  meta: {
    aggregations: {
      totalRevenue: { sum: 'amount' },
      orderCount: { count: '*' },
    },
    groupBy: ['user_id'],
  },
});
```

#### 实现

```typescript
import { avg, count, max, min, sql, sum } from 'drizzle-orm';

async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);

  // 检查是否请求聚合
  if (params.meta?.aggregations) {
    const aggregations: Record<string, any> = {};

    // 构建聚合选择
    for (const [key, agg] of Object.entries(params.meta.aggregations)) {
      if (agg.sum) aggregations[key] = sum(table[agg.sum]);
      if (agg.avg) aggregations[key] = avg(table[agg.avg]);
      if (agg.count)
        aggregations[key] = count(
          agg.count === '*' ? undefined : table[agg.count],
        );
      if (agg.min) aggregations[key] = min(table[agg.min]);
      if (agg.max) aggregations[key] = max(table[agg.max]);
    }

    const query = db.select(aggregations).from(table).$dynamic();

    // 应用过滤条件
    const where = filtersToWhere(params.filters, table);
    if (where) query.where(where);

    // 应用 groupBy
    if (params.meta.groupBy) {
      const groupByColumns = params.meta.groupBy.map((field) => table[field]);
      query.groupBy(...groupByColumns);
    }

    const data = await query;
    return { data: data as T[], total: data.length };
  }

  // 不带聚合的标准查询
  // ... 现有实现
}
```

---

### 5. 字段选择（Select/投影）

**状态**: 🚧 计划在 v0.4.0 实现

通过仅选择所需的字段来优化性能。

#### 使用示例

**选择特定字段**:

```typescript
const { data } = await dataProvider.getList<User>({
  resource: 'users',
  meta: {
    select: ['id', 'name', 'email'], // 仅获取这些字段
  },
});

// 结果:
// [
//   { id: 1, name: "John", email: "john@example.com" },
//   { id: 2, name: "Jane", email: "jane@example.com" }
// ]
// 注意：没有其他字段如 created_at、updated_at 等
```

**排除字段**:

```typescript
const { data } = await dataProvider.getList<User>({
  resource: 'users',
  meta: {
    exclude: ['password', 'secret_token'], // 排除敏感字段
  },
});
```

**结合关系使用**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    select: ['id', 'name'],
    include: {
      posts: {
        select: ['id', 'title'], // 仅获取帖子 ID 和标题
      },
    },
  },
});
```

#### 实现

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);

  let query;

  // 使用特定字段构建 select
  if (params.meta?.select) {
    const selectFields = params.meta.select.reduce(
      (acc, field) => {
        acc[field] = table[field];
        return acc;
      },
      {} as Record<string, any>,
    );

    query = db.select(selectFields).from(table).$dynamic();
  } else if (params.meta?.exclude) {
    // 获取除排除字段外的所有列
    const allColumns = Object.keys(table).filter(
      (key) => !params.meta.exclude.includes(key),
    );
    const selectFields = allColumns.reduce(
      (acc, field) => {
        acc[field] = table[field];
        return acc;
      },
      {} as Record<string, any>,
    );

    query = db.select(selectFields).from(table).$dynamic();
  } else {
    query = db.select().from(table).$dynamic();
  }

  // ... 其余实现（过滤、排序、分页）
}
```

**优势**:

- 减少网络负载
- 大型数据集的更好性能
- 安全性：轻松排除敏感字段
- 原生 Drizzle 支持

---

### 6. 软删除支持

**状态**: 🚧 计划在 v0.4.0 实现

实现软删除以保证数据安全和审计跟踪。

#### 配置

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  softDelete: {
    enabled: true,
    field: 'deleted_at', // 默认字段名
  },
});
```

#### 使用示例

**软删除**:

```typescript
// 这将设置 deleted_at = NOW()，而不是实际删除
const { data } = await dataProvider.deleteOne({
  resource: 'posts',
  id: 1,
  meta: { softDelete: true },
});
```

**硬删除（覆盖）**:

```typescript
const { data } = await dataProvider.deleteOne({
  resource: 'posts',
  id: 1,
  meta: {
    softDelete: false, // 强制硬删除
  },
});
```

**包含已删除记录**:

```typescript
const { data, total } = await dataProvider.getList({
  resource: 'posts',
  meta: {
    includeDeleted: true, // 显示软删除的记录
  },
});
```

**仅查询已删除记录**:

```typescript
const { data, total } = await dataProvider.getList({
  resource: 'posts',
  meta: { onlyDeleted: true },
});
```

**恢复已删除记录**:

```typescript
// 自定义操作以恢复
const { data } = await dataProvider.custom({
  url: 'restore',
  method: 'post',
  payload: { resource: 'posts', id: 1 },
});
```

#### 实现

```typescript
async function deleteOne<T extends BaseRecord = BaseRecord>(
  params: DeleteOneParams,
): Promise<DeleteOneResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';
  const softDeleteField =
    params.meta?.deletedAtField ?? config.softDelete?.field ?? 'deleted_at';

  // 检查是否启用软删除
  const shouldSoftDelete =
    params.meta?.softDelete ?? config.softDelete?.enabled ?? false;

  if (shouldSoftDelete) {
    // 软删除：更新 deleted_at 字段
    const [result] = await db
      .update(table)
      .set({ [softDeleteField]: new Date() } as any)
      .where(eq(table[idColumn], params.id))
      .returning();

    if (!result) throw new RecordNotFoundError(params.resource, params.id);
    return { data: result as T };
  }

  // 硬删除：实际移除记录
  const [result] = await db
    .delete(table)
    .where(eq(table[idColumn], params.id))
    .returning();

  if (!result) throw new RecordNotFoundError(params.resource, params.id);
  return { data: result as T };
}

// 在 getList/getOne 中自动过滤软删除的记录
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);
  const softDeleteField = config.softDelete?.field ?? 'deleted_at';

  const query = db.select().from(table).$dynamic();

  // 除非明确请求，否则应用软删除过滤
  if (config.softDelete?.enabled && !params.meta?.includeDeleted) {
    if (params.meta?.onlyDeleted) {
      query.where(isNotNull(table[softDeleteField]));
    } else {
      query.where(isNull(table[softDeleteField]));
    }
  }

  // ... 其余实现
}
```

**Schema 要求**:

```typescript
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  deleted_at: integer('deleted_at', { mode: 'timestamp' }), // 软删除所需
});
```

---

## 破坏性变更

无。所有新功能都通过 `meta` 参数选择启用。

---

## 迁移指南

### 从 v0.3.x 到 v0.4.0

**无破坏性变更** - 所有现有代码将继续工作。

#### 选择性启用新功能

**启用自定义查询**:

```typescript
// 只需使用新的 custom() 方法
const result = await dataProvider.custom({
  url: 'query',
  method: 'post',
  payload: { sql: 'SELECT * FROM users' },
});
```

**启用软删除**:

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  softDelete: {
    enabled: true, // 选择启用
    field: 'deleted_at',
  },
});
```

**使用关系**（需要 schema 定义）:

```typescript
// 1. 在 schema 中定义关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

// 2. 在查询中使用
const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  meta: { include: { posts: true } },
});
```

---

## 开发路线图

| 功能         | 状态       | 目标日期  |
| ------------ | ---------- | --------- |
| getApiUrl()  | ✅ 已完成  | v0.3.2    |
| custom() 方法 | 🚧 进行中  | 2025年Q1  |
| 嵌套关系     | 🚧 进行中  | 2025年Q1  |
| 聚合查询     | 🚧 进行中  | 2025年Q1  |
| 字段选择     | 📋 已计划  | 2025年Q1  |
| 软删除       | 📋 已计划  | 2025年Q1  |

---

## 贡献

我们欢迎贡献！v0.4.0 的优先领域：

1. **custom() 方法实现** - 核心功能
2. **关系加载** - 对用户高价值
3. **聚合支持** - 常见用例
4. **测试覆盖** - 确保质量

查看 [CONTRIBUTING.md](../../CONTRIBUTING.md) 获取指南。

---

**最后更新**: 2025-01-15
**维护者**: Refine SQLx Team
