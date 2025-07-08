# Refine-ORM 文档

## 概述

Refine-ORM 是一个强大的 Refine 数据提供者插件，它将 Drizzle ORM 与多运行时支持相结合。它在 Cloudflare D1、Node.js SQLite 和 Bun SQLite 环境中提供类型安全的数据库操作，同时保持熟悉的 Drizzle ORM API。

## 功能特性

- **Drizzle ORM 集成**：完全兼容 Drizzle ORM 模式和查询
- **多运行时支持**：自动检测和适配 D1、Node.js 和 Bun 运行时
- **类型安全**：通过 Drizzle 模式提供端到端类型安全
- **灵活查询**：支持标准 CRUD 操作和自定义 ORM 查询
- **自动迁移**：跨不同 SQL 方言自动转换参数占位符
- **性能优化**：通过 Drizzle 查询构建器高效生成查询
- **Refine 集成**：与 Refine 数据提供者接口无缝集成

## 安装

```bash
npm install refine-orm drizzle-orm
# 或
yarn add refine-orm drizzle-orm
# 或
pnpm add refine-orm drizzle-orm
```

### 运行时特定依赖

根据你的运行时选择适当的数据库驱动：

```bash
# Cloudflare D1
npm install @cloudflare/workers-types

# Node.js SQLite
npm install better-sqlite3 drizzle-orm

# Bun SQLite
# 无需额外依赖（内置支持）
```

## 快速开始

### 定义模式

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});
```

### Cloudflare D1 设置

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// 在 Cloudflare Worker 中
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.DB, { schema });
    
    const dataProvider = ormDataProvider({
      db,
      schema,
      runtime: 'd1'
    });
    
    // 与 Refine 一起使用
    return handleRefineRequest(dataProvider);
  }
};
```

### Node.js SQLite 设置

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema });

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime: 'node' // 或使用 'auto' 自动检测
});
```

### Bun SQLite 设置

```typescript
import { ormDataProvider } from 'refine-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database('database.db');
const db = drizzle(sqlite, { schema });

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime: 'bun' // 或使用 'auto' 自动检测
});
```

### 自动运行时检测

```typescript
import { ormDataProvider } from 'refine-orm';
import { createDrizzleConnection } from 'refine-orm/runtime';
import * as schema from './schema';

// 自动检测运行时并创建相应连接
const { db, runtime } = await createDrizzleConnection({
  databasePath: 'database.db', // SQLite 运行时使用
  // d1Database: env.DB        // D1 运行时使用
});

const dataProvider = ormDataProvider({
  db,
  schema,
  runtime // 自动检测的运行时
});
```

## API 参考

### ormDataProvider(config)

创建基于 ORM 的数据提供者实例。

**参数：**
- `config.db`：Drizzle 数据库实例
- `config.schema`：Drizzle 模式对象
- `config.runtime`：运行时类型（'d1' | 'node' | 'bun' | 'auto'）

**返回：** 与 Refine 兼容的数据提供者实例

### 数据提供者方法

#### getList(params)

使用 Drizzle 查询检索分页记录列表。

```typescript
const result = await dataProvider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  sorters: [{ field: 'name', order: 'asc' }],
  filters: [{ field: 'status', operator: 'eq', value: 'active' }]
});
```

#### getOne(params)

使用 Drizzle 的 select API 检索单条记录。

```typescript
const result = await dataProvider.getOne({
  resource: 'users',
  id: '123'
});
```

#### create(params)

使用 Drizzle 的 insert API 创建新记录。

```typescript
const result = await dataProvider.create({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active'
  }
});
```

#### customOrm(params)

执行具有完整类型安全的自定义 Drizzle ORM 查询。

```typescript
import { eq, and, gte, sql } from 'drizzle-orm';

// 带条件的简单查询
const result = await dataProvider.customOrm({
  query: (db, schema) => 
    db.select()
      .from(schema.users)
      .where(and(
        eq(schema.users.status, 'active'),
        gte(schema.users.createdAt, '2023-01-01')
      )),
  method: 'getList'
});

// 复杂连接查询
const postsWithAuthors = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.posts.id,
      title: schema.posts.title,
      content: schema.posts.content,
      authorName: schema.users.name,
      authorEmail: schema.users.email
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .where(eq(schema.posts.status, 'published')),
  method: 'getList'
});

// 聚合查询
const userStats = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      status: schema.users.status,
      count: sql<number>`count(*)`,
      avgAge: sql<number>`avg(${schema.users.age})`
    })
    .from(schema.users)
    .groupBy(schema.users.status),
  method: 'getList'
});
```

**参数：**
- `query`：接收 (db, schema) 并返回 Drizzle 查询的函数
- `method`：期望的返回类型（'getList' | 'getOne' | 'getMany'）

**返回：** 基于指定方法类型的完全类型安全结果

### 运行时适配器

运行时适配器自动检测并配置适当的数据库连接。

#### createDrizzleConnection(config)

```typescript
import { createDrizzleConnection } from 'refine-orm/runtime';

// 自动检测并创建连接
const { db, runtime } = await createDrizzleConnection({
  databasePath: './database.db',  // SQLite 运行时使用
  d1Database: env.DB,             // D1 运行时使用（可选）
  schema: schema                  // Drizzle 模式（可选）
});
```

**参数：**
- `config.databasePath`：SQLite 数据库文件路径
- `config.d1Database`：D1 数据库绑定（Cloudflare Workers 使用）
- `config.schema`：Drizzle 模式对象（可选）

**返回：**
```typescript
{
  db: DrizzleDatabase,
  runtime: 'node' | 'bun' | 'd1'
}
```

## 高级用法

### 复杂关系

```typescript
import { relations } from 'drizzle-orm';

// 定义关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// 带关系的查询
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.query.users.findMany({
      with: {
        posts: true
      },
      where: eq(schema.users.status, 'active')
    }),
  method: 'getList'
});
```

### 事务

```typescript
// D1 批量事务
const result = await dataProvider.customOrm({
  query: async (db, schema) => {
    const statements = [
      db.insert(schema.users).values({ name: 'John', email: 'john@example.com' }),
      db.insert(schema.posts).values({ title: 'Hello', authorId: 1 })
    ];
    
    // D1 批量执行
    return db.batch(statements);
  },
  method: 'getList'
});

// SQLite 事务（Node.js/Bun）
const result = await dataProvider.customOrm({
  query: async (db, schema) => {
    return db.transaction(async (tx) => {
      const user = await tx.insert(schema.users)
        .values({ name: 'John', email: 'john@example.com' })
        .returning();
      
      const post = await tx.insert(schema.posts)
        .values({ title: 'Hello', authorId: user[0].id })
        .returning();
      
      return { user: user[0], post: post[0] };
    });
  },
  method: 'getOne'
});
```

### 使用 Drizzle 的高级过滤

```typescript
import { eq, ne, gt, lt, gte, lte, and, or, like, inArray, isNull, isNotNull } from 'drizzle-orm';

// 复杂过滤
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.status, 'active'),
          or(
            like(schema.users.name, '%john%'),
            like(schema.users.email, '%@company.com')
          ),
          gte(schema.users.createdAt, '2023-01-01'),
          isNotNull(schema.users.email)
        )
      ),
  method: 'getList'
});

// 动态过滤
const buildFilters = (filters: any[]) => {
  const conditions = filters.map(filter => {
    switch (filter.operator) {
      case 'eq': return eq(schema.users[filter.field], filter.value);
      case 'ne': return ne(schema.users[filter.field], filter.value);
      case 'gt': return gt(schema.users[filter.field], filter.value);
      case 'contains': return like(schema.users[filter.field], `%${filter.value}%`);
      case 'in': return inArray(schema.users[filter.field], filter.value);
      default: return undefined;
    }
  }).filter(Boolean);
  
  return conditions.length > 0 ? and(...conditions) : undefined;
};
```

### 性能优化

```typescript
// 有效使用索引
const optimizedQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.status, 'active'), // 索引字段
          gte(schema.users.id, lastId)       // 主键范围
        )
      )
      .orderBy(schema.users.id)
      .limit(50),
  method: 'getList'
});

// 大表的部分选择
const lightQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active')),
  method: 'getList'
});
```

### 模式迁移

```typescript
// 使用 Drizzle 定义迁移
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// 运行迁移
await migrate(db, { migrationsFolder: './drizzle/migrations' });

// 或手动执行模式更改
await db.run(sql`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    bio TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
```

### 类型安全查询

```typescript
// 定义类型化查询结果
type UserWithPostCount = {
  id: number;
  name: string;
  email: string;
  postCount: number;
};

const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      postCount: sql<number>`count(${schema.posts.id})`
    })
    .from(schema.users)
    .leftJoin(schema.posts, eq(schema.users.id, schema.posts.authorId))
    .groupBy(schema.users.id) as Promise<UserWithPostCount[]>,
  method: 'getList'
});
```

## 运行时特定功能

### Cloudflare D1

```typescript
// D1 特定优化
const d1Query = await dataProvider.customOrm({
  query: (db, schema) => {
    // 使用 D1 的预处理语句缓存
    const stmt = db.select()
      .from(schema.users)
      .where(eq(schema.users.status, 'active'))
      .prepare();
    
    return stmt.execute();
  },
  method: 'getList'
});

// 批量操作提高效率
const batchResult = await dataProvider.customOrm({
  query: (db, schema) => {
    const statements = userIds.map(id =>
      db.select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
    );
    
    return db.batch(statements);
  },
  method: 'getMany'
});
```

### Node.js SQLite

```typescript
// 使用 better-sqlite3 功能
const nodeQuery = await dataProvider.customOrm({
  query: (db, schema) => {
    // 为重复使用准备语句
    const stmt = db.select()
      .from(schema.users)
      .where(eq(schema.users.status, placeholder('status')))
      .prepare();
    
    return stmt.execute({ status: 'active' });
  },
  method: 'getList'
});

// WAL 模式提高并发性
await db.run(sql`PRAGMA journal_mode = WAL`);
```

### Bun SQLite

```typescript
// Bun 特定优化
const bunQuery = await dataProvider.customOrm({
  query: (db, schema) => {
    // 利用 Bun 的快速 JSON 处理
    return db.select({
      id: schema.users.id,
      metadata: sql<any>`json(${schema.users.metadata})`
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'));
  },
  method: 'getList'
});
```

## 错误处理

```typescript
try {
  const result = await dataProvider.customOrm({
    query: (db, schema) =>
      db.select().from(schema.users).where(eq(schema.users.id, userId)),
    method: 'getOne'
  });
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // 处理唯一约束冲突
  } else if (error.message.includes('no such table')) {
    // 处理表不存在
  } else {
    // 处理其他数据库错误
  }
}
```

## 最佳实践

### 1. 模式设计

```typescript
// 使用适当的数据类型和约束
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: 255 }).notNull(),
  email: text('email', { length: 255 }).notNull().unique(),
  status: text('status', { enum: ['active', 'inactive', 'pending'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

### 2. 查询优化

```typescript
// 使用选择性字段和适当的索引
const optimizedQuery = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'))
    .orderBy(asc(schema.users.name))
    .limit(100),
  method: 'getList'
});
```

### 3. 类型安全

```typescript
// 定义和使用适当的类型
type CreateUserInput = typeof users.$inferInsert;
type User = typeof users.$inferSelect;

const createUser = async (data: CreateUserInput): Promise<User> => {
  const result = await dataProvider.create({
    resource: 'users',
    variables: data
  });
  return result.data;
};
```

### 4. 错误边界

```typescript
// 实现适当的错误处理
const safeQuery = async () => {
  try {
    return await dataProvider.customOrm({
      query: (db, schema) => db.select().from(schema.users),
      method: 'getList'
    });
  } catch (error) {
    console.error('数据库查询失败:', error);
    return { data: [], total: 0 };
  }
};
```

## 从 refine-sql 迁移

如果你要从 refine-sql 迁移到 refine-orm：

### 1. 安装依赖

```bash
npm install refine-orm drizzle-orm
```

### 2. 定义 Drizzle 模式

```typescript
// 将 SQL 表转换为 Drizzle 模式
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  // ... 其他字段
});
```

### 3. 更新数据提供者

```typescript
// 之前（refine-sql）
const dataProvider = createDataProvider({
  database: db,
  type: 'sqlite'
});

// 之后（refine-orm）
const dataProvider = ormDataProvider({
  db: drizzle(database, { schema }),
  schema,
  runtime: 'node'
});
```

### 4. 转换自定义查询

```typescript
// 之前（refine-sql customFlexible）
const result = await dataProvider.customFlexible({
  query: 'SELECT * FROM users WHERE status = ?',
  params: ['active'],
  method: 'getList'
});

// 之后（refine-orm customOrm）
const result = await dataProvider.customOrm({
  query: (db, schema) =>
    db.select()
      .from(schema.users)
      .where(eq(schema.users.status, 'active')),
  method: 'getList'
});
```

## 示例项目

查看 `/examples` 目录中的完整工作示例：

- `cloudflare-worker.ts`：Cloudflare Worker 实现
- `nodejs-app.js`：Node.js 应用程序
- `bun-app.ts`：Bun 应用程序
- `universal.js`：通用/同构用法

## 常见问题

### Q: 如何处理数据库连接？

A: 使用 `createDrizzleConnection` 自动检测运行时并创建适当的连接，或者手动配置特定运行时的连接。

### Q: 可以同时使用 refine-sql 和 refine-orm 吗？

A: 可以，但建议选择一个主要的数据提供者。refine-orm 提供更好的类型安全和 ORM 功能。

### Q: 如何处理复杂的 SQL 查询？

A: 使用 `customOrm` 方法结合 Drizzle 的 `sql` 模板字符串功能来执行复杂查询。

### Q: 支持哪些数据库？

A: 目前支持 SQLite（Node.js、Bun）和 Cloudflare D1。计划未来支持 PostgreSQL 和 MySQL。

## 贡献

欢迎贡献！请阅读我们的贡献指南并提交 pull request 以进行任何改进。

## 许可证

MIT 许可证 - 详见 LICENSE.md
