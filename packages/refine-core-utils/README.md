# Refine Core Utils

[English](#english) | [中文](#中文)

## English

Shared utilities and transformers for Refine data providers.

[![npm version](https://img.shields.io/npm/v/@refine-orm/core-utils.svg)](https://www.npmjs.com/package/@refine-orm/core-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- 🔄 **Parameter transformation**: Convert Refine filters, sorting, and pagination to SQL/ORM queries
- 🎯 **Type-safe**: Full TypeScript support with generic types
- 🔧 **Extensible**: Configurable operators and transformers
- 📦 **Lightweight**: Minimal dependencies
- 🚀 **Performance**: Optimized for high-throughput applications

## Installation

```bash
npm install @refine-orm/core-utils
# or
bun add @refine-orm/core-utils
```

## Usage

### SQL Transformer

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// Transform filters
const filterResult = transformer.transformFilters([
  { field: 'name', operator: 'contains', value: 'john' },
  { field: 'active', operator: 'eq', value: true },
]);
// Result: { sql: '"name" LIKE ? AND "active" = ?', args: ['%john%', true] }

// Transform sorting
const sortResult = transformer.transformSorting([
  { field: 'created_at', order: 'desc' },
  { field: 'name', order: 'asc' },
]);
// Result: { sql: '"created_at" DESC, "name" ASC', args: [] }

// Transform pagination
const paginationResult = transformer.transformPagination({
  current: 2,
  pageSize: 10,
});
// Result: { sql: 'LIMIT ? OFFSET ?', args: [10, 10] }
```

### Complete Query Building

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// Build a complete SELECT query
const query = transformer.buildSelectQuery('users', {
  filters: [
    { field: 'active', operator: 'eq', value: true },
    { field: 'role', operator: 'in', value: ['admin', 'user'] },
  ],
  sorting: [{ field: 'created_at', order: 'desc' }],
  pagination: { current: 1, pageSize: 20 },
});

console.log(query.sql);
// SELECT * FROM users WHERE "active" = ? AND "role" IN (?, ?) ORDER BY "created_at" DESC LIMIT ? OFFSET ?

console.log(query.args);
// [true, 'admin', 'user', 20, 0]
```

### SQL Transformation

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// Transform filters
const filters = transformer.transformFilters([
  { field: 'name', operator: 'eq', value: 'John' },
]);
// Result: { sql: '"name" = ?', args: ['John'] }

// Transform sorting
const sorting = transformer.transformSorting([
  { field: 'created_at', order: 'desc' },
]);
// Result: { sql: '"created_at" DESC', args: [] }
```

## Supported Filter Operators

### Comparison Operators

- `eq` - Equal (`=`)
- `ne` - Not equal (`!=`)
- `gt` - Greater than (`>`)
- `gte` - Greater than or equal (`>=`)
- `lt` - Less than (`<`)
- `lte` - Less than or equal (`<=`)

### Array Operators

- `in` - In array (`IN (?, ?, ...)`)
- `ina` - In array (alias for `in`)
- `nin` - Not in array (`NOT IN (?, ?, ...)`)
- `nina` - Not in array (alias for `nin`)

### String Operators

- `contains` - Contains (`LIKE %value%`)
- `ncontains` - Not contains (`NOT LIKE %value%`)
- `containss` - Contains case-sensitive (`LIKE %value% COLLATE BINARY`)
- `ncontainss` - Not contains case-sensitive (`NOT LIKE %value% COLLATE BINARY`)
- `startswith` - Starts with (`LIKE value%`)
- `nstartswith` - Not starts with (`NOT LIKE value%`)
- `startswiths` - Starts with case-sensitive (`LIKE value% COLLATE BINARY`)
- `nstartswiths` - Not starts with case-sensitive (`NOT LIKE value% COLLATE BINARY`)
- `endswith` - Ends with (`LIKE %value`)
- `nendswith` - Not ends with (`NOT LIKE %value`)
- `endswiths` - Ends with case-sensitive (`LIKE %value COLLATE BINARY`)
- `nendswiths` - Not ends with case-sensitive (`NOT LIKE %value COLLATE BINARY`)

### Null Operators

- `null` - Is null (`IS NULL`)
- `nnull` - Is not null (`IS NOT NULL`)

### Range Operators

- `between` - Between two values (`BETWEEN ? AND ?`)
- `nbetween` - Not between two values (`NOT BETWEEN ? AND ?`)

### Logical Operators

- `and` - Logical AND
- `or` - Logical OR

## Advanced Usage

### Custom Field Mapping

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

const context = {
  fieldMapping: { user_name: 'users.name', post_title: 'posts.title' },
};

const result = transformer.transformFilters(
  [{ field: 'user_name', operator: 'eq', value: 'John' }],
  context
);

// Result: { sql: '"users"."name" = ?', args: ['John'] }
```

### Drizzle ORM Integration

```typescript
import { createDrizzleTransformer } from '@refine-orm/core-utils';
import { eq, and, or, like, gt } from 'drizzle-orm';

// Create a Drizzle-specific transformer
const transformer = createDrizzleTransformer(
  // Filter operators
  [
    { operator: 'eq', transform: (field, value) => eq(field, value) },
    {
      operator: 'contains',
      transform: (field, value) => like(field, `%${value}%`),
    },
    // ... more operators
  ],
  // Logical operators
  [
    { operator: 'and', transform: conditions => and(...conditions) },
    { operator: 'or', transform: conditions => or(...conditions) },
  ],
  // Sorting transformer
  (field, order) => (order === 'asc' ? asc(field) : desc(field)),
  // Sorting combiner
  sortItems => sortItems,
  // Pagination transformer
  (limit, offset) => ({ limit, offset })
);
```

### Validation

```typescript
import {
  validateFilters,
  validateFieldName,
  validateFilterValue,
} from '@refine-orm/core-utils';

// Validate entire filter structure
const errors = validateFilters([
  { field: 'name', operator: 'eq', value: 'John' },
  { field: 'age', operator: 'gt', value: 18 },
]);

if (errors.length > 0) {
  console.error('Validation errors:', errors);
}

// Validate individual field name
const fieldError = validateFieldName('user.name');
if (fieldError) {
  console.error('Invalid field name:', fieldError.message);
}

// Validate filter value
const valueError = validateFilterValue('in', ['admin', 'user'], 'role');
if (valueError) {
  console.error('Invalid filter value:', valueError.message);
}
```

## API Reference

### Classes

#### SqlTransformer

- `transformFilters(filters, context?)` - Transform filters to SQL WHERE clause
- `transformSorting(sorting, context?)` - Transform sorting to SQL ORDER BY clause
- `transformPagination(pagination)` - Transform pagination to SQL LIMIT/OFFSET clause
- `buildSelectQuery(table, options)` - Build complete SELECT query
- `buildInsertQuery(table, data)` - Build INSERT query
- `buildUpdateQuery(table, data, filters, context?)` - Build UPDATE query
- `buildDeleteQuery(table, filters, context?)` - Build DELETE query
- `buildCountQuery(table, filters?, context?)` - Build COUNT query

#### DrizzleTransformer

- `transformFilters(filters, context?)` - Transform filters to Drizzle conditions
- `transformSorting(sorting, context?)` - Transform sorting to Drizzle order
- `transformPagination(pagination)` - Transform pagination to Drizzle limit/offset

### Factory Functions

- `createSqlTransformer()` - Create SQL transformer instance
- `createDrizzleTransformer(...)` - Create Drizzle transformer instance

### Validation Functions

- `validateFilters(filters)` - Validate filter structure
- `validateFieldName(field)` - Validate field name
- `validateFilterValue(operator, value, field)` - Validate filter value
- `validatePagination(pagination)` - Validate pagination parameters

### Utility Functions

- `isSupportedOperator(operator)` - Check if operator is supported
- `normalizeOperator(operator)` - Normalize operator (handle aliases)
- `sanitizeStringValue(value)` - Sanitize string values
- `calculatePagination(pagination)` - Calculate limit and offset

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

## MIT © [RefineORM Team](https://github.com/medz/refine-sql)

## 中文

Refine 数据提供器的共享工具和转换器。

[![npm version](https://img.shields.io/npm/v/@refine-orm/core-utils.svg)](https://www.npmjs.com/package/@refine-orm/core-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 功能特性

- 🔄 **参数转换**: 将 Refine 过滤器、排序和分页转换为 SQL/ORM 查询
- 🎯 **类型安全**: 完整的 TypeScript 支持和泛型类型
- 🔧 **可扩展**: 可配置的操作符和转换器
- 📦 **轻量级**: 最小依赖
- 🚀 **性能**: 为高吞吐量应用优化

## 安装

```bash
npm install @refine-orm/core-utils
# 或
bun add @refine-orm/core-utils
```

## 使用方法

### SQL 转换器

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// 转换过滤器
const filterResult = transformer.transformFilters([
  { field: 'name', operator: 'contains', value: 'john' },
  { field: 'active', operator: 'eq', value: true },
]);
// 结果: { sql: '"name" LIKE ? AND "active" = ?', args: ['%john%', true] }

// 转换排序
const sortResult = transformer.transformSorting([
  { field: 'created_at', order: 'desc' },
  { field: 'name', order: 'asc' },
]);
// 结果: { sql: '"created_at" DESC, "name" ASC', args: [] }

// 转换分页
const paginationResult = transformer.transformPagination({
  current: 2,
  pageSize: 10,
});
// 结果: { sql: 'LIMIT ? OFFSET ?', args: [10, 10] }
```

### 完整查询构建

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// 构建完整的 SELECT 查询
const query = transformer.buildSelectQuery('users', {
  filters: [
    { field: 'active', operator: 'eq', value: true },
    { field: 'role', operator: 'in', value: ['admin', 'user'] },
  ],
  sorting: [{ field: 'created_at', order: 'desc' }],
  pagination: { current: 1, pageSize: 20 },
});

console.log(query.sql);
// SELECT * FROM users WHERE "active" = ? AND "role" IN (?, ?) ORDER BY "created_at" DESC LIMIT ? OFFSET ?

console.log(query.args);
// [true, 'admin', 'user', 20, 0]
```

### SQL 转换

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

// 转换过滤器
const filters = transformer.transformFilters([
  { field: 'name', operator: 'eq', value: 'John' },
]);
// 结果: { sql: '"name" = ?', args: ['John'] }

// 转换排序
const sorting = transformer.transformSorting([
  { field: 'created_at', order: 'desc' },
]);
// 结果: { sql: '"created_at" DESC', args: [] }
```

## 支持的过滤操作符

### 比较操作符

- `eq` - 等于 (`=`)
- `ne` - 不等于 (`!=`)
- `gt` - 大于 (`>`)
- `gte` - 大于等于 (`>=`)
- `lt` - 小于 (`<`)
- `lte` - 小于等于 (`<=`)

### 数组操作符

- `in` - 在数组中 (`IN (?, ?, ...)`)
- `ina` - 在数组中 (`in` 的别名)
- `nin` - 不在数组中 (`NOT IN (?, ?, ...)`)
- `nina` - 不在数组中 (`nin` 的别名)

### 字符串操作符

- `contains` - 包含 (`LIKE %value%`)
- `ncontains` - 不包含 (`NOT LIKE %value%`)
- `containss` - 区分大小写包含 (`LIKE %value% COLLATE BINARY`)
- `ncontainss` - 区分大小写不包含 (`NOT LIKE %value% COLLATE BINARY`)
- `startswith` - 开始于 (`LIKE value%`)
- `nstartswith` - 不开始于 (`NOT LIKE value%`)
- `startswiths` - 区分大小写开始于 (`LIKE value% COLLATE BINARY`)
- `nstartswiths` - 区分大小写不开始于 (`NOT LIKE value% COLLATE BINARY`)
- `endswith` - 结束于 (`LIKE %value`)
- `nendswith` - 不结束于 (`NOT LIKE %value`)
- `endswiths` - 区分大小写结束于 (`LIKE %value COLLATE BINARY`)
- `nendswiths` - 区分大小写不结束于 (`NOT LIKE %value COLLATE BINARY`)

### 空值操作符

- `null` - 为空 (`IS NULL`)
- `nnull` - 不为空 (`IS NOT NULL`)

### 范围操作符

- `between` - 在两个值之间 (`BETWEEN ? AND ?`)
- `nbetween` - 不在两个值之间 (`NOT BETWEEN ? AND ?`)

### 逻辑操作符

- `and` - 逻辑 AND
- `or` - 逻辑 OR

## 高级用法

### 自定义字段映射

```typescript
import { SqlTransformer } from '@refine-orm/core-utils';

const transformer = new SqlTransformer();

const context = {
  fieldMapping: { user_name: 'users.name', post_title: 'posts.title' },
};

const result = transformer.transformFilters(
  [{ field: 'user_name', operator: 'eq', value: 'John' }],
  context
);

// 结果: { sql: '"users"."name" = ?', args: ['John'] }
```

### Drizzle ORM 集成

```typescript
import { createDrizzleTransformer } from '@refine-orm/core-utils';
import { eq, and, or, like, gt } from 'drizzle-orm';

// 创建 Drizzle 特定的转换器
const transformer = createDrizzleTransformer(
  // 过滤操作符
  [
    { operator: 'eq', transform: (field, value) => eq(field, value) },
    {
      operator: 'contains',
      transform: (field, value) => like(field, `%${value}%`),
    },
    // ... 更多操作符
  ],
  // 逻辑操作符
  [
    { operator: 'and', transform: conditions => and(...conditions) },
    { operator: 'or', transform: conditions => or(...conditions) },
  ],
  // 排序转换器
  (field, order) => (order === 'asc' ? asc(field) : desc(field)),
  // 排序组合器
  sortItems => sortItems,
  // 分页转换器
  (limit, offset) => ({ limit, offset })
);
```

### 验证

```typescript
import {
  validateFilters,
  validateFieldName,
  validateFilterValue,
} from '@refine-orm/core-utils';

// 验证整个过滤器结构
const errors = validateFilters([
  { field: 'name', operator: 'eq', value: 'John' },
  { field: 'age', operator: 'gt', value: 18 },
]);

if (errors.length > 0) {
  console.error('验证错误:', errors);
}

// 验证单个字段名
const fieldError = validateFieldName('user.name');
if (fieldError) {
  console.error('无效字段名:', fieldError.message);
}

// 验证过滤器值
const valueError = validateFilterValue('in', ['admin', 'user'], 'role');
if (valueError) {
  console.error('无效过滤器值:', valueError.message);
}
```

## API 参考

### 类

#### SqlTransformer

- `transformFilters(filters, context?)` - 将过滤器转换为 SQL WHERE 子句
- `transformSorting(sorting, context?)` - 将排序转换为 SQL ORDER BY 子句
- `transformPagination(pagination)` - 将分页转换为 SQL LIMIT/OFFSET 子句
- `buildSelectQuery(table, options)` - 构建完整的 SELECT 查询
- `buildInsertQuery(table, data)` - 构建 INSERT 查询
- `buildUpdateQuery(table, data, filters, context?)` - 构建 UPDATE 查询
- `buildDeleteQuery(table, filters, context?)` - 构建 DELETE 查询
- `buildCountQuery(table, filters?, context?)` - 构建 COUNT 查询

#### DrizzleTransformer

- `transformFilters(filters, context?)` - 将过滤器转换为 Drizzle 条件
- `transformSorting(sorting, context?)` - 将排序转换为 Drizzle 排序
- `transformPagination(pagination)` - 将分页转换为 Drizzle limit/offset

### 工厂函数

- `createSqlTransformer()` - 创建 SQL 转换器实例
- `createDrizzleTransformer(...)` - 创建 Drizzle 转换器实例

### 验证函数

- `validateFilters(filters)` - 验证过滤器结构
- `validateFieldName(field)` - 验证字段名
- `validateFilterValue(operator, value, field)` - 验证过滤器值
- `validatePagination(pagination)` - 验证分页参数

### 工具函数

- `isSupportedOperator(operator)` - 检查操作符是否支持
- `normalizeOperator(operator)` - 规范化操作符（处理别名）
- `sanitizeStringValue(value)` - 清理字符串值
- `calculatePagination(pagination)` - 计算 limit 和 offset

## 贡献

我们欢迎贡献！请查看我们的 [贡献指南](../../CONTRIBUTING.md) 了解详情。

## 许可证

MIT © [RefineORM Team](https://github.com/medz/refine-sql)
