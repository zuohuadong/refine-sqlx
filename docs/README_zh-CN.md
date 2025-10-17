[English](./README.md) | [中文](./README_zh-CN.md)

# 文档

本目录包含 refine-sqlx 项目的所有文档。

## 目录结构

```
docs/
├── specs/              # 技术规范和标准
│   └── CLAUDE_SPEC.md      # Claude Code 项目规范
├── features/           # 功能文档和发布说明
│   ├── FEATURES_v0.3.0.md  # v0.3.0 功能文档
│   ├── FEATURES_v0.4.0.md  # v0.4.0 完整功能
│   ├── FEATURES_v0.4.0_zh-CN.md  # v0.4.0 中文文档
│   └── FEATURES_v0.5.0_zh-CN.md  # v0.5.0 中文文档
├── v0.5.0/             # v0.5.0 完整文档
│   ├── README.md            # v0.5.0 入口
│   ├── FINAL_REPORT.md      # 实现报告
│   ├── FEATURES.md          # 功能规范（英文）
│   ├── FEATURES_zh-CN.md    # 功能规范（中文）
│   └── USAGE_EXAMPLES.md    # 完整使用示例
├── analysis/           # 技术分析和研究
│   └── D1_BUNDLE_SIZE_ANALYSIS.md  # D1 包体积分析
├── examples/           # 交互式示例和模板
│   ├── d1-rest-api/        # 完整的 REST API 模板
│   ├── d1-hono/            # Hono 框架集成
│   ├── d1-graphql/         # GraphQL API 模板
│   └── d1-websocket/       # WebSocket 实时模板
├── D1_FEATURES.md      # D1 特定功能指南
└── README.md          # 本文件
```

## 快速开始

### 交互式示例

使用现成的可部署模板快速开始：

- **[示例概览](./examples/README.md)** - 所有交互式示例和模板
- **[D1 REST API](./examples/d1-rest-api/)** - 完整的 REST API 和 CRUD 操作
- **[D1 + Hono](./examples/d1-hono/)** - 使用 Hono 框架的高性能 API
- **[D1 + GraphQL](./examples/d1-graphql/)** - 类型安全的 GraphQL API
- **[D1 + WebSocket](./examples/d1-websocket/)** - 使用 WebSocket 的实时更新

### 在线试用

点击在浏览器中打开示例：

| 模板           | 描述                           | 部署                                                                                                                                                                      |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 REST API    | 完整的 CRUD 与过滤和分页       | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-rest-api)  |
| D1 + Hono      | 轻量级、快速的 API 框架        | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-hono)      |
| D1 + GraphQL   | 类型安全的 GraphQL 与订阅      | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-graphql)   |
| D1 + WebSocket | 使用 Durable Objects 的实时数据 | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/medz/refine-sqlx/tree/main/docs/examples/d1-websocket) |

## 文档

### 规范

**[CLAUDE_SPEC.md](./specs/CLAUDE_SPEC.md)** - Claude Code 项目规范

- 项目的技术标准
- TypeScript 5.0+ 装饰器要求
- 数据库驱动要求（Bun、Node.js、Cloudflare D1）
- D1 环境的构建优化
- 代码组织和最佳实践
- 合规性检查清单

**目标受众**：开发者、Claude Code AI 助手

### 功能

**[FEATURES_v0.3.0.md](./features/FEATURES_v0.3.0.md)** - v0.3.0 功能文档

- Drizzle ORM 集成和迁移
- 类型安全的查询构建器
- D1 环境优化构建（16KB gzipped）
- 跨平台改进
- 从 v0.2.x 的迁移指南

**[FEATURES_v0.4.0.md](./features/FEATURES_v0.4.0.md)** - v0.4.0 完整功能

- ✅ custom() 方法用于原始 SQL 查询
- ✅ getApiUrl() 方法
- ✅ 使用 Drizzle 加载嵌套关系
- ✅ 支持 GROUP BY 和 HAVING 的聚合查询
- ✅ 字段选择/投影
- ✅ 软删除支持
- ✅ SQLite 数据库的时间旅行
- ✅ 多数据库支持（MySQL、PostgreSQL）

**[FEATURES_v0.4.0_zh-CN.md](./features/FEATURES_v0.4.0_zh-CN.md)** - v0.4.0 功能路线图（中文版）

**[v0.5.0 文档](./v0.5.0/README.md)** - v0.5.0 完整实现

- ✅ P1：核心集成（100%）
- ✅ P2：企业功能（100%）
  - 乐观锁
  - 实时查询/实时订阅
  - 多租户/行级安全
  - 查询缓存（内存、Redis）
- ✅ P3：开发者体验（100%）
  - TypeScript 类型生成器（CLI）
  - 数据验证（Zod 集成）
  - 增强的日志记录和调试
  - 迁移管理（Drizzle Kit）

**[v0.5.0/FEATURES_zh-CN.md](./v0.5.0/FEATURES_zh-CN.md)** - v0.5.0 功能文档（中文版）

**目标受众**：最终用户、npm 包使用者、开发者

### 分析

**[D1_BUNDLE_SIZE_ANALYSIS.md](./analysis/D1_BUNDLE_SIZE_ANALYSIS.md)** - D1 包体积分析

- 包体积分解和估算
- 优化策略
- 构建配置示例
- 性能基准测试
- 体积监控设置

**目标受众**：性能工程师、维护者

**[D1_FEATURES.md](./D1_FEATURES.md)** - D1 批量操作和时间旅行指南

- 批量操作（插入、更新、删除）
- D1 特定优化
- 时间旅行配置
- 性能调优
- 最佳实践

**目标受众**：D1 用户、Cloudflare Workers 开发者

### 示例与模板

**[examples/](./examples/)** - 交互式示例和模板

常见场景的完整、可投入生产的模板：

1. **REST API** - 具有过滤、排序和分页的完整 CRUD 操作
2. **Hono 集成** - 使用 Hono 框架的高性能 API
3. **GraphQL** - 具有订阅的类型安全 GraphQL API
4. **WebSocket** - 使用 Durable Objects 的实时更新

每个模板包括：

- 完整的源代码
- 配置文件
- 数据库迁移
- 测试
- 部署指南
- 最佳实践

**目标受众**：开始新项目的开发者、学习示例

## 快速链接

- [项目 README](../README.md)
- [贡献指南](../CONTRIBUTING.md)
- [更新日志](../CHANGELOG.md)
- [许可证](../LICENSE)

## 文档标准

添加新文档时：

1. **规范**（`docs/specs/`）：
   - 技术标准和要求
   - 架构决策
   - 代码风格指南
   - 配置规范

2. **功能**（`docs/features/`）：
   - 功能公告
   - 发布说明
   - 面向用户的文档
   - API 使用指南

3. **分析**（`docs/analysis/`）：
   - 性能分析
   - 技术调查
   - 基准测试报告
   - 研究文档

4. **命名约定**：
   - 使用描述性名称：`FEATURE_NAME.md`
   - 发布版本包含版本号：`FEATURES_vX.Y.Z.md`（例如：`FEATURES_v0.3.0.md`）
   - 重要文档使用大写：`CLAUDE_SPEC.md`
   - 分析文档使用下划线：`bundle_size_analysis.md`

## 维护

- 每季度审查文档的准确性
- 当技术决策发生变化时更新规范
- 将过时的文档归档到 `docs/archive/`
- 保持 README.md 索引最新

---

**最后更新**：2025-10-14
**维护者**：Refine SQLx 团队
