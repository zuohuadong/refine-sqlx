# Refine SQLX

[English](#english) | [中文](#中文)

## English

A powerful, type-safe data provider for [Refine](https://refine.dev) with multi-database support using modern [Drizzle ORM](https://orm.drizzle.team).

## Features

- 🚀 **Multi-database support**: PostgreSQL, MySQL, SQLite
- 🔒 **Type-safe**: Full TypeScript 5.0+ support with schema inference
- ⚡ **Runtime detection**: Automatic driver selection (Bun, Node.js, Cloudflare)
- 🔗 **Advanced relationships**: Polymorphic associations and complex queries
- 🎯 **Chain queries**: Fluent query builder interface
- 🔄 **Transactions**: Full transaction support across all databases
- 📦 **Tree-shakable**: Import only what you need
- 🎨 **Modern Drizzle**: Latest Drizzle ORM features and optimizations
- 🏷️ **TypeScript 5.0**: Support for new standard decorators and latest features

## Installation

```bash
npm install refine-sqlx drizzle-orm
# or
bun add refine-sqlx drizzle-orm
```

### Database Drivers

Install the appropriate database driver for your setup:

```bash
# PostgreSQL
npm install postgres  # Node.js
# Bun uses built-in bun:sql for PostgreSQL

# MySQL
npm install mysql2    # All environments (Bun doesn't support MySQL in bun:sql yet)

# SQLite
npm install better-sqlite3  # Node.js
# Bun uses built-in bun:sqlite
```

## Quick Start

### 1. Define Your Schema (Modern Drizzle ORM)

```typescript
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    metadata: jsonb('metadata').$type<{
      preferences: Record<string, any>;
      settings: Record<string, any>;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    nameIdx: index('users_name_idx').on(table.name),
  })
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content'),
    authorId: uuid('author_id').notNull(),
    tags: jsonb('tags').$type<string[]>().default([]),
    status: varchar('status', {
      length: 20,
      enum: ['draft', 'published'],
    }).default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    authorFk: foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    statusIdx: index('posts_status_idx').on(table.status),
  })
);

export const schema = { users, posts };
```

### 2. Create Data Provider

#### PostgreSQL

```typescript
import { createPostgreSQLProvider } from 'refine-sqlx';
import { schema } from './schema';

// Connection string
const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:password@localhost:5432/mydb',
  schema
);

// Connection object
const dataProvider = await createPostgreSQLProvider(
  {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
  },
  schema
);
```

#### MySQL

```typescript
import { createMySQLProvider } from 'refine-sqlx';
import { schema } from './schema';

const dataProvider = await createMySQLProvider(
  'mysql://user:password@localhost:3306/mydb',
  schema
);
```

#### SQLite

```typescript
import { createSQLiteProvider } from 'refine-sqlx';
import { schema } from './schema';

// File database
const dataProvider = await createSQLiteProvider('./database.db', schema);

// In-memory database
const dataProvider = await createSQLiteProvider(':memory:', schema);

// Cloudflare D1
const dataProvider = await createSQLiteProvider(env.DB, schema);
```

### 3. Use with Refine

```typescript
import { Refine } from '@refinedev/core';
import { dataProvider } from './data-provider';

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

## Advanced Usage

### Chain Queries

```typescript
// Get users with pagination and filtering
const users = await dataProvider
  .from('users')
  .where('email', 'like', '%@example.com')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .offset(20)
  .get();

// Count with filters
const count = await dataProvider
  .from('users')
  .where('active', '=', true)
  .count();

// Complex queries
const result = await dataProvider
  .from('posts')
  .where('published', '=', true)
  .where('createdAt', '>', new Date('2024-01-01'))
  .orderBy('createdAt', 'desc')
  .with(['user']) // Include relationships
  .paginate(1, 20);
```

### Polymorphic Relationships

```typescript
import { createMorphConfig } from 'refine-sqlx';

// Define polymorphic relationship
const morphConfig = createMorphConfig({
  morphType: 'commentable_type',
  morphId: 'commentable_id',
  types: { post: posts, user: users },
});

// Query polymorphic data
const comments = await dataProvider
  .morph('comments', morphConfig)
  .where('approved', '=', true)
  .withMorphRelations()
  .get();
```

### TypeScript 5.0 Decorators (Optional Enhancement)

RefineSQLX supports TypeScript 5.0's new standard decorators for enhanced metadata and validation:

```typescript
// Enable in tsconfig.json:
// "experimentalDecorators": false,
// "emitDecoratorMetadata": false

@Entity('users')
class User {
  @PrimaryKey()
  @Column({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index('idx_user_name')
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index('idx_user_email')
  email!: string;

  @Column({ type: 'jsonb' })
  metadata?: Record<string, any>;

  @Validate()
  save() {
    console.log('Saving user:', this);
  }
}

// Use with RefineSQLX
const user = new User();
user.name = 'John Doe';
user.email = 'john@example.com';
user.save(); // Decorator will log validation

// Still use Drizzle schema for database operations
const result = await dataProvider.create({
  resource: 'users',
  variables: { name: user.name, email: user.email },
});
```

### Transactions

```typescript
import { TransactionManager } from 'refine-sqlx';

const transactionManager = new TransactionManager(dataProvider);

await transactionManager.execute(async tx => {
  // Create user
  const user = await tx.create({
    resource: 'users',
    variables: { name: 'John', email: 'john@example.com' },
  });

  // Create posts for the user
  await tx.createMany({
    resource: 'posts',
    variables: [
      { title: 'Post 1', authorId: user.data.id },
      { title: 'Post 2', authorId: user.data.id },
    ],
  });
});
```

### Raw SQL Queries

```typescript
// Execute raw SQL
const result = await dataProvider.raw(
  'SELECT * FROM users WHERE created_at > ?',
  [new Date('2024-01-01')]
);

// Use native Drizzle queries
const client = dataProvider.getClient();
const users = await client
  .select()
  .from(schema.users)
  .where(gt(schema.users.createdAt, new Date('2024-01-01')));
```

## Configuration Options

### Connection Pooling

```typescript
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    idleTimeoutMillis: 600000,
  },
});
```

### Logging and Debugging

```typescript
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  debug: true,
  logger: (query, params) => {
    console.log('Query:', query);
    console.log('Params:', params);
  },
});
```

## Runtime Support

| Runtime            | PostgreSQL  | MySQL     | SQLite            |
| ------------------ | ----------- | --------- | ----------------- |
| Bun                | ✅ bun:sql  | ✅ mysql2 | ✅ bun:sqlite     |
| Node.js            | ✅ postgres | ✅ mysql2 | ✅ better-sqlite3 |
| Cloudflare Workers | ❌          | ❌        | ✅ D1             |

## Error Handling

```typescript
import {
  ConnectionError,
  QueryError,
  ValidationError,
  TransactionError,
} from 'refine-sqlx';

try {
  const result = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Database connection failed:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query execution failed:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Data validation failed:', error.message);
  }
}
```

## Migration from Other Providers

### From Simple REST

```typescript
// Before
const dataProvider = simpleRestProvider('http://localhost:3000/api');

// After
const dataProvider = await createPostgreSQLProvider(connectionString, schema);
```

### From Supabase

```typescript
// Before
const dataProvider = supabaseDataProvider(supabaseClient);

// After - using PostgreSQL connection
const dataProvider = await createPostgreSQLProvider(
  process.env.DATABASE_URL,
  schema
);
```

## API Reference

### Core Functions

- `createPostgreSQLProvider(connection, schema, options?)` - Create PostgreSQL data provider
- `createMySQLProvider(connection, schema, options?)` - Create MySQL data provider
- `createSQLiteProvider(connection, schema, options?)` - Create SQLite data provider
- `createProvider(config)` - Universal provider factory

### Chain Query Methods

- `.where(field, operator, value)` - Add WHERE condition
- `.orderBy(field, direction)` - Add ORDER BY clause
- `.limit(count)` - Set LIMIT
- `.offset(count)` - Set OFFSET
- `.with(relations)` - Include relationships
- `.get()` - Execute and get results
- `.first()` - Get first result
- `.count()` - Get count
- `.paginate(page, perPage)` - Paginated results

### Utility Functions

- `testConnection(connectionString)` - Test database connection
- `validateSchema(schema)` - Validate Drizzle schema
- `getRuntimeInfo()` - Get runtime and driver information

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

## MIT © [RefineSQLX Team](https://github.com/medz/refine-sql)

## 中文

一个强大的、类型安全的 [Refine](https://refine.dev) 数据提供器，使用 [Drizzle ORM](https://orm.drizzle.team) 支持多数据库。

## 功能特性

- 🚀 **多数据库支持**: PostgreSQL, MySQL, SQLite
- 🔒 **类型安全**: 完整的 TypeScript 支持和模式推断
- ⚡ **运行时检测**: 自动驱动选择 (Bun, Node.js, Cloudflare)
- 🔗 **高级关系**: 多态关联和复杂查询
- 🎯 **链式查询**: 流畅的查询构建器接口
- 🔄 **事务**: 所有数据库的完整事务支持
- 📦 **Tree-shakable**: 只导入您需要的内容

## 安装

```bash
npm install refine-orm drizzle-orm
# 或
bun add refine-orm drizzle-orm
```

### 数据库驱动

为您的设置安装适当的数据库驱动：

```bash
# PostgreSQL
npm install postgres  # Node.js
# Bun 使用内置的 bun:sql 支持 PostgreSQL

# MySQL
npm install mysql2    # 所有环境 (Bun 的 bun:sql 还不支持 MySQL)

# SQLite
npm install better-sqlite3  # Node.js
# Bun 使用内置的 bun:sqlite
```

## 快速开始

### 1. 定义您的模式

```typescript
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schema = { users, posts };
```

### 2. 创建数据提供器

#### PostgreSQL

```typescript
import { createPostgreSQLProvider } from 'refine-sqlx';
import { schema } from './schema';

// 连接字符串
const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:password@localhost:5432/mydb',
  schema
);

// 连接对象
const dataProvider = await createPostgreSQLProvider(
  {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
  },
  schema
);
```

#### MySQL

```typescript
import { createMySQLProvider } from 'refine-sqlx';
import { schema } from './schema';

const dataProvider = await createMySQLProvider(
  'mysql://user:password@localhost:3306/mydb',
  schema
);
```

#### SQLite

```typescript
import { createSQLiteProvider } from 'refine-sqlx';
import { schema } from './schema';

// 文件数据库
const dataProvider = await createSQLiteProvider('./database.db', schema);

// 内存数据库
const dataProvider = await createSQLiteProvider(':memory:', schema);

// Cloudflare D1
const dataProvider = await createSQLiteProvider(env.DB, schema);
```

### 3. 与 Refine 一起使用

```typescript
import { Refine } from '@refinedev/core';
import { dataProvider } from './data-provider';

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

## 高级用法

### 链式查询

```typescript
// 获取带分页和过滤的用户
const users = await dataProvider
  .from('users')
  .where('email', 'like', '%@example.com')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .offset(20)
  .get();

// 带过滤器的计数
const count = await dataProvider
  .from('users')
  .where('active', '=', true)
  .count();

// 复杂查询
const result = await dataProvider
  .from('posts')
  .where('published', '=', true)
  .where('createdAt', '>', new Date('2024-01-01'))
  .orderBy('createdAt', 'desc')
  .with(['user']) // 包含关系
  .paginate(1, 20);
```

### 多态关系

```typescript
import { createMorphConfig } from 'refine-sqlx';

// 定义多态关系
const morphConfig = createMorphConfig({
  morphType: 'commentable_type',
  morphId: 'commentable_id',
  types: { post: posts, user: users },
});

// 查询多态数据
const comments = await dataProvider
  .morph('comments', morphConfig)
  .where('approved', '=', true)
  .withMorphRelations()
  .get();
```

### 事务

```typescript
import { TransactionManager } from 'refine-sqlx';

const transactionManager = new TransactionManager(dataProvider);

await transactionManager.execute(async tx => {
  // 创建用户
  const user = await tx.create({
    resource: 'users',
    variables: { name: 'John', email: 'john@example.com' },
  });

  // 为用户创建文章
  await tx.createMany({
    resource: 'posts',
    variables: [
      { title: 'Post 1', userId: user.data.id },
      { title: 'Post 2', userId: user.data.id },
    ],
  });
});
```

### 原生 SQL 查询

```typescript
// 执行原生 SQL
const result = await dataProvider.raw(
  'SELECT * FROM users WHERE created_at > ?',
  [new Date('2024-01-01')]
);

// 使用原生 Drizzle 查询
const client = dataProvider.getClient();
const users = await client
  .select()
  .from(schema.users)
  .where(gt(schema.users.createdAt, new Date('2024-01-01')));
```

## 配置选项

### 连接池

```typescript
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    idleTimeoutMillis: 600000,
  },
});
```

### 日志和调试

```typescript
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  debug: true,
  logger: (query, params) => {
    console.log('查询:', query);
    console.log('参数:', params);
  },
});
```

## 运行时支持

| 运行时             | PostgreSQL  | MySQL     | SQLite            |
| ------------------ | ----------- | --------- | ----------------- |
| Bun                | ✅ bun:sql  | ✅ mysql2 | ✅ bun:sqlite     |
| Node.js            | ✅ postgres | ✅ mysql2 | ✅ better-sqlite3 |
| Cloudflare Workers | ❌          | ❌        | ✅ D1             |

## 错误处理

```typescript
import {
  ConnectionError,
  QueryError,
  ValidationError,
  TransactionError,
} from 'refine-sqlx';

try {
  const result = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('数据库连接失败:', error.message);
  } else if (error instanceof QueryError) {
    console.error('查询执行失败:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('数据验证失败:', error.message);
  }
}
```

## 从其他提供器迁移

### 从 Simple REST

```typescript
// 之前
const dataProvider = simpleRestProvider('http://localhost:3000/api');

// 之后
const dataProvider = await createPostgreSQLProvider(connectionString, schema);
```

### 从 Supabase

```typescript
// 之前
const dataProvider = supabaseDataProvider(supabaseClient);

// 之后 - 使用 PostgreSQL 连接
const dataProvider = await createPostgreSQLProvider(
  process.env.DATABASE_URL,
  schema
);
```

## API 参考

### 核心函数

- `createPostgreSQLProvider(connection, schema, options?)` - 创建 PostgreSQL 数据提供器
- `createMySQLProvider(connection, schema, options?)` - 创建 MySQL 数据提供器
- `createSQLiteProvider(connection, schema, options?)` - 创建 SQLite 数据提供器
- `createProvider(config)` - 通用提供器工厂

### 链式查询方法

- `.where(field, operator, value)` - 添加 WHERE 条件
- `.orderBy(field, direction)` - 添加 ORDER BY 子句
- `.limit(count)` - 设置 LIMIT
- `.offset(count)` - 设置 OFFSET
- `.with(relations)` - 包含关系
- `.get()` - 执行并获取结果
- `.first()` - 获取第一个结果
- `.count()` - 获取计数
- `.paginate(page, perPage)` - 分页结果

### 工具函数

- `testConnection(connectionString)` - 测试数据库连接
- `validateSchema(schema)` - 验证 Drizzle 模式
- `getRuntimeInfo()` - 获取运行时和驱动信息

## 贡献

我们欢迎贡献！请查看我们的 [贡献指南](../../CONTRIBUTING.md) 了解详情。

## 许可证

MIT © [RefineSQLX Team](https://github.com/medz/refine-sql)
