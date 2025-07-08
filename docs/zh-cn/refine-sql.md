# refine-sql 使用指南

refine-sql 是一个轻量级、多运行时的 SQL 数据提供者，专为 Refine 框架设计。支持 Cloudflare D1、Node.js SQLite 和 Bun SQLite。

## 📦 安装

```bash
npm install refine-sql @refinedev/core
```

## 🚀 快速开始

### Cloudflare Workers 环境

```typescript
import { dataProvider } from 'refine-sql';

export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const provider = dataProvider(env.DB);
    
    const posts = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 }
    });
    
    return new Response(JSON.stringify(posts));
  }
};
```

### Node.js 环境

```typescript
import { dataProvider } from 'refine-sql';
import Database from 'better-sqlite3';

// 方式1：使用 SQLite 文件路径
const provider = dataProvider('./database.db');

// 方式2：使用 better-sqlite3 实例
const db = new Database('./database.db');
const provider2 = dataProvider(db);

// 在 Refine 应用中使用
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine
      dataProvider={provider}
      resources={[
        {
          name: 'posts',
          list: '/posts',
          create: '/posts/create',
          edit: '/posts/edit/:id',
          show: '/posts/show/:id',
        }
      ]}
    />
  );
}
```

### Bun 环境

```typescript
import { dataProvider } from 'refine-sql';
import { Database } from 'bun:sqlite';

// 方式1：使用 SQLite 文件路径
const provider = dataProvider('./database.db');

// 方式2：使用 Bun SQLite 实例
const db = new Database('./database.db');
const provider2 = dataProvider(db);

// 启动服务器
Bun.serve({
  port: 3000,
  async fetch(request) {
    const posts = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 }
    });
    
    return new Response(JSON.stringify(posts));
  }
});
```

## � 数据操作

### 获取数据列表

```typescript
// 基本用法
const result = await provider.getList({
  resource: 'posts',
  pagination: { current: 1, pageSize: 10 }
});

// 带筛选条件
const filteredResult = await provider.getList({
  resource: 'posts',
  pagination: { current: 1, pageSize: 10 },
  filters: [
    { field: 'status', operator: 'eq', value: 'published' },
    { field: 'title', operator: 'contains', value: '教程' }
  ]
});

// 带排序
const sortedResult = await provider.getList({
  resource: 'posts',
  pagination: { current: 1, pageSize: 10 },
  sorters: [
    { field: 'created_at', order: 'desc' },
    { field: 'title', order: 'asc' }
  ]
});
```

### 获取单条数据

```typescript
const post = await provider.getOne({
  resource: 'posts',
  id: 1
});
```

### 获取多条数据

```typescript
const posts = await provider.getMany({
  resource: 'posts',
  ids: [1, 2, 3]
});
```

### 创建数据

```typescript
// 创建单条数据
const result = await provider.create({
  resource: 'posts',
  variables: {
    title: '新文章',
    content: '文章内容',
    status: 'draft'
  }
});

// 批量创建
const batchResult = await provider.createMany({
  resource: 'posts',
  variables: [
    { title: '文章1', content: '内容1' },
    { title: '文章2', content: '内容2' }
  ]
});
```

### 更新数据

```typescript
// 更新单条数据
const result = await provider.update({
  resource: 'posts',
  id: 1,
  variables: {
    title: '更新后的标题',
    status: 'published'
  }
});

// 批量更新
const batchResult = await provider.updateMany({
  resource: 'posts',
  ids: [1, 2, 3],
  variables: {
    status: 'published'
  }
});
```

### 删除数据

```typescript
// 删除单条数据
const result = await provider.deleteOne({
  resource: 'posts',
  id: 1
});

// 批量删除
const batchResult = await provider.deleteMany({
  resource: 'posts',
  ids: [1, 2, 3]
});
```

## 🔍 筛选操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `eq` | 等于 | `{ field: 'status', operator: 'eq', value: 'published' }` |
| `ne` | 不等于 | `{ field: 'status', operator: 'ne', value: 'draft' }` |
| `gt` | 大于 | `{ field: 'views', operator: 'gt', value: 100 }` |
| `gte` | 大于等于 | `{ field: 'views', operator: 'gte', value: 100 }` |
| `lt` | 小于 | `{ field: 'views', operator: 'lt', value: 1000 }` |
| `lte` | 小于等于 | `{ field: 'views', operator: 'lte', value: 1000 }` |
| `contains` | 包含 | `{ field: 'title', operator: 'contains', value: '教程' }` |

## ⚡ 增强功能

### 类型安全查询 (queryWithEnhancement)

```typescript
interface Post {
  id: number;
  title: string;
  content: string;
  status: string;
}

const result = await provider.queryWithEnhancement<Post>(async (adapter) => {
  return await adapter.query(
    'SELECT * FROM posts WHERE status = ? AND created_at > ?',
    ['published', '2023-01-01']
  );
});

console.log(result.data); // Post[]
```

### 事务支持 (transaction)

```typescript
const result = await provider.transaction(async (tx) => {
  // 在事务中执行多个操作
  await tx.execute(
    'INSERT INTO posts (title, content) VALUES (?, ?)',
    ['事务测试', '这是事务中创建的文章']
  );
  
  await tx.execute(
    'UPDATE users SET post_count = post_count + 1 WHERE id = ?',
    [userId]
  );
  
  // 查询操作
  const posts = await tx.query('SELECT * FROM posts WHERE title = ?', ['事务测试']);
  
  return posts[0];
});
```

### 增强自定义查询 (customEnhanced)

#### 字符串查询

```typescript
const result = await provider.customEnhanced({
  query: 'SELECT COUNT(*) as total FROM posts WHERE status = ?',
  params: ['published']
});

console.log(result.data[0].total); // 发布文章总数
```

#### 函数查询

```typescript
const result = await provider.customEnhanced({
  query: async (adapter) => {
    const posts = await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
    const comments = await adapter.query('SELECT COUNT(*) as count FROM comments');
    
    return {
      posts,
      totalComments: comments[0].count
    };
  }
});
```

### 灵活自定义查询 (customFlexible)

类似 refine-orm 的 customOrm 接口：

#### 字符串形式

```typescript
const result = await provider.customFlexible({
  query: 'SELECT * FROM posts WHERE category_id = ?',
  params: [categoryId]
});
```

#### 函数形式

```typescript
const result = await provider.customFlexible({
  query: async (adapter) => {
    const posts = await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
    return posts.map(post => ({
      ...post,
      summary: post.content.substring(0, 100)
    }));
  }
});
```

### 批量操作 (batch)

```typescript
const operations = [
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['文章1'] },
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['文章2'] },
  { sql: 'UPDATE posts SET status = ? WHERE id = ?', params: ['published', 1] }
];

const result = await provider.batch(operations);
```

### 获取增强适配器 (getEnhancedAdapter)

```typescript
const adapter = provider.getEnhancedAdapter();

// 直接使用适配器
const posts = await adapter.query('SELECT * FROM posts');
const result = await adapter.execute('INSERT INTO posts (title) VALUES (?)', ['直接插入']);

// 适配器事务
await adapter.transaction(async (tx) => {
  await tx.execute('INSERT INTO posts (title) VALUES (?)', ['事务文章']);
  await tx.query('SELECT * FROM posts WHERE title = ?', ['事务文章']);
});
```

## 🔧 配置选项

```typescript
import type { EnhancedConfig } from 'refine-sql';

const config: EnhancedConfig = {
  enableTypeSafety: true,      // 启用类型安全 (默认: true)
  enableTransactions: true,    // 启用事务支持 (默认: true)  
  enableAdvancedQueries: true  // 启用高级查询 (默认: true)
};

const provider = dataProvider(database, config);
```

## 📚 完整示例

### 博客系统示例

```typescript
import { dataProvider } from 'refine-sql';
import { Refine } from '@refinedev/core';

// 创建数据提供者
const provider = dataProvider('./blog.db');

// 初始化数据库
async function initDatabase() {
  await provider.customEnhanced({
    query: `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'draft',
        category_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  });
  
  await provider.customEnhanced({
    query: `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE
      )
    `
  });
}

// 在 Refine 应用中使用
function BlogApp() {
  return (
    <Refine
      dataProvider={provider}
      resources={[
        {
          name: 'posts',
          list: '/posts',
          create: '/posts/create',
          edit: '/posts/edit/:id',
          show: '/posts/show/:id',
          meta: { canDelete: true }
        },
        {
          name: 'categories',
          list: '/categories',
          create: '/categories/create',
          edit: '/categories/edit/:id'
        }
      ]}
    />
  );
}
```

## 🛠️ 调试和故障排除

### 常见问题

1. **数据库文件路径错误**
   ```typescript
   // ❌ 错误
   const provider = dataProvider('database.db');
   
   // ✅ 正确
   const provider = dataProvider('./database.db');
   ```

2. **事务中的错误处理**
   ```typescript
   try {
     const result = await provider.transaction(async (tx) => {
       await tx.execute('INSERT INTO posts (title) VALUES (?)', ['标题']);
       // 如果这里出错，事务会自动回滚
       await tx.execute('INVALID SQL');
     });
   } catch (error) {
     console.log('事务已回滚:', error.message);
   }
   ```

refine-sql 提供了完整、高性能的 SQL 数据访问解决方案，特别适合边缘计算和轻量级应用场景。
    }
  ]
});

// 返回格式：
// {
//   data: [...],    // 数据数组
//   total: 100      // 总数量
// }
```

### 获取单条记录 (getOne)

```typescript
const result = await provider.getOne({
  resource: 'posts',
  id: '1'
});

// 返回格式：
// {
//   data: { id: 1, title: '文章标题', ... }
// }
```

### 获取多条记录 (getMany)

```typescript
const result = await provider.getMany({
  resource: 'posts',
  ids: ['1', '2', '3']
});

// 返回格式：
// {
//   data: [{ id: 1, ... }, { id: 2, ... }, { id: 3, ... }]
// }
```

### 创建记录 (create)

```typescript
const result = await provider.create({
  resource: 'posts',
  variables: {
    title: '新文章',
    content: '文章内容',
    status: 'draft'
  }
});

// 返回格式：
// {
//   data: { id: 4, title: '新文章', ... }
// }
```

### 更新记录 (update)

```typescript
const result = await provider.update({
  resource: 'posts',
  id: '1',
  variables: {
    title: '更新后的标题',
    status: 'published'
  }
});

// 返回格式：
// {
//   data: { id: 1, title: '更新后的标题', ... }
// }
```

### 删除记录 (deleteOne)

```typescript
const result = await provider.deleteOne({
  resource: 'posts',
  id: '1'
});

// 返回格式：
// {
//   data: { id: 1, title: '被删除的文章', ... }
// }
```

### 批量创建 (createMany)

```typescript
const result = await provider.createMany({
  resource: 'posts',
  variables: [
    { title: '文章1', content: '内容1' },
    { title: '文章2', content: '内容2' }
  ]
});

// 返回格式：
// {
//   data: [{ id: 5, title: '文章1', ... }, { id: 6, title: '文章2', ... }]
// }
```

### 批量更新 (updateMany)

```typescript
const result = await provider.updateMany({
  resource: 'posts',
  ids: ['1', '2'],
  variables: {
    status: 'published'
  }
});

// 返回格式：
// {
//   data: [{ id: 1, status: 'published', ... }, { id: 2, status: 'published', ... }]
// }
```

### 批量删除 (deleteMany)

```typescript
const result = await provider.deleteMany({
  resource: 'posts',
  ids: ['1', '2', '3']
});

// 返回格式：
// {
//   data: [{ id: 1, ... }, { id: 2, ... }, { id: 3, ... }]
// }
```

## ⚡ 增强功能

### 类型安全查询 (queryWithEnhancement)

```typescript
interface Post {
  id: number;
  title: string;
  content: string;
  status: string;
}

const result = await provider.queryWithEnhancement<Post>(async (adapter) => {
  return await adapter.query(
    'SELECT * FROM posts WHERE status = ? AND created_at > ?',
    ['published', '2023-01-01']
  );
});

console.log(result.data); // Post[]
```

### 事务支持 (transaction)

```typescript
const result = await provider.transaction(async (tx) => {
  // 在事务中执行多个操作
  await tx.execute(
    'INSERT INTO posts (title, content) VALUES (?, ?)',
    ['事务测试', '这是事务中创建的文章']
  );
  
  await tx.execute(
    'UPDATE users SET post_count = post_count + 1 WHERE id = ?',
    [userId]
  );
  
  // 查询操作
  const posts = await tx.query('SELECT * FROM posts WHERE title = ?', ['事务测试']);
  
  return posts[0];
});

console.log(result); // 返回创建的文章
```

### 增强自定义查询 (customEnhanced)

#### 字符串查询

```typescript
const result = await provider.customEnhanced({
  query: 'SELECT COUNT(*) as total FROM posts WHERE status = ?',
  params: ['published']
});

console.log(result.data[0].total); // 发布文章总数
```

#### 函数查询

```typescript
const result = await provider.customEnhanced({
  query: async (adapter) => {
    // 复杂的查询逻辑
    const posts = await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
    const comments = await adapter.query('SELECT COUNT(*) as count FROM comments');
    
    return {
      posts,
      totalComments: comments[0].count
    };
  }
});

console.log(result.data); // { posts: [...], totalComments: 150 }
```

### 灵活自定义查询 (customFlexible)

类似 refine-orm 的 customOrm 接口：

#### 字符串形式

```typescript
const result = await provider.customFlexible({
  query: 'SELECT * FROM posts WHERE category_id = ?',
  params: [categoryId]
});
```

#### 函数形式

```typescript
const result = await provider.customFlexible({
  query: async (adapter) => {
    const posts = await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
    return posts.map(post => ({
      ...post,
      summary: post.content.substring(0, 100)
    }));
  }
});
```

### 批量操作 (batch)

```typescript
const operations = [
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['文章1'] },
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['文章2'] },
  { sql: 'UPDATE posts SET status = ? WHERE id = ?', params: ['published', 1] }
];

const result = await provider.batch(operations);
console.log(result.data); // 批量操作结果
```

### 获取增强适配器 (getEnhancedAdapter)

```typescript
const adapter = provider.getEnhancedAdapter();

// 直接使用适配器
const posts = await adapter.query('SELECT * FROM posts');
const result = await adapter.execute('INSERT INTO posts (title) VALUES (?)', ['直接插入']);

// 适配器事务
await adapter.transaction(async (tx) => {
  await tx.execute('INSERT INTO posts (title) VALUES (?)', ['事务文章']);
  await tx.query('SELECT * FROM posts WHERE title = ?', ['事务文章']);
});
```

## 🔧 配置选项

```typescript
import type { EnhancedConfig } from 'refine-sql';

const config: EnhancedConfig = {
  enableTypeSafety: true,      // 启用类型安全 (默认: true)
  enableTransactions: true,    // 启用事务支持 (默认: true)  
  enableAdvancedQueries: true  // 启用高级查询 (默认: true)
};

const provider = dataProvider(database, config);
```

## 🔍 过滤器操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `eq` | 等于 | `{ field: 'status', operator: 'eq', value: 'published' }` |
| `ne` | 不等于 | `{ field: 'status', operator: 'ne', value: 'draft' }` |
| `gt` | 大于 | `{ field: 'views', operator: 'gt', value: 100 }` |
| `gte` | 大于等于 | `{ field: 'views', operator: 'gte', value: 100 }` |
| `lt` | 小于 | `{ field: 'views', operator: 'lt', value: 1000 }` |
| `lte` | 小于等于 | `{ field: 'views', operator: 'lte', value: 1000 }` |
| `contains` | 包含 | `{ field: 'title', operator: 'contains', value: '教程' }` |

## 🎯 最佳实践

### 1. 错误处理

```typescript
try {
  const result = await provider.getList({
    resource: 'posts',
    pagination: { current: 1, pageSize: 10 }
  });
  console.log(result.data);
} catch (error) {
  console.error('查询失败:', error.message);
}
```

### 2. 类型安全

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

// 使用类型注解
const users = await provider.queryWithEnhancement<User>(async (adapter) => {
  return await adapter.query('SELECT * FROM users');
});

// users.data 现在是 User[] 类型
```

### 3. 事务最佳实践

```typescript
// ✅ 正确：事务中处理相关操作
await provider.transaction(async (tx) => {
  const user = await tx.execute('INSERT INTO users (name) VALUES (?)', ['张三']);
  await tx.execute('INSERT INTO profiles (user_id, bio) VALUES (?, ?)', [user.lastInsertRowid, '个人简介']);
});

// ❌ 错误：事务中执行不相关操作
await provider.transaction(async (tx) => {
  await tx.execute('INSERT INTO users (name) VALUES (?)', ['张三']);
  await tx.query('SELECT * FROM posts'); // 不相关的查询
});
```

### 4. 性能优化

```typescript
// ✅ 使用批量操作
const operations = posts.map(post => ({
  sql: 'INSERT INTO posts (title, content) VALUES (?, ?)',
  params: [post.title, post.content]
}));
await provider.batch(operations);

// ❌ 避免循环中的单独操作
for (const post of posts) {
  await provider.create({ resource: 'posts', variables: post });
}
```

## 📚 完整示例

### 博客系统示例

```typescript
import { dataProvider } from 'refine-sql';
import { Refine } from '@refinedev/core';

// 创建数据提供者
const provider = dataProvider('./blog.db');

// 初始化数据库
async function initDatabase() {
  await provider.customEnhanced({
    query: `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'draft',
        category_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  });
  
  await provider.customEnhanced({
    query: `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE
      )
    `
  });
}

// 博客操作示例
async function blogOperations() {
  // 创建分类
  const category = await provider.create({
    resource: 'categories',
    variables: { name: '技术文章', slug: 'tech' }
  });
  
  // 创建文章
  const post = await provider.create({
    resource: 'posts',
    variables: {
      title: 'refine-sql 使用指南',
      content: '这是一篇关于 refine-sql 的教程...',
      category_id: category.data.id,
      status: 'published'
    }
  });
  
  // 获取已发布文章列表
  const publishedPosts = await provider.getList({
    resource: 'posts',
    filters: [
      { field: 'status', operator: 'eq', value: 'published' }
    ],
    sorters: [
      { field: 'created_at', order: 'desc' }
    ],
    pagination: { current: 1, pageSize: 10 }
  });
  
  // 复杂查询：获取文章及其分类信息
  const postsWithCategories = await provider.customFlexible({
    query: async (adapter) => {
      return await adapter.query(`
        SELECT 
          p.*,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = ?
        ORDER BY p.created_at DESC
      `, ['published']);
    }
  });
  
  return {
    category: category.data,
    post: post.data,
    publishedPosts: publishedPosts.data,
    postsWithCategories: postsWithCategories.data
  };
}

// 在 Refine 应用中使用
function BlogApp() {
  return (
    <Refine
      dataProvider={provider}
      resources={[
        {
          name: 'posts',
          list: '/posts',
          create: '/posts/create',
          edit: '/posts/edit/:id',
          show: '/posts/show/:id',
          meta: { canDelete: true }
        },
        {
          name: 'categories',
          list: '/categories',
          create: '/categories/create',
          edit: '/categories/edit/:id'
        }
      ]}
    >
      {/* 你的应用组件 */}
    </Refine>
  );
}

export { provider, initDatabase, blogOperations, BlogApp };
```

## 🛠️ 调试和故障排除

### 常见问题

1. **数据库文件路径错误**
   ```typescript
   // ❌ 错误
   const provider = dataProvider('database.db'); // 可能找不到文件
   
   // ✅ 正确
   const provider = dataProvider('./database.db'); // 相对路径
   const provider = dataProvider('/absolute/path/to/database.db'); // 绝对路径
   ```

2. **事务中的错误处理**
   ```typescript
   try {
     const result = await provider.transaction(async (tx) => {
       await tx.execute('INSERT INTO posts (title) VALUES (?)', ['标题']);
       // 如果这里出错，事务会自动回滚
       await tx.execute('INVALID SQL');
     });
   } catch (error) {
     console.log('事务已回滚:', error.message);
   }
   ```

3. **类型安全检查**
   ```typescript
   // 启用 TypeScript 严格模式以获得更好的类型检查
   const config: EnhancedConfig = {
     enableTypeSafety: true
   };
   ```

refine-sql 提供了完整、高性能的 SQL 数据访问解决方案，特别适合边缘计算和轻量级应用场景。
