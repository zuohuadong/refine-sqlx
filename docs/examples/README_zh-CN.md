# 示例

[English](./README.md) | [中文](./README_zh-CN.md)

本目录保留用于未来的 Refine 集成示例。

## 关于 refine-sqlx

`refine-sqlx` 是一个专为 [Refine](https://refine.dev/) 框架设计的 **Refine DataProvider** 库。它为 SQL 数据库提供了标准化的数据层抽象。

## 核心用途

此库**仅**应用于 Refine 应用程序。它提供：

- DataProvider 接口实现
- Refine 的 CRUD 操作
- 过滤、排序和分页
- 跨平台 SQLite 支持（Bun、Node.js、Cloudflare D1）

## 重要说明

### ❌ 不适用于

此库**不**适用于：

- 独立的 REST API（请直接使用 Drizzle ORM）
- GraphQL 服务器（请直接使用 Drizzle ORM）
- WebSocket 服务器（请直接使用 Drizzle ORM）
- 通用 Web 框架，如 Hono、Express、Fastify
- 任何不使用 Refine 的后端

### ✅ 适用于

此库**适用于**：

- Refine 管理面板
- Refine 仪表板
- Refine 数据表格
- 在前端使用 Refine 的全栈应用

## 即将推出

我们正在开发完整的 Refine 集成示例：

- **Refine + React Admin** - 使用 D1 后端的管理面板
- **Refine + Next.js** - 全栈应用程序
- **Refine + Remix** - 使用 Refine 的服务端渲染

## 如果您不使用 Refine

如果您正在构建不使用 Refine 的后端 API，应该直接使用 **Drizzle ORM** 而不是此库：

```typescript
// ✅ 正确：对于非 Refine 后端，直接使用 Drizzle
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const db = drizzle(env.DB, { schema });
    const users = await db.select().from(schema.users);
    return Response.json(users);
  },
};
```

```typescript
// ❌ 错误：不要在没有 Refine 的情况下使用 refine-sqlx
import { createRefineSQL } from 'refine-sqlx/d1';

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const provider = createRefineSQL({ connection: env.DB, schema });
    // 这增加了不必要的抽象！
  },
};
```

## 资源

- [主文档](../../README.md)
- [Refine 文档](https://refine.dev/docs/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)

---

**最后更新**：2025-10-15
