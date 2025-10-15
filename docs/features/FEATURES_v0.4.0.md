# refine-sqlx v0.4.0 功能说明

## 概述

refine-sqlx v0.4.0 引入了类似 Laravel Eloquent ORM 的链式调用 API 和自动关联管理功能，为 Refine 框架提供强大且易用的数据库操作能力。

**发布渠道**: npm ([@refine-sqlx/core](https://www.npmjs.com/package/@refine-sqlx/core))

---

## 核心特性

### 1. Eloquent 风格的链式调用

提供流畅的、可读性强的查询构建器 API。

**特点**:

- ✅ 流畅的链式语法
- ✅ 自动类型推断
- ✅ 延迟执行（惰性求值）
- ✅ 方法可组合和重用

**基础查询示例**:

```typescript
import { Model } from '@refine-sqlx/core';

// 定义模型
class User extends Model {
  static table = 'users';

  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

// 链式查询
const activeUsers = await User.where('status', 'active')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

// 条件查询
const user = await User.where('email', 'user@example.com').first();

// 复杂条件
const users = await User.where('status', 'active')
  .where('createdAt', '>', new Date('2024-01-01'))
  .orWhere((query) => {
    query.where('role', 'admin').where('verified', true);
  })
  .get();

// 聚合查询
const count = await User.where('status', 'active').count();
const avgAge = await User.avg('age');
const total = await User.sum('credits');
```

**支持的链式方法**:

| 方法                               | 说明        | 示例                                          |
| ---------------------------------- | ----------- | --------------------------------------------- |
| `where(column, operator?, value?)` | 条件过滤    | `.where('age', '>', 18)`                      |
| `orWhere(column, value)`           | OR 条件     | `.orWhere('role', 'admin')`                   |
| `whereIn(column, values)`          | IN 查询     | `.whereIn('id', [1, 2, 3])`                   |
| `whereNull(column)`                | NULL 检查   | `.whereNull('deleted_at')`                    |
| `whereBetween(column, [min, max])` | 范围查询    | `.whereBetween('age', [18, 65])`              |
| `orderBy(column, direction?)`      | 排序        | `.orderBy('created_at', 'desc')`              |
| `limit(n)`                         | 限制数量    | `.limit(10)`                                  |
| `offset(n)`                        | 偏移量      | `.offset(20)`                                 |
| `with(...relations)`               | 预加载关联  | `.with('posts', 'comments')`                  |
| `select(...columns)`               | 选择字段    | `.select('id', 'name', 'email')`              |
| `groupBy(...columns)`              | 分组        | `.groupBy('status')`                          |
| `having(column, operator, value)`  | HAVING 子句 | `.having('count', '>', 5)`                    |
| `join(table, on)`                  | 连接表      | `.join('posts', 'users.id', 'posts.user_id')` |
| `distinct()`                       | 去重        | `.distinct()`                                 |

**执行方法**:

| 方法                      | 说明           | 返回值                  |
| ------------------------- | -------------- | ----------------------- |
| `get()`                   | 获取所有结果   | `Promise<T[]>`          |
| `first()`                 | 获取第一条     | `Promise<T \| null>`    |
| `find(id)`                | 通过 ID 查找   | `Promise<T \| null>`    |
| `findOrFail(id)`          | 查找或抛出异常 | `Promise<T>`            |
| `count()`                 | 计数           | `Promise<number>`       |
| `sum(column)`             | 求和           | `Promise<number>`       |
| `avg(column)`             | 平均值         | `Promise<number>`       |
| `min(column)`             | 最小值         | `Promise<number>`       |
| `max(column)`             | 最大值         | `Promise<number>`       |
| `exists()`                | 检查存在       | `Promise<boolean>`      |
| `paginate(page, perPage)` | 分页           | `Promise<Paginated<T>>` |
| `chunk(size, callback)`   | 分块处理       | `Promise<void>`         |

---

### 2. 自动关联管理

自动处理模型之间的关联关系，无需手动编写 JOIN 查询。

**支持的关联类型**:

#### 2.1 一对一 (Has One / Belongs To)

```typescript
class User extends Model {
  static table = 'users';

  // 用户有一个个人资料
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

class Profile extends Model {
  static table = 'profiles';

  // 个人资料属于一个用户
  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// 使用
const user = await User.find(1);
const profile = await user.profile().first(); // 自动关联

// 预加载（避免 N+1 问题）
const users = await User.with('profile').get();
users.forEach((user) => {
  console.log(user.profile.bio); // 已预加载
});
```

#### 2.2 一对多 (Has Many / Belongs To)

```typescript
class User extends Model {
  // 用户有多篇文章
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  // 文章属于一个用户
  user() {
    return this.belongsTo(User, 'user_id');
  }

  // 文章有多条评论
  comments() {
    return this.hasMany(Comment, 'post_id');
  }
}

// 使用
const user = await User.find(1);
const posts = await user.posts().get();

// 链式条件
const publishedPosts = await user
  .posts()
  .where('status', 'published')
  .orderBy('created_at', 'desc')
  .get();

// 嵌套预加载
const users = await User.with('posts.comments').get();
```

#### 2.3 多对多 (Belongs To Many)

```typescript
class User extends Model {
  // 用户有多个角色（通过中间表）
  roles() {
    return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
  }
}

class Role extends Model {
  // 角色有多个用户
  users() {
    return this.belongsToMany(User, 'user_roles', 'role_id', 'user_id');
  }

  // 角色有多个权限
  permissions() {
    return this.belongsToMany(Permission, 'role_permissions');
  }
}

// 使用
const user = await User.find(1);
const roles = await user.roles().get();

// 访问中间表数据
roles.forEach((role) => {
  console.log(role.pivot.assigned_at); // 中间表字段
});

// 附加关联（插入中间表）
await user
  .roles()
  .attach([1, 2, 3], { assigned_at: new Date(), assigned_by: 'admin' });

// 移除关联
await user.roles().detach([2]);

// 同步关联（替换所有）
await user.roles().sync([1, 3, 4]);
```

#### 2.4 远程一对多 (Has Many Through)

```typescript
class Country extends Model {
  // 国家有多个用户
  users() {
    return this.hasMany(User, 'country_id');
  }

  // 国家通过用户有多篇文章
  posts() {
    return this.hasManyThrough(Post, User, 'country_id', 'user_id');
  }
}

// 使用
const country = await Country.find(1);
const posts = await country.posts().get(); // 自动 JOIN
```

---

### 3. 多态关联 (Polymorphic Relations)

支持一个模型关联到多种不同的模型类型。

#### 3.1 一对一多态 (Morph One)

```typescript
class Post extends Model {
  // 文章有一张封面图（多态）
  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class User extends Model {
  // 用户有一个头像（多态）
  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class Image extends Model {
  // 反向关联
  imageable() {
    return this.morphTo();
  }
}

// 使用
const post = await Post.find(1);
const image = await post.image().first();

const image = await Image.find(1);
const owner = await image.imageable().first(); // 可能是 Post 或 User
```

#### 3.2 一对多多态 (Morph Many)

```typescript
class Post extends Model {
  // 文章有多条评论
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  // 视频有多条评论
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  // 评论属于可评论的对象
  commentable() {
    return this.morphTo();
  }
}

// 数据库结构
// comments 表:
// - id
// - content
// - commentable_id    (关联对象 ID)
// - commentable_type  (关联对象类型: 'Post' | 'Video')
// - created_at

// 使用
const post = await Post.find(1);
const comments = await post.comments().get();

// 创建多态关联
await post.comments().create({ content: 'Great post!', user_id: 1 });
```

#### 3.3 多对多多态 (Morph To Many)

```typescript
class Post extends Model {
  // 文章有多个标签
  tags() {
    return this.morphToMany(Tag, 'taggable');
  }
}

class Video extends Model {
  // 视频有多个标签
  tags() {
    return this.morphToMany(Tag, 'taggable');
  }
}

class Tag extends Model {
  // 标签可以关联到文章
  posts() {
    return this.morphedByMany(Post, 'taggable');
  }

  // 标签可以关联到视频
  videos() {
    return this.morphedByMany(Video, 'taggable');
  }
}

// 数据库结构
// taggables 表:
// - tag_id
// - taggable_id
// - taggable_type

// 使用
const post = await Post.find(1);
await post.tags().attach([1, 2, 3]);

const tag = await Tag.find(1);
const posts = await tag.posts().get();
const videos = await tag.videos().get();
```

---

### 4. 动态关系 (Dynamic Relations)

运行时动态定义和扩展模型关联。

**特点**:

- ✅ 运行时添加关联
- ✅ 条件关联
- ✅ 动态作用域
- ✅ 全局作用域

#### 4.1 动态添加关联

```typescript
// 运行时动态添加关联
User.addDynamicRelation('recentPosts', function () {
  return this.hasMany(Post, 'user_id')
    .where('created_at', '>', Date.now() - 7 * 24 * 60 * 60 * 1000)
    .orderBy('created_at', 'desc');
});

// 使用
const user = await User.find(1);
const recentPosts = await user.recentPosts().get();

// 预加载动态关联
const users = await User.with('recentPosts').get();
```

#### 4.2 条件关联

```typescript
class User extends Model {
  // 根据条件返回不同的关联
  posts(published = false) {
    const query = this.hasMany(Post, 'user_id');

    if (published) {
      query.where('status', 'published');
    }

    return query;
  }
}

// 使用
const allPosts = await user.posts().get();
const publishedPosts = await user.posts(true).get();
```

#### 4.3 查询作用域 (Query Scopes)

```typescript
class Post extends Model {
  // 本地作用域
  static scopePublished(query) {
    return query.where('status', 'published');
  }

  static scopePopular(query, minViews = 1000) {
    return query.where('views', '>=', minViews);
  }

  static scopeRecent(query, days = 7) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return query.where('created_at', '>=', date);
  }
}

// 使用作用域
const posts = await Post.published().popular(5000).recent(30).get();

// 组合作用域
const trendingPosts = await Post.published()
  .popular()
  .orderBy('views', 'desc')
  .limit(10)
  .get();
```

#### 4.4 全局作用域

```typescript
// 定义全局作用域（自动应用到所有查询）
class SoftDeletingScope {
  apply(query) {
    return query.whereNull('deleted_at');
  }
}

class Post extends Model {
  static boot() {
    super.boot();
    this.addGlobalScope(new SoftDeletingScope());
  }
}

// 所有查询自动过滤软删除
const posts = await Post.get(); // 自动添加 WHERE deleted_at IS NULL

// 包含软删除的数据
const allPosts = await Post.withTrashed().get();

// 仅软删除的数据
const trashedPosts = await Post.onlyTrashed().get();
```

---

### 5. 自动关联维护

自动处理关联数据的创建、更新和删除。

#### 5.1 创建时自动关联

```typescript
// 创建用户并同时创建关联
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  profile: { bio: 'Software Developer', avatar: 'avatar.jpg' },
  posts: [
    { title: 'First Post', content: '...' },
    { title: 'Second Post', content: '...' },
  ],
});

// 自动创建 profile 和 posts 记录
```

#### 5.2 更新时自动同步

```typescript
const user = await User.find(1);

// 更新用户及关联数据
await user.update({
  name: 'Jane Doe',
  profile: { bio: 'Updated bio' },
  posts: [
    { id: 1, title: 'Updated Title' }, // 更新已存在的
    { title: 'New Post' }, // 创建新的
  ],
});

// 自动 UPSERT 处理
```

#### 5.3 删除时自动清理

```typescript
class User extends Model {
  // 定义级联删除
  static cascadeDeletes = ['posts', 'profile'];
}

// 删除用户时自动删除关联
await user.delete(); // 自动删除 posts 和 profile
```

#### 5.4 观察者模式 (Observers)

```typescript
class UserObserver {
  // 创建之前
  creating(user) {
    console.log('Creating user:', user);
  }

  // 创建之后
  created(user) {
    // 自动创建关联的 profile
    user.profile().create({ bio: '', avatar: 'default.jpg' });
  }

  // 更新之前
  updating(user) {
    user.updatedAt = new Date();
  }

  // 删除之前
  deleting(user) {
    // 清理关联数据
    user.posts().delete();
  }
}

// 注册观察者
User.observe(UserObserver);
```

---

### 6. 高级特性

#### 6.1 查询缓存

```typescript
// 启用查询缓存
const users = await User.where('status', 'active')
  .remember(60) // 缓存 60 秒
  .get();

// 标记缓存
const posts = await Post.where('featured', true)
  .cacheTags(['featured', 'posts'])
  .remember(300)
  .get();

// 清除缓存
await Post.flushCache(['featured']);
```

#### 6.2 事件系统

```typescript
// 监听模型事件
User.on('created', (user) => {
  console.log('New user created:', user.id);
  // 发送欢迎邮件
});

User.on('updated', (user) => {
  console.log('User updated:', user.id);
});

User.on('deleted', (user) => {
  console.log('User deleted:', user.id);
});
```

#### 6.3 属性转换 (Casts)

```typescript
class User extends Model {
  // 自动类型转换
  static casts = {
    is_admin: 'boolean',
    settings: 'json',
    birth_date: 'date',
    salary: 'number',
  };
}

const user = await User.find(1);
console.log(typeof user.is_admin); // boolean
console.log(user.settings); // Object (自动解析 JSON)
console.log(user.birth_date); // Date 对象
```

#### 6.4 访问器和修改器

```typescript
class User extends Model {
  // 访问器 (Getter)
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  // 修改器 (Setter)
  set password(value) {
    this.attributes.password = hashPassword(value);
  }
}

const user = new User();
user.firstName = 'John';
user.lastName = 'Doe';
console.log(user.fullName); // "John Doe"

user.password = 'secret123'; // 自动加密
```

#### 6.5 软删除 (Soft Deletes)

```typescript
class Post extends Model {
  static softDeletes = true;
}

const post = await Post.find(1);

// 软删除（设置 deleted_at）
await post.delete();

// 恢复
await post.restore();

// 永久删除
await post.forceDelete();

// 查询包含软删除
const allPosts = await Post.withTrashed().get();
```

---

## 安装和使用

### 安装

```bash
# 使用 npm
npm install @refine-sqlx/core

# 使用 bun
bun add @refine-sqlx/core

# 使用 pnpm
pnpm add @refine-sqlx/core
```

### 快速开始

```typescript
import { createRefineSQL, Model } from '@refine-sqlx/core';

// 1. 定义模型
class User extends Model {
  static table = 'users';

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  static table = 'posts';

  user() {
    return this.belongsTo(User, 'user_id');
  }

  comments() {
    return this.morphMany(Comment, 'commentable');
  }

  tags() {
    return this.morphToMany(Tag, 'taggable');
  }
}

// 2. 配置数据库连接
const dataProvider = createRefineSQL({
  // Bun 环境
  driver: 'bun:sql',
  connection: 'sqlite::memory:',

  // 或 Node.js 环境
  // driver: 'better-sqlite3',
  // connection: './database.sqlite',

  // 注册模型
  models: [User, Post, Comment, Tag],
});

// 3. 在 Refine 中使用
import { Refine } from '@refinedev/core';

<Refine
  dataProvider={dataProvider}
  resources={[
    {
      name: 'users',
      list: '/users',
      create: '/users/create',
      edit: '/users/edit/:id',
    },
  ]}
/>;

// 4. 使用 Eloquent API
const users = await User.with('posts.comments', 'posts.tags')
  .where('status', 'active')
  .orderBy('created_at', 'desc')
  .paginate(1, 20);
```

### TypeScript 支持

完整的 TypeScript 类型支持，自动类型推断：

```typescript
import { InferModel, Model } from '@refine-sqlx/core';

class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare createdAt: Date;

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// 自动推断类型
type UserType = InferModel<typeof User>;
// { id: number; name: string; email: string; createdAt: Date }

// 查询结果自动类型化
const users: UserType[] = await User.get();
const user: UserType | null = await User.find(1);
```

---

## 迁移指南

### 从 Drizzle ORM 迁移

```typescript
// 之前：使用 Drizzle
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.status, 'active'))
  .limit(10);

// 现在：使用 refine-sqlx
const users = await User.where('status', 'active').limit(10).get();
```

### 从原生 SQL 迁移

```typescript
// 之前：手动 JOIN
const query = `
  SELECT users.*, posts.*
  FROM users
  LEFT JOIN posts ON posts.user_id = users.id
  WHERE users.status = 'active'
`;

// 现在：自动关联
const users = await User.with('posts').where('status', 'active').get();
```

---

## 性能优化

### N+1 查询问题

```typescript
// ❌ 错误：N+1 查询问题
const users = await User.get();
for (const user of users) {
  const posts = await user.posts().get(); // N 次查询
}

// ✅ 正确：使用预加载
const users = await User.with('posts').get(); // 2 次查询
users.forEach((user) => {
  console.log(user.posts); // 已加载
});
```

### 条件预加载

```typescript
const users = await User.with({
  posts: (query) => {
    query.where('status', 'published').orderBy('created_at', 'desc').limit(5);
  },
}).get();
```

### 延迟加载

```typescript
const user = await User.find(1);

// 仅在需要时加载
if (needPosts) {
  await user.load('posts');
}
```

---

## 兼容性

| 运行时        | 支持 | 数据库                    |
| ------------- | ---- | ------------------------- |
| Bun           | ✅   | SQLite, MySQL, PostgreSQL |
| Node.js       | ✅   | SQLite, MySQL, PostgreSQL |
| Cloudflare D1 | ✅   | D1 (SQLite)               |
| Deno          | ⏳   | 计划支持                  |

---

## API 文档

完整 API 文档: [https://refine-sqlx.dev/docs/api](https://refine-sqlx.dev/docs/api)

---

## 示例项目

- [博客系统](https://github.com/refine-sqlx/examples/tree/main/blog)
- [电商平台](https://github.com/refine-sqlx/examples/tree/main/ecommerce)
- [任务管理](https://github.com/refine-sqlx/examples/tree/main/todo)

---

## 反馈和贡献

- GitHub Issues: [https://github.com/refine-sqlx/core/issues](https://github.com/refine-sqlx/core/issues)
- 讨论区: [https://github.com/refine-sqlx/core/discussions](https://github.com/refine-sqlx/core/discussions)
- NPM: [@refine-sqlx/core](https://www.npmjs.com/package/@refine-sqlx/core)

---

## 许可证

MIT License

---

**发布日期**: 2025-Q1
**版本**: v0.4.0
**维护者**: Refine SQLx Team
