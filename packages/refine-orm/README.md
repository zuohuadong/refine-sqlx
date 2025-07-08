# @refinedev/refine-orm

一个基于 `refine-sql` 的 ORM 增强插件，为 Refine 框架提供类型安全的 ORM 支持和高级数据库功能。

## 🚀 特性

- **🔄 完全兼容 refine-sql**：复用所有基础 CRUD 操作
- **🛡️ 类型安全**：完整的 TypeScript 类型支持
- **🗃️ 多数据库支持**：PostgreSQL、MySQL、SQLite、Turso
- **⚡ 事务支持**：原生事务处理
- **🔧 ORM 集成**：支持 Drizzle ORM 等现代 ORM
- **📝 增强查询**：类型安全的查询构建器
- **🎯 零依赖**：除了 refine-sql 和 @refinedev/core

## 📦 安装

```bash
npm install refine-sql @refinedev/refine-orm
# 或
pnpm add refine-sql @refinedev/refine-orm
```

## 🛠️ 使用方法

### 基础用法

```typescript
import { ormDataProvider } from '@refinedev/refine-orm';

// 创建数据库连接（示例：PostgreSQL）
const connection = {
  async query(sql: string, params?: any[]) {
    // 你的查询实现
    return await db.query(sql, params);
  },
  async execute(sql: string, params?: any[]) {
    // 你的执行实现
    return await db.execute(sql, params);
  }
};

const dataProvider = ormDataProvider({
  database: 'postgresql',
  connection,
  logger: true // 可选：启用 SQL 日志
});

// 在 Refine 应用中使用
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      // ... 其他配置
    />
  );
}
```

### 类型安全的 ORM 查询

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// 使用 ORM 增强查询
const result = await dataProvider.queryWithOrm<User>(async (adapter) => {
  return await adapter.query(
    'SELECT * FROM users WHERE email = $1',
    ['user@example.com']
  );
});

console.log(result.data); // User[]
```

### 事务支持

```typescript
await dataProvider.transaction(async (tx) => {
  // 在事务中执行多个操作
  await tx.execute('INSERT INTO users (name, email) VALUES ($1, $2)', ['John', 'john@example.com']);
  await tx.execute('INSERT INTO profiles (user_id, bio) VALUES ($1, $2)', [userId, 'Bio']);
  
  // 如果任何操作失败，整个事务会自动回滚
});
```

### 自定义 SQL 查询

```typescript
// 字符串查询
const result = await dataProvider.customOrm({
  query: 'SELECT COUNT(*) as total FROM users WHERE active = $1',
  params: [true]
});

// 函数查询（更灵活）
const complexResult = await dataProvider.customOrm({
  query: async (adapter) => {
    const users = await adapter.query('SELECT * FROM users WHERE role = $1', ['admin']);
    const permissions = await adapter.query('SELECT * FROM permissions WHERE user_id = ANY($1)', [users.map(u => u.id)]);
    return { users, permissions };
  }
});
```

## 🎯 架构设计

refine-orm 采用**完全兼容实现**的架构：

```
┌─────────────────────────────────┐
│        refine-orm              │
│  ┌─────────────────────────────┐ │
│  │    ORM 增强功能             │ │
│  │  • queryWithOrm            │ │
│  │  • transaction             │ │
│  │  • customOrm               │ │
│  │  • getOrmAdapter           │ │
│  └─────────────────────────────┘ │
│               ↓                 │
│  ┌─────────────────────────────┐ │
│  │   兼容的基础 CRUD 实现       │ │
│  │  • 与 refine-sql 完全兼容   │ │
│  │  • 支持所有数据库类型       │ │
│  │  • 统一的行为表现          │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 优势

1. **一致性**：所有数据库都使用相同的实现逻辑，确保行为一致
2. **控制性**：完全掌控所有 CRUD 操作的实现细节
3. **扩展性**：可以轻松添加特定于不同数据库的优化
4. **独立性**：不依赖于 refine-sql 的内部实现细节
5. **兼容性**：与 refine-sql 的 API 完全兼容

## 🔧 配置选项

```typescript
interface OrmConfig {
  database: 'postgresql' | 'mysql' | 'sqlite' | 'turso';
  connection: DatabaseConnection;
  schema?: Record<string, any>;    // 可选：ORM 模式定义
  logger?: boolean;                // 可选：启用 SQL 日志
}
```

## 📚 API 参考

### 基础操作

继承自 `refine-sql` 的所有方法：
- `getList(params)` - 获取列表数据
- `getOne(params)` - 获取单个记录
- `create(params)` - 创建记录
- `update(params)` - 更新记录
- `deleteOne(params)` - 删除记录
- `getMany(params)` - 获取多个记录
- `createMany(params)` - 批量创建
- `updateMany(params)` - 批量更新
- `deleteMany(params)` - 批量删除

### ORM 增强方法

#### `queryWithOrm<T>(callback)`
类型安全的 ORM 查询方法。

#### `transaction<T>(callback)`
事务处理方法，确保数据一致性。

#### `customOrm(options)`
自定义查询方法，支持字符串和函数形式。

#### `getOrmAdapter()`
获取底层 ORM 适配器实例。

#### `close()`
关闭数据库连接。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
