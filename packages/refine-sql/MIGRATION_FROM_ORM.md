# 从 refine-orm 迁移到 refine-sql

本指南帮助你从 `refine-orm` 平滑迁移到 `refine-sql`，减少学习成本和代码修改量。

## 主要差异

### 数据库支持

- **refine-orm**: 支持 PostgreSQL、MySQL、SQLite
- **refine-sql**: 专注于 SQLite，提供更好的 SQLite 优化

### 架构差异

- **refine-orm**: 基于 Drizzle ORM
- **refine-sql**: 基于原生 SQL，提供类型安全的 API

## 迁移步骤

### 1. 安装依赖

```bash
# 卸载 refine-orm
npm uninstall refine-orm

# 安装 refine-sql
npm install refine-sql
```

### 2. 更新导入语句

#### 之前 (refine-orm)

```typescript
import { createPostgreSQLProvider, createSQLiteProvider } from 'refine-orm';
```

#### 现在 (refine-sql)

```typescript
// 推荐使用新的主要工厂函数
import { createProvider } from 'refine-sql';

// 或者使用兼容性导入 (已弃用)
import { createSQLiteProvider } from 'refine-sql';
```

### 3. 数据提供者创建

#### 之前 (refine-orm)

```typescript
// PostgreSQL (不支持)
const dataProvider = createPostgreSQLProvider(
  'postgresql://user:pass@localhost:5432/db',
  schema
);

// SQLite
const dataProvider = createSQLiteProvider('./database.db', schema);
```

#### 现在 (refine-sql)

```typescript
// 推荐使用新的主要工厂函数
const dataProvider = createProvider('./database.db');

// 或者使用兼容性 API (已弃用)
const dataProvider = createSQLiteProvider('./database.db');
```

### 4. 链式查询

#### 之前 (refine-orm)

```typescript
const posts = await dataProvider
  .from('posts')
  .where('status', 'eq', 'published')
  .where('viewCount', 'gt', 100)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();
```

#### 现在 (refine-sql) - 使用新的统一 API

```typescript
const posts = await dataProvider
  .from('posts')
  .where('status', 'eq', 'published') // 新的统一方法
  .where('viewCount', 'gt', 100) // 新的统一方法
  .orderBy('createdAt', 'desc') // 新的统一方法
  .limit(10)
  .get();

// 所有方法都使用统一的 where() 和 orderBy() API
const posts = await dataProvider
  .from('posts')
  .where('status', 'eq', 'published')
  .where('viewCount', 'gt', 100)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();
```

### 5. 关系查询

#### 之前 (refine-orm)

```typescript
const posts = await dataProvider
  .from('posts')
  .withBelongsTo('author', 'users', 'authorId')
  .withHasMany('comments', 'comments', 'id', 'postId')
  .get();
```

#### 现在 (refine-sql) - 兼容 API

```typescript
const posts = await dataProvider
  .from('posts')
  .withBelongsTo('author', 'users', 'authorId')
  .withHasMany('comments', 'comments', 'id', 'postId')
  .getWithRelations(); // 注意：使用 getWithRelations() 而不是 get()
```

### 6. 类型安全操作

#### 之前 (refine-orm)

```typescript
interface BlogSchema {
  posts: { id: number; title: string; content: string };
}

const post = await dataProvider.create({
  resource: 'posts',
  variables: { title: 'Hello World', content: 'Content here' },
});
```

#### 现在 (refine-sql) - 兼容

```typescript
interface BlogSchema extends TableSchema {
  posts: { id: number; title: string; content: string };
}

const dataProvider = createProvider<BlogSchema>('./database.db');

// 标准 Refine API - 完全兼容
const post = await dataProvider.create({
  resource: 'posts',
  variables: { title: 'Hello World', content: 'Content here' },
});

// 类型安全 API
const post = await dataProvider.createTyped({
  resource: 'posts',
  variables: { title: 'Hello World', content: 'Content here' },
});
```

## 兼容性矩阵

| 功能            | refine-orm | refine-sql | 兼容性                         |
| --------------- | ---------- | ----------- | ------------------------------ |
| SQLite 支持     | ✅         | ✅          | 完全兼容                       |
| PostgreSQL 支持 | ✅         | ❌          | 不支持                         |
| MySQL 支持      | ✅         | ❌          | 不支持                         |
| 链式查询        | ✅         | ✅          | 完全兼容 + 增强                |
| 关系查询        | ✅         | ✅          | 兼容 (需使用 getWithRelations) |
| 类型安全        | ✅         | ✅          | 完全兼容                       |
| 事务支持        | ✅         | ✅          | 兼容                           |
| 批量操作        | ✅         | ✅          | 完全兼容 + 增强                |
| 聚合查询        | ✅         | ✅          | 完全兼容 + 增强                |
| Upsert 操作     | ✅         | ✅          | 兼容                           |
| 原生 SQL        | ✅         | ✅          | 完全兼容                       |
| 多态关系        | ✅         | ✅          | 兼容                           |

## 新增的兼容性功能

### 增强的链式查询方法

```typescript
// 更多 WHERE 条件方法
const results = await dataProvider
  .from('posts')
  .whereBetween('createdAt', [startDate, endDate])
  .whereContains('title', 'tutorial')
  .whereStartsWith('slug', 'how-to')
  .whereEndsWith('title', 'guide')
  .get();

// 批量条件
const results = await dataProvider
  .from('posts')
  .whereAll([
    { column: 'status', operator: 'eq', value: 'published' },
    { column: 'viewCount', operator: 'gt', value: 100 },
  ])
  .get();
```

### 增强的聚合查询

```typescript
// 多个聚合一次查询
const stats = await dataProvider.from('posts').aggregate([
  { function: 'count', alias: 'total_posts' },
  { function: 'avg', column: 'viewCount', alias: 'avg_views' },
  { function: 'max', column: 'createdAt', alias: 'latest_post' },
]);

// 带别名的聚合
const totalViews = await dataProvider
  .from('posts')
  .sumAs('viewCount', 'total_views');
```

### 批量处理方法

```typescript
// 分块处理大量数据
for await (const chunk of dataProvider.from('posts').chunk(100)) {
  await processChunk(chunk);
}

// 按 ID 分块处理
await dataProvider.from('posts').chunkById(100, async posts => {
  await processPosts(posts);
});

// 映射和过滤
const titles = await dataProvider.from('posts').map(post => post.title);

const publishedPosts = await dataProvider
  .from('posts')
  .filter(post => post.status === 'published');
```

### 高级数据操作

```typescript
// 查找或创建
const { data, created } = await dataProvider.firstOrCreate({
  resource: 'users',
  where: { email: 'user@example.com' },
  defaults: { name: 'New User', role: 'user' },
});

// 更新或创建
const { data, created } = await dataProvider.updateOrCreate({
  resource: 'users',
  where: { email: 'user@example.com' },
  values: { name: 'Updated Name', lastLogin: new Date() },
});

// 数值字段增减
await dataProvider.increment({
  resource: 'posts',
  id: 1,
  column: 'viewCount',
  amount: 1,
});

await dataProvider.decrement({
  resource: 'users',
  id: 1,
  column: 'credits',
  amount: 10,
});
```

### 增强的关系查询

```typescript
// 多态关系
const posts = await dataProvider
  .from('posts')
  .withMorphMany(
    'attachments',
    'attachments',
    'attachableType',
    'attachableId',
    'post'
  )
  .getWithRelations();

// 带条件的关系查询
const users = await dataProvider
  .from('users')
  .withHasMany('posts', 'posts', 'id', 'authorId')
  .withWhere('posts', query => query.where('status', 'eq', 'published'))
  .getWithRelations();
```

## 不兼容的功能

### 1. PostgreSQL/MySQL 支持

如果你的项目使用 PostgreSQL 或 MySQL，需要继续使用 `refine-orm`。

### 2. Drizzle ORM 特性

`refine-sql` 不基于 Drizzle ORM，因此 Drizzle 特有的功能不可用。

### 3. 原生查询构建器

`refine-orm` 的原生 Drizzle 查询构建器在 `refine-sql` 中不可用。

## 迁移检查清单

- [ ] 确认项目只使用 SQLite 数据库
- [ ] 更新包依赖 (`refine-orm` → `refine-sql`)
- [ ] 更新导入语句
- [ ] 更新数据提供者创建代码
- [ ] 测试链式查询功能
- [ ] 测试关系查询功能 (使用 `getWithRelations()`)
- [ ] 测试类型安全操作
- [ ] 运行完整的测试套件

## 性能优势

迁移到 `refine-sql` 后，你将获得：

1. **更好的 SQLite 优化**: 专门为 SQLite 优化的查询生成
2. **更小的包体积**: 没有多数据库支持的开销
3. **更快的查询执行**: 原生 SQL 查询，减少 ORM 层开销
4. **更好的类型推导**: 专门设计的类型系统

## 获取帮助

如果在迁移过程中遇到问题：

1. 查看 [FAQ](./FAQ.md)
2. 查看 [示例代码](./examples/)
3. 提交 [Issue](https://github.com/your-repo/issues)

## 示例项目

查看完整的迁移示例：

- [博客应用迁移示例](./examples/blog-app-migration.ts)
- [电商应用迁移示例](./examples/ecommerce-migration.ts)
