---
"refine-sqlx": patch
---

添加 createD1Provider 便捷函数

- 新增 createD1Provider 函数，自动创建 Drizzle 实例
- D1 用户可以直接传入 D1Database，无需手动调用 drizzle()
- 简化 D1 环境的使用体验
