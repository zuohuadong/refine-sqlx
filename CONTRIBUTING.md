# Contributing to Refine ORM & Refine SQLx

[English](#english) | [中文](#中文)

## English

Thank you for your interest in contributing to @refine-sqlx/orm and refinProviders project! This guide will help you get started with contributing to our monorepo containing `@refine-sqlx/orm`, `@refine-sqlx/sql`, and `@r@refine-sqlx/ormcore-utils`.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Git
- Basic knowledge of TypeScript and React
- Familiarity with SQL databases

### First Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/@refine-sqlx/sql.git
   cd @refine-sqlx/sql
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/zuohuadong/@refine-sqlx/sql.git
   ```
4. **Install dependencies**:
   ```bash
   bun install
   ```
5. **Build all packages**:
   ```bash
   bun run build
   ```
6. **Run tests** to ensure everything works:
   ```bash
   bun run test
   ```

## Development Setup

### Environment Setup

1. **Copy environment template** (if exists):

   ```bash
   cp .env.example .env
   ```

2. **Set up test databases** (optional, for integration tests):

   ```bash
   # PostgreSQL
   createdb refine_orm_test

   # MySQL
   mysql -e "CREATE DATABASE refine_orm_test;"
   ```

### IDE Configuration

We recommend using VS Code with these extensions:

- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint
- SQLite Viewer (for database inspection)

## Project Structure

```
@refine-sqlx/sql/
├── packages/
│   ├── @refine-sqlx/orm/              # Multi-database ORM provider
│   │   ├── src/
│   │   │   ├── adapters/        # Database adapters
│   │   │   ├── core/            # Core functionality
│   │   │   ├── types/           # Type definitions
│   │   │   ├── utils/           # Utility functions
│   │   │   └── __tests__/       # Unit tests
│   │   ├── test/                # Integration tests
│   │   └── examples/            # Usage examples
│   ├── @refine-sqlx/sql/             # SQLite-focused provider
│   │   ├── src/
│   │   ├── test/
│   │   └── examples/
│   └── @refine-sqlx/core/       # Shared utilities
├── .github/
│   └── workflows/               # CI/CD workflows
├── .changeset/                  # Version management
└── docs/                        # Documentation
```

### Package Responsibilities

- **@refine-sqlx/ormlti-database support with Drizzle ORM
- **@refine-sqlx/sql**: Lightweight SQLite-focused provider
- **@refine-sqlx/core**: Shared utilities and transformers

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-mysql-support`
- `fix/connection-pool-leak`
- `docs/update-readme`
- `refactor/query-builder`

### Making Changes

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Add tests** for new functionality

4. **Run tests** to ensure nothing breaks:

   ```bash
   bun run test
   bun run typecheck
   ```

5. **Format code**:

   ```bash
   bun run format
   ```

6. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add MySQL connection pooling support"
   ```

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(orm): add PostgreSQL connection pooling
fix(sql): resolve memory leak in chain queries
docs: update installation instructions
test(orm): add integration tests for MySQL adapter
```

## Testing

### Running Tests

```
# Run all tests
bun run test

# Run tests for specific package
bun run --filter='@refine-sqlx/orm' test
bun run --filter='@refine-sqlx/sql' test

# Run integration tests
bun run test:integration

# Run tests with coverage
bun run test --coverage
```

### Test Structure

- **Unit tests**: Located in `src/__tests__/` directories
- **Integration tests**: Located in `test/` directories
- **Mock tests**: Use mock databases for isolated testing

### Writing Tests

1. **Unit tests** should test individual functions/classes
2. **Integration tests** should test end-to-end functionality
3. **Use descriptive test names** that explain what is being tested
4. **Follow the AAA pattern**: Arrange, Act, Assert

Example:

```
describe('RefineQueryBuilder', () => {
  describe('buildWhereConditions', () => {
    it('should build correct WHERE clause for eq operator', () => {
      // Arrange
      const filters = [{ field: 'name', operator: 'eq', value: 'John' }];

      // Act
      const result = queryBuilder.buildWhereConditions(table, filters);

      // Assert
      expect(result).toBeDefined();
      expect(result.toString()).toContain('name = $1');
    });
  });
});
```

## Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include examples in documentation
- Document complex algorithms and business logic

Example:

````typescript
/**
 * Creates a PostgreSQL data provider with automatic runtime detection.
 *
 * @param connectionString - PostgreSQL connection string
 * @param schema - Drizzle schema object
 * @param options - Optional configuration
 * @returns Configured data provider
 *
 * @example
 * ```typescript
 * const provider = createPostgreSQLProvider(
 *   'postgresql://user:pass@localhost/db',
 *   { users, posts }
 * );
 * ```
 */
export function createPostgreSQLProvider<TSchema>(
  connectionString: string,
  schema: TSchema,
  options?: PostgreSQLOptions
): RefineOrmDataProvider<TSchema> {
  // Implementation
}
````

### README Updates

When adding new features:

1. Update the relevant package README
2. Add usage examples
3. Update the main project README if needed

## Submitting Changes

### Pull Request Process

1. **Update your branch** with the latest upstream changes:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes**:

   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear title and description
   - Reference to related issues
   - Screenshots/examples if applicable
   - Checklist of changes made

### Pull Request Template

```
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainers
3. **Testing** in different environments
4. **Approval** and merge

## Release Process

We use [Changesets](https://github.com/changesets/changesets) for version management:

### Creating a Changeset

1. **Add a changeset** for your changes:

   ```bash
   bun run changeset
   ```

2. **Follow the prompts** to describe your changes

3. **Commit the changeset** with your PR

### Release Types

- **Patch** (0.0.X): Bug fixes, small improvements
- **Minor** (0.X.0): New features, non-breaking changes
- **Major** (X.0.0): Breaking changes

## Best Practices

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Use meaningful variable and function names
- Keep functions small and focused
- Prefer composition over inheritance

### Performance

- Consider performance implications of changes
- Use connection pooling for database operations
- Implement proper error handling
- Add logging for debugging

### Security

- Validate all inputs
- Use parameterized queries to prevent SQL injection
- Handle sensitive data appropriately
- Follow security best practices

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Discord**: Real-time chat with the community

### Resources

- [Refine Documentation](https://refine.dev/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Bun Documentation](https://bun.sh/docs)

## Recognition

Contributors are recognized in:

- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to making Refine database providers better for everyone! 🎉

---

## 中文

感谢您对 @refine-sqlx/orm 和 @refine-sqlx/sql 项目的贡献兴趣！本指南将帮助您开始为我们的 monorepo 做贡献，该仓库包含 `r@refine-sqlx/orm、`@refine-sqlx/sql` 和 `@re@refine-sqlx/ormore-utils`。

## 目录

- [行为准则](#行为准则)
- [开始使用](#开始使用)
- [开发设置](#开发设置)
- [项目结构](#项目结构)
- [开发工作流](#开发工作流)
- [测试](#测试)
- [文档](#文档)
- [提交更改](#提交更改)
- [发布流程](#发布流程)

## 行为准则

本项目遵循行为准则。通过参与，您需要遵守此准则。请向项目维护者报告不当行为。

## 开始使用

### 前置要求

- [Bun](https://bun.sh)（推荐）或 Node.js 18+
- Git
- TypeScript 和 React 基础知识
- SQL 数据库相关知识

### 首次设置

1. **在 GitHub 上 Fork 仓库**
2. **本地克隆您的 fork**：
   ```bash
   git clone https://github.com/YOUR_USERNAME/@refine-sqlx/sql.git
   cd @refine-sqlx/sql
   ```
3. **添加上游远程仓库**：
   ```bash
   git remote add upstream https://github.com/zuohuadong/@refine-sqlx/sql.git
   ```
4. **安装依赖**：
   ```bash
   bun install
   ```
5. **构建所有包**：
   ```bash
   bun run build
   ```
6. **运行测试**确保一切正常：
   ```bash
   bun run test
   ```

## 开发设置

### 环境设置

1. **复制环境模板**（如果存在）：

   ```bash
   cp .env.example .env
   ```

2. **设置测试数据库**（可选，用于集成测试）：

   ```bash
   # PostgreSQL
   createdb refine_orm_test

   # MySQL
   mysql -e "CREATE DATABASE refine_orm_test;"
   ```

### IDE 配置

我们推荐使用 VS Code 并安装以下扩展：

- TypeScript and JavaScript Language Features
- Prettier - Code formatter
- ESLint
- SQLite Viewer（用于数据库检查）

## 项目结构

```
@refine-sqlx/sql/
├── packages/
│   ├── @refine-sqlx/orm/              # 多数据库 ORM 提供器
│   │   ├── src/
│   │   │   ├── adapters/        # 数据库适配器
│   │   │   ├── core/            # 核心功能
│   │   │   ├── types/           # 类型定义
│   │   │   ├── utils/           # 工具函数
│   │   │   └── __tests__/       # 单元测试
│   │   ├── test/                # 集成测试
│   │   └── examples/            # 使用示例
│   ├── @refine-sqlx/sql/             # SQLite 专用提供器
│   │   ├── src/
│   │   ├── test/
│   │   └── examples/
│   └── @refine-sqlx/core/       # 共享工具
├── .github/
│   └── workflows/               # CI/CD 工作流
├── .changeset/                  # 版本管理
└── docs/                        # 文档
```

### 包职责

- **@refine-sqlx/orm**: 使用 Drizzle ORM 的多数据库支持
- **@refine-sqlx/sql**: 轻量级 SQLite 专用提供器
- **@refine-sqlx/core**: 共享工具和转换器

## 开发工作流

### 分支命名

使用描述性的分支名称：

- `feature/add-mysql-support`
- `fix/connection-pool-leak`
- `docs/update-readme`
- `refactor/query-builder`

### 进行更改

1. **创建功能分支**：

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **按照我们的编码标准进行更改**

3. **为新功能添加测试**

4. **运行测试**确保没有破坏任何功能：

   ```bash
   bun run test
   bun run typecheck
   ```

5. **格式化代码**：

   ```bash
   bun run format
   ```

6. **提交更改**：
   ```bash
   git add .
   git commit -m "feat: add MySQL connection pooling support"
   ```

### 提交消息格式

我们遵循 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

类型：

- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更改
- `style`: 代码样式更改（格式化等）
- `refactor`: 代码重构
- `test`: 添加或更新测试
- `chore`: 维护任务

示例：

```
feat(orm): add PostgreSQL connection pooling
fix(sql): resolve memory leak in chain queries
docs: update installation instructions
test(orm): add integration tests for MySQL adapter
```

## 测试

### 运行测试

```
# 运行所有测试
bun run test

# 运行特定包的测试
bun run --filter='@refine-sqlx/orm' test
bun run --filter='@refine-sqlx/sql' test

# 运行集成测试
bun run test:integration

# 运行带覆盖率的测试
bun run test --coverage
```

### 测试结构

- **单元测试**: 位于 `src/__tests__/` 目录
- **集成测试**: 位于 `test/` 目录
- **模拟测试**: 使用模拟数据库进行隔离测试

### 编写测试

1. **单元测试**应该测试单个函数/类
2. **集成测试**应该测试端到端功能
3. **使用描述性测试名称**解释正在测试的内容
4. **遵循 AAA 模式**: Arrange, Act, Assert

示例：

```
describe('RefineQueryBuilder', () => {
  describe('buildWhereConditions', () => {
    it('should build correct WHERE clause for eq operator', () => {
      // Arrange
      const filters = [{ field: 'name', operator: 'eq', value: 'John' }];

      // Act
      const result = queryBuilder.buildWhereConditions(table, filters);

      // Assert
      expect(result).toBeDefined();
      expect(result.toString()).toContain('name = $1');
    });
  });
});
```

## 文档

### 代码文档

- 为公共 API 使用 JSDoc 注释
- 在文档中包含示例
- 记录复杂算法和业务逻辑

示例：

````typescript
/**
 * 创建具有自动运行时检测的 PostgreSQL 数据提供器。
 *
 * @param connectionString - PostgreSQL 连接字符串
 * @param schema - Drizzle 模式对象
 * @param options - 可选配置
 * @returns 配置的数据提供器
 *
 * @example
 * ```typescript
 * const provider = createPostgreSQLProvider(
 *   'postgresql://user:pass@localhost/db',
 *   { users, posts }
 * );
 * ```
 */
export function createPostgreSQLProvider<TSchema>(
  connectionString: string,
  schema: TSchema,
  options?: PostgreSQLOptions
): RefineOrmDataProvider<TSchema> {
  // 实现
}
````

### README 更新

添加新功能时：

1. 更新相关包的 README
2. 添加使用示例
3. 如需要，更新主项目 README

## 提交更改

### Pull Request 流程

1. **使用最新的上游更改更新您的分支**：

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **推送您的更改**：

   ```bash
   git push origin feature/your-feature-name
   ```

3. **在 GitHub 上创建 Pull Request**，包含：
   - 清晰的标题和描述
   - 相关问题的引用
   - 截图/示例（如适用）
   - 更改清单

### Pull Request 模板

```
## 描述

更改的简要描述。

## 更改类型

- [ ] 错误修复
- [ ] 新功能
- [ ] 破坏性更改
- [ ] 文档更新

## 测试

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成

## 检查清单

- [ ] 代码遵循项目样式指南
- [ ] 完成自我审查
- [ ] 文档已更新
- [ ] 测试已添加/更新
```

### 审查流程

1. **自动检查**必须通过（CI/CD）
2. 维护者**代码审查**
3. 在不同环境中**测试**
4. **批准**和合并

## 发布流程

我们使用 [Changesets](https://github.com/changesets/changesets) 进行版本管理：

### 创建 Changeset

1. **为您的更改添加 changeset**：

   ```bash
   bun run changeset
   ```

2. **按照提示**描述您的更改

3. **将 changeset 与您的 PR 一起提交**

### 发布类型

- **Patch** (0.0.X): 错误修复，小改进
- **Minor** (0.X.0): 新功能，非破坏性更改
- **Major** (X.0.0): 破坏性更改

## 最佳实践

### 代码风格

- 所有新代码使用 TypeScript
- 遵循现有代码模式
- 使用有意义的变量和函数名
- 保持函数小而专注
- 优先使用组合而非继承

### 性能

- 考虑更改的性能影响
- 为数据库操作使用连接池
- 实现适当的错误处理
- 添加调试日志

### 安全

- 验证所有输入
- 使用参数化查询防止 SQL 注入
- 适当处理敏感数据
- 遵循安全最佳实践

## 获取帮助

### 沟通渠道

- **GitHub Issues**: 错误报告和功能请求
- **GitHub Discussions**: 问题和一般讨论
- **Discord**: 与社区实时聊天

### 资源

- [Refine 文档](https://refine.dev/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [TypeScript 手册](https://www.typescriptlang.org/docs)
- [Bun 文档](https://bun.sh/docs)

## 认可

贡献者将在以下地方得到认可：

- GitHub 贡献者列表
- 发布说明
- 项目文档

感谢您为让 Refine 数据库提供器变得更好而做出的贡献！🎉
