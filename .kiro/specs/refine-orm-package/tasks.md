# Implementation Plan

- [x] 1. 设置 Monorepo 结构和 npm 包配置
  - 重构项目为 Bun workspace 结构
  - 创建 packages 目录并迁移现有 refine-sqlx 代码
  - 配置根目录的 package.json 和 bunfig.toml
  - 设置 Changeset 版本管理工具
  - 配置 npm 包的 exports、types、peerDependencies
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. 创建 refine-orm npm 包的基础结构
  - 创建 packages/refine-orm 目录结构
  - 配置 package.json 用于 npm 发布（包名、版本、依赖）
  - 设置 TypeScript 配置和构建脚本（ESM + CJS 输出）
  - 配置 drizzle-orm 和数据库驱动为 peerDependencies
  - 创建基础的 src 目录结构（types, core, adapters, utils）
  - 设置主入口文件 index.ts 和类型声明
  - _Requirements: 1.1, 5.1_

- [x] 3. 实现核心类型定义
  - 创建 RefineOrmDataProvider 接口定义
  - 实现 drizzle schema 相关的类型推断
  - 定义数据库配置和选项接口
  - 创建错误类型定义和错误处理类
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. 实现 PostgreSQL 适配器
  - 创建 PostgreSQL 数据库适配器类
  - 实现运行时检测：Bun 环境使用 bun:sql，Node.js 环境使用 postgres 驱动
  - 实现连接管理和连接池支持
  - 集成 drizzle-orm 的 PostgreSQL 驱动（drizzle-orm/bun-sql 和 drizzle-orm/postgres-js）
  - 实现基础的 CRUD 操作方法
  - _Requirements: 1.1, 1.2, 7.3_

- [x] 5. 实现 MySQL 适配器
  - 创建 MySQL 数据库适配器类
  - 所有环境都使用 mysql2 驱动
  - 实现连接管理和连接池支持
  - 集成 drizzle-orm 的 MySQL 驱动（drizzle-orm/mysql2）
  - 添加未来 bun:sql MySQL 支持的检测和切换逻辑
  - 实现基础的 CRUD 操作方法
  - _Requirements: 1.1, 1.2, 7.3_

- [x] 6. 实现 SQLite 适配器
  - 创建 SQLite 数据库适配器类
  - 实现运行时检测：Bun 环境使用 bun:sqlite，Node.js 环境使用 better-sqlite3
  - 支持多种 SQLite 运行时（Bun、Node.js、Cloudflare D1）
  - 集成 drizzle-orm 的 SQLite 驱动（drizzle-orm/bun-sqlite 和 drizzle-orm/better-sqlite3）
  - 实现基础的 CRUD 操作方法
  - _Requirements: 1.1, 1.2, 7.3_

- [x] 7. 实现查询构建器
  - 创建 RefineQueryBuilder 类
  - 实现过滤器转换逻辑，支持所有 Refine 过滤器操作符
  - 实现排序和分页功能
  - 添加复杂查询和关联查询支持
  - _Requirements: 2.2, 2.4_

- [x] 8. 实现类型安全的 CRUD 操作
  - 实现 getList 方法，支持类型推断
  - 实现 getOne 和 getMany 方法
  - 实现 create 和 createMany 方法
  - 实现 update 和 updateMany 方法
  - 实现 delete 和 deleteMany 方法
  - _Requirements: 2.1, 2.4, 5.2_

- [x] 9. 实现事务管理
  - 创建事务管理器类
  - 实现跨数据库的统一事务接口
  - 添加事务回滚和错误处理机制
  - 支持嵌套事务（如果数据库支持）
  - _Requirements: 2.3, 7.1_

- [x] 10. 实现链式查询构建器
  - 创建 ChainQueryBuilder 和 ChainQuery 类
  - 实现 where、orderBy、limit、offset 等链式方法
  - 添加 paginate 便捷分页方法
  - 实现 get、first、count、sum、avg 等执行方法
  - _Requirements: 2.2, 7.4_

- [x] 11. 实现多态关联功能
  - 创建 MorphQuery 类和 MorphConfig 接口
  - 实现多态关联的自动数据加载
  - 支持一对多和多对多的多态关系
  - 添加多态关联的类型推断支持
  - _Requirements: 2.2, 2.4_

- [x] 12. 实现关系查询功能
  - 创建关系查询构建器
  - 实现 getWithRelations 方法和链式 with 方法
  - 支持一对一、一对多、多对多关系
  - 添加关系数据的预加载和懒加载功能
  - _Requirements: 2.2, 2.4_

- [x] 13. 实现原生查询构建器
  - 创建 SelectChain、InsertChain、UpdateChain、DeleteChain 类
  - 实现类型安全的 select、insert、update、delete 链式操作
  - 添加 distinct、groupBy、having 等高级查询功能
  - 支持 onConflict、returning 等数据库特定功能
  - _Requirements: 2.2, 7.2_

- [x] 14. 创建用户友好的 API 和工厂函数
  - 实现 createPostgreSQLProvider 函数，支持 Bun 和 Node.js 环境自动检测
  - 实现 createMySQLProvider 函数，暂时统一使用 mysql2 驱动（等待 bun:sql 支持）
  - 实现 createSQLiteProvider 函数，支持多运行时环境
  - 添加通用的 createRefine 函数
  - 创建运行时检测和数据库支持检测工具函数
  - 设计简洁的配置选项，最小化用户配置负担
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 1.3, 5.4_

- [x] 15. 完善错误类型定义
  - 定义标准化的错误类型和接口
  - 添加详细的错误信息和错误代码
  - 确保错误信息对开发者友好
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 7.1_

- [x] 16. 编写单元测试
  - 为所有核心类和方法编写单元测试
  - 创建 mock 数据库客户端用于测试
  - 测试类型推断和类型安全功能
  - 添加错误处理和边界情况测试
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 5.3_

- [x] 17. 编写集成测试
  - 设置测试数据库环境（PostgreSQL、MySQL、SQLite）
  - 创建端到端的 CRUD 操作测试
  - 测试事务和关系查询功能
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 2.1, 2.2, 2.3, 7.1_

- [x] 18. 编写基础兼容性测试
  - 测试基本 CRUD 操作在不同数据库上的一致性
  - 验证类型推断的正确性
  - 修复 MySQL 适配器测试中的 TypeScript 错误
  - ✅ 已完成：移除废弃的 legacy 兼容性函数，使用 SqlTransformer 替代
  - 修复 utils 测试中的导入和期望值问题
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 1.1, 1.3_

- [x] 19. 配置 npm 包构建和发布流程
  - 设置 TypeScript 构建配置（生成 ESM 和 CJS 两种格式）
  - 配置 package.json 的 exports 字段支持双模块
  - 设置类型声明文件的正确导出
  - 配置 .npmignore 和 files 字段，确保只发布必要文件
  - 添加构建前的类型检查和测试验证
  - 添加 prepublishOnly 脚本确保发布前的质量检查
  - 配置包元数据（keywords, homepage, bugs, author）
  - 测试 npm pack 确保包内容正确
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 4.1, 4.2_

- [x] 20. 实现 GitHub Actions CI/CD 和 npm 自动发布
  - 创建持续集成工作流（多 Node.js 版本、多数据库测试）
  - 配置 Changeset 自动发布工作流
  - 设置 npm 包发布权限和 NPM_TOKEN
  - 添加发布前的构建、测试、类型检查验证
  - 支持多包版本管理和并行发布
  - 配置发布后的 GitHub Release 创建
  - 创建 TypeScript 项目配置和类型检查脚本
  - 配置 Changeset 工具用于版本管理
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 21. 编写用户文档和使用示例
  - 创建 README.md 包含安装指南和基本使用方法
  - 编写 API 文档和 TypeScript 类型说明
  - 添加不同数据库的完整使用示例
  - 编写故障排除和常见问题解答
  - 创建主项目 README 和贡献指南
  - 为每个包创建详细的文档和示例
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 6.3_

- [x] 22. 基础性能优化
  - 添加连接池优化配置（drizzle-orm 已经有相应）
  - 优化批量操作的性能
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 7.1_

- [x] 23. 增强 refine-sqlx 包，集成 ORM 兼容功能
  - 创建 SqlxChainQuery 类，基于现有 SQL 客户端实现链式查询
  - 实现 SqlxMorphQuery 类，提供轻量级多态关联功能
  - 更新 createRefineSQL 函数，默认包含链式查询和多态关联功能
  - 添加类型安全的 getTyped、createTyped 等方法
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 6.1, 6.2_

- [x] 24. 实现统一的类型系统和接口
  - 创建 EnhancedDataProvider 接口，统一传统和链式 API
  - 实现可选的 schema 类型推断和验证
  - 添加多态关联的类型定义和配置接口
  - 尽量保持 refine-sqlx 向 refine-orm 的 API 兼容性
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 6.3, 6.4_

- [x] 25. npm 包发布前的最终准备
  - 集成所有组件并进行端到端测试
  - 修复发现的 TypeScript 类型错误和构建问题
  - 完成 package.json 元数据（description、keywords、repository）
  - 验证 npm 包的安装和使用流程
  - 准备初始版本的发布说明和 CHANGELOG
  - 进行 npm pack 测试，确保包内容正确
  - 设置 npm 包的访问权限和发布策略
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 5.3, 4.4_

- [x] 26. npm 包质量和兼容性保证
  - 配置 TypeScript 严格模式和类型检查
  - 设置 ESLint 和 Prettier 代码规范
  - 实现 Tree-shaking 支持和按需导入
  - 配置包大小监控和优化
  - 测试不同 Node.js 版本的兼容性（16+, 18+, 20+）
  - 验证 ESM/CJS 双模块正确性
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 4.1, 5.3_

- [x] 27. 用户体验优化和社区准备
  - 创建使用示例项目和 CodeSandbox 演示
  - 编写贡献指南和开发环境设置说明
  - 设置 GitHub Issues 模板和 PR 模板
  - 配置 npm 包的关键词和标签，提高可发现性
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 6.3_

- [x] 28. npm 包发布后的维护计划
  - 设置 GitHub Actions CI/CD 流程，发布 release 时自动触发
  - 配置 npm 包的发布权限和 NPM_TOKEN
  - 建立用户反馈收集机制
  - 设置自动化安全更新流程
  - 制定长期维护和更新计划
  - 建立社区贡献者指南和代码审查流程
  - 计划功能路线图和版本发布周期
  - **执行 TypeScript 类型检查和修复**
  - _Requirements: 4.4_
