---
"refine-sqlx": major
---

重大重构：简化连接方式，仅支持 Drizzle ORM 实例

- 删除多个适配器文件（better-sqlite3-drizzle, bun, mysql, postgresql）
- 删除 detect-sqlite.ts 和 runtime.ts
- 简化 types.ts，移除 MySQLConfig 和 PostgreSQLConfig
- 仅接受 Drizzle ORM 实例作为连接参数
- 用户需要自己创建 Drizzle 实例并传入
