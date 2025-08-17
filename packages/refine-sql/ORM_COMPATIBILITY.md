# ORM Compatibility Features

[English](#english) | [中文](#中文)

## English

The `refine-sql` package now includes enhanced ORM compatibility features that provide a more modern, type-safe, and flexible way to interact with your SQLite database while maintaining full compatibility with the existing Refine DataProvider interface.

## Features Overview

### 🔗 Chain Query Builder

- Fluent interface for building complex queries
- Method chaining for filters, sorting, pagination
- Support for aggregation functions (count, sum, avg, min, max)
- Query cloning and reuse

### 🔄 Polymorphic Relationships

- Support for `morphTo` and `morphMany` relationships
- Automatic loading of related data based on type fields
- Flexible configuration for different polymorphic patterns

### 🛡️ Type-Safe Operations

- Full TypeScript type inference based on your schema
- Compile-time type checking for all database operations
- Type-safe CRUD operations with schema validation

## Quick Start

### 1. Define Your Schema

```typescript
import { type TableSchema } from 'refine-sql';

interface MySchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number;
    status: 'active' | 'inactive';
    created_at: string;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    published: boolean;
    created_at: string;
  };
}
```

### 2. Create Enhanced Data Provider

```typescript
import createRefineSQL, { type EnhancedDataProvider } from 'refine-sql';

const dataProvider: EnhancedDataProvider<MySchema> =
  createRefineSQL<MySchema>('database.db');
```

### 3. Use Chain Queries

```typescript
// Simple chain query
const activeUsers = await dataProvider
  .from<MySchema['users']>('users')
  .where('status', 'eq', 'active')
  .where('age', 'gte', 18)
  .orderBy('name', 'asc')
  .limit(10)
  .get();

// Complex query with pagination
const paginatedPosts = await dataProvider
  .from<MySchema['posts']>('posts')
  .where('published', 'eq', true)
  .whereOr([
    { column: 'title', operator: 'contains', value: 'JavaScript' },
    { column: 'title', operator: 'contains', value: 'TypeScript' },
  ])
  .orderBy('created_at', 'desc')
  .paginated(1, 5);

// Aggregation queries
const userCount = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .count();

const averageAge = await dataProvider.from('users').avg('age');
```

## Chain Query API

### Filtering Methods

```typescript
// Basic conditions
.where('column', 'eq', value)
.where('age', 'gte', 18)
.where('status', 'in', ['active', 'pending'])

// Multiple AND conditions
.whereAnd([
  { column: 'status', operator: 'eq', value: 'active' },
  { column: 'age', operator: 'gte', value: 18 }
])

// Multiple OR conditions
.whereOr([
  { column: 'name', operator: 'contains', value: 'John' },
  { column: 'email', operator: 'contains', value: 'john' }
])
```

### Supported Operators

- **Comparison**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
- **Array**: `in`, `notIn`
- **String**: `like`, `ilike`, `notLike`, `contains`, `startswith`, `endswith`
- **Null checks**: `isNull`, `isNotNull`
- **Range**: `between`, `notBetween`

### Sorting and Pagination

```typescript
// Single sort
.orderBy('created_at', 'desc')

// Multiple sorts
.orderByMultiple([
  { column: 'status', direction: 'asc' },
  { column: 'created_at', direction: 'desc' }
])

// Pagination
.limit(10)
.offset(20)
.paginate(2, 10) // page 2, 10 items per page

// Get paginated results with metadata
const result = await query.paginated(1, 10);
// Returns: { data, total, page, pageSize, hasNext, hasPrev }
```

### Execution Methods

```typescript
// Get all results
const results = await query.get();

// Get first result
const first = await query.first();

// Check if any records exist
const exists = await query.exists();

// Aggregation functions
const count = await query.count();
const sum = await query.sum('amount');
const avg = await query.avg('age');
const min = await query.min('created_at');
const max = await query.max('updated_at');
```

## Polymorphic Relationships

### Basic Polymorphic Query

```typescript
interface CommentSchema {
  comments: {
    id: number;
    content: string;
    commentable_type: string; // 'post' | 'user'
    commentable_id: number;
    created_at: string;
  };
}

// Load comments with their polymorphic relationships
const commentsWithRelations = await dataProvider
  .morphTo<CommentSchema['comments']>('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .where('user_id', 'eq', 1)
  .get();

// Each comment will have a 'commentable' property with the related data
console.log(commentsWithRelations[0].commentable); // Post or User object
```

### MorphMany Relationships

```typescript
// Load multiple related records for each base record
const commentsWithMany = await dataProvider
  .morphTo('comments', morphConfig)
  .getMorphMany();

// Each comment will have an array of related records
console.log(commentsWithMany[0].related_comments); // Array of related records
```

## Type-Safe Operations

### Type-Safe CRUD

```typescript
// Create with type safety
const newUser = await dataProvider.createTyped({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    status: 'active', // TypeScript ensures this is 'active' | 'inactive'
  },
});

// Update with partial data
const updatedUser = await dataProvider.updateTyped({
  resource: 'users',
  id: 1,
  variables: {
    age: 31, // Only the fields you want to update
  },
});

// Type-safe queries
const users = await dataProvider.getListTyped({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
});
```

### Advanced Type-Safe Methods

```typescript
// Find records by conditions
const activeUsers = await dataProvider.findManyTyped(
  'users',
  { status: 'active' },
  { limit: 10, orderBy: [{ field: 'created_at', order: 'desc' }] }
);

// Check existence
const userExists = await dataProvider.existsTyped('users', {
  email: 'john@example.com',
});

// Raw queries with type safety
const results = await dataProvider.queryTyped<{
  user_count: number;
  avg_age: number;
}>(
  `
  SELECT COUNT(*) as user_count, AVG(age) as avg_age
  FROM users WHERE status = ?
`,
  ['active']
);
```

## Advanced Features

### Query Cloning and Reuse

```typescript
// Create a base query
const baseQuery = dataProvider
  .from<MySchema['posts']>('posts')
  .where('published', 'eq', true);

// Clone and modify for different use cases
const recentPosts = await baseQuery
  .clone()
  .where('created_at', 'gte', '2024-01-01')
  .orderBy('created_at', 'desc')
  .limit(5)
  .get();

const popularPosts = await baseQuery
  .clone()
  .orderBy('view_count', 'desc')
  .limit(5)
  .get();
```

### Column Selection

```typescript
// Select specific columns
const userSummary = await dataProvider
  .from('users')
  .select('id', 'name', 'email')
  .where('status', 'eq', 'active')
  .get();
```

### Complex Conditions

```typescript
const complexQuery = await dataProvider
  .from<MySchema['users']>('users')
  .where('age', 'between', [18, 65])
  .whereAnd([
    { column: 'name', operator: 'isNotNull', value: null },
    { column: 'email', operator: 'contains', value: '@' },
  ])
  .whereOr([
    { column: 'status', operator: 'eq', value: 'active' },
    { column: 'status', operator: 'eq', value: 'pending' },
  ])
  .get();
```

## Migration from Basic Usage

The enhanced features are fully backward compatible. You can gradually migrate your code:

```typescript
// Before (still works)
const users = await dataProvider.getList({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }],
  sorters: [{ field: 'name', order: 'asc' }],
  pagination: { current: 1, pageSize: 10 },
});

// After (enhanced)
const users = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .orderBy('name', 'asc')
  .paginate(1, 10)
  .get();

// Or type-safe version
const users = await dataProvider.getListTyped({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }],
  sorters: [{ field: 'name', order: 'asc' }],
  pagination: { current: 1, pageSize: 10 },
});
```

## Performance Considerations

- Chain queries are optimized and generate efficient SQL
- Query caching is automatically applied for frequently used queries
- Polymorphic queries use efficient batch loading to minimize database round trips
- Type checking happens at compile time with no runtime overhead

## Best Practices

1. **Define your schema interface** for full type safety benefits
2. **Use chain queries** for complex filtering and sorting logic
3. **Leverage polymorphic relationships** for flexible data modeling
4. **Clone base queries** to avoid repetition in similar queries
5. **Use type-safe methods** for critical operations that need validation

## Examples

See the complete example in `examples/orm-compatibility.ts` for a comprehensive demonstration of all features.

---

## 中文

`refine-sql` 包现在包含增强的 ORM 兼容性功能，提供更现代、类型安全和灵活的方式与您的 SQLite 数据库交互，同时保持与现有 Refine DataProvider 接口的完全兼容性。

## 功能概述

### 🔗 链式查询构建器

- 构建复杂查询的流畅接口
- 过滤器、排序、分页的方法链
- 支持聚合函数（count、sum、avg、min、max）
- 查询克隆和重用

### 🔄 多态关系

- 支持 `morphTo` 和 `morphMany` 关系
- 基于类型字段自动加载相关数据
- 不同多态模式的灵活配置

### 🛡️ 类型安全操作

- 基于您的模式的完整 TypeScript 类型推断
- 所有数据库操作的编译时类型检查
- 带模式验证的类型安全 CRUD 操作

## 快速开始

### 1. 定义您的模式

```typescript
import { type TableSchema } from 'refine-sql';

interface MySchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number;
    status: 'active' | 'inactive';
    created_at: string;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    published: boolean;
    created_at: string;
  };
}
```

### 2. 创建增强数据提供器

```typescript
import createRefineSQL, { type EnhancedDataProvider } from 'refine-sql';

const dataProvider: EnhancedDataProvider<MySchema> =
  createRefineSQL<MySchema>('database.db');
```

### 3. 使用链式查询

```typescript
// 简单链式查询
const activeUsers = await dataProvider
  .from<MySchema['users']>('users')
  .where('status', 'eq', 'active')
  .where('age', 'gte', 18)
  .orderBy('name', 'asc')
  .limit(10)
  .get();

// 带分页的复杂查询
const paginatedPosts = await dataProvider
  .from<MySchema['posts']>('posts')
  .where('published', 'eq', true)
  .whereOr([
    { column: 'title', operator: 'contains', value: 'JavaScript' },
    { column: 'title', operator: 'contains', value: 'TypeScript' },
  ])
  .orderBy('created_at', 'desc')
  .paginated(1, 5);

// 聚合查询
const userCount = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .count();

const averageAge = await dataProvider.from('users').avg('age');
```

## 链式查询 API

### 过滤方法

```typescript
// 基本条件
.where('column', 'eq', value)
.where('age', 'gte', 18)
.where('status', 'in', ['active', 'pending'])

// 多个 AND 条件
.whereAnd([
  { column: 'status', operator: 'eq', value: 'active' },
  { column: 'age', operator: 'gte', value: 18 }
])

// 多个 OR 条件
.whereOr([
  { column: 'name', operator: 'contains', value: 'John' },
  { column: 'email', operator: 'contains', value: 'john' }
])
```

### 支持的操作符

- **比较**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
- **数组**: `in`, `notIn`
- **字符串**: `like`, `ilike`, `notLike`, `contains`, `startswith`, `endswith`
- **空值检查**: `isNull`, `isNotNull`
- **范围**: `between`, `notBetween`

### 排序和分页

```typescript
// 单个排序
.orderBy('created_at', 'desc')

// 多个排序
.orderByMultiple([
  { column: 'status', direction: 'asc' },
  { column: 'created_at', direction: 'desc' }
])

// 分页
.limit(10)
.offset(20)
.paginate(2, 10) // 第2页，每页10项

// 获取带元数据的分页结果
const result = await query.paginated(1, 10);
// 返回: { data, total, page, pageSize, hasNext, hasPrev }
```

### 执行方法

```typescript
// 获取所有结果
const results = await query.get();

// 获取第一个结果
const first = await query.first();

// 检查是否存在任何记录
const exists = await query.exists();

// 聚合函数
const count = await query.count();
const sum = await query.sum('amount');
const avg = await query.avg('age');
const min = await query.min('created_at');
const max = await query.max('updated_at');
```

## 多态关系

### 基本多态查询

```typescript
interface CommentSchema {
  comments: {
    id: number;
    content: string;
    commentable_type: string; // 'post' | 'user'
    commentable_id: number;
    created_at: string;
  };
}

// 加载带多态关系的评论
const commentsWithRelations = await dataProvider
  .morphTo<CommentSchema['comments']>('comments', {
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .where('user_id', 'eq', 1)
  .get();

// 每个评论都会有一个 'commentable' 属性，包含相关数据
console.log(commentsWithRelations[0].commentable); // Post 或 User 对象
```

### MorphMany 关系

```typescript
// 为每个基础记录加载多个相关记录
const commentsWithMany = await dataProvider
  .morphTo('comments', morphConfig)
  .getMorphMany();

// 每个评论都会有一个相关记录数组
console.log(commentsWithMany[0].related_comments); // 相关记录数组
```

## 类型安全操作

### 类型安全 CRUD

```typescript
// 类型安全创建
const newUser = await dataProvider.createTyped({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    status: 'active', // TypeScript 确保这是 'active' | 'inactive'
  },
});

// 部分数据更新
const updatedUser = await dataProvider.updateTyped({
  resource: 'users',
  id: 1,
  variables: {
    age: 31, // 只更新您想要的字段
  },
});

// 类型安全查询
const users = await dataProvider.getListTyped({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
});
```

### 高级类型安全方法

```typescript
// 根据条件查找记录
const activeUsers = await dataProvider.findManyTyped(
  'users',
  { status: 'active' },
  { limit: 10, orderBy: [{ field: 'created_at', order: 'desc' }] }
);

// 检查存在性
const userExists = await dataProvider.existsTyped('users', {
  email: 'john@example.com',
});

// 类型安全的原生查询
const results = await dataProvider.queryTyped<{
  user_count: number;
  avg_age: number;
}>(
  `
  SELECT COUNT(*) as user_count, AVG(age) as avg_age
  FROM users WHERE status = ?
`,
  ['active']
);
```

## 高级功能

### 查询克隆和重用

```typescript
// 创建基础查询
const baseQuery = dataProvider
  .from<MySchema['posts']>('posts')
  .where('published', 'eq', true);

// 克隆并修改用于不同用例
const recentPosts = await baseQuery
  .clone()
  .where('created_at', 'gte', '2024-01-01')
  .orderBy('created_at', 'desc')
  .limit(5)
  .get();

const popularPosts = await baseQuery
  .clone()
  .orderBy('view_count', 'desc')
  .limit(5)
  .get();
```

### 列选择

```typescript
// 选择特定列
const userSummary = await dataProvider
  .from('users')
  .select('id', 'name', 'email')
  .where('status', 'eq', 'active')
  .get();
```

### 复杂条件

```typescript
const complexQuery = await dataProvider
  .from<MySchema['users']>('users')
  .where('age', 'between', [18, 65])
  .whereAnd([
    { column: 'name', operator: 'isNotNull', value: null },
    { column: 'email', operator: 'contains', value: '@' },
  ])
  .whereOr([
    { column: 'status', operator: 'eq', value: 'active' },
    { column: 'status', operator: 'eq', value: 'pending' },
  ])
  .get();
```

## 从基本用法迁移

增强功能完全向后兼容。您可以逐步迁移您的代码：

```typescript
// 之前（仍然有效）
const users = await dataProvider.getList({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }],
  sorters: [{ field: 'name', order: 'asc' }],
  pagination: { current: 1, pageSize: 10 },
});

// 之后（增强版）
const users = await dataProvider
  .from('users')
  .where('status', 'eq', 'active')
  .orderBy('name', 'asc')
  .paginate(1, 10)
  .get();

// 或类型安全版本
const users = await dataProvider.getListTyped({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }],
  sorters: [{ field: 'name', order: 'asc' }],
  pagination: { current: 1, pageSize: 10 },
});
```

## 性能考虑

- 链式查询经过优化，生成高效的 SQL
- 查询缓存自动应用于频繁使用的查询
- 多态查询使用高效的批量加载来最小化数据库往返次数
- 类型检查在编译时进行，没有运行时开销

## 最佳实践

1. **定义您的模式接口**以获得完整的类型安全好处
2. **使用链式查询**处理复杂的过滤和排序逻辑
3. **利用多态关系**进行灵活的数据建模
4. **克隆基础查询**以避免在类似查询中重复
5. **使用类型安全方法**处理需要验证的关键操作

## 示例

查看 `examples/orm-compatibility.ts` 中的完整示例，了解所有功能的全面演示。