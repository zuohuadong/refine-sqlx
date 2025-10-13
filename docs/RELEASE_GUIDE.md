# 📦 NPM 包版本管理与发布指南

## 🎯 版本管理策略对比

### 1. **Changesets（当前推荐）** ⭐⭐⭐⭐⭐

最适合 monorepo，提供灵活的版本控制和变更记录。

```bash
# 创建变更记录
bun run changeset

# 更新版本
bun run version-packages

# 发布到 npm
bun run release

# 检查状态
bun run version:check

# 干运行（不实际发布）
bun run release:dry-run
```

**优点：**

- 完美支持 monorepo
- 变更记录清晰
- 支持关联包版本管理
- GitHub 集成良好

### 2. **Semantic Release（全自动）** ⭐⭐⭐⭐

基于提交信息自动决定版本号。

```bash
# 自动分析提交并发布
bun run release:auto
```

**优点：**

- 完全自动化
- 遵循语义化版本规范
- 自动生成 CHANGELOG
- 自动创建 GitHub Release

**要求：**

- 必须使用约定式提交（Conventional Commits）
- 提交格式：`type(scope): message`

### 3. **Release-It（交互式）** ⭐⭐⭐⭐

提供友好的交互式发布体验。

```bash
# 交互式发布
bun run release:it

# 带预设的发布
npx release-it patch
npx release-it minor
npx release-it major
```

**优点：**

- 交互式界面友好
- 支持预发布版本
- 自动化程度高
- 可自定义 hooks

### 4. **自定义脚本（灵活控制）** ⭐⭐⭐

使用我们的自定义版本管理器。

```bash
# 运行交互式版本管理器
bun run release:interactive
```

**优点：**

- 完全控制版本流程
- 支持多种策略选择
- 适合特殊需求

### 5. **Lerna（企业级）** ⭐⭐⭐

适合大型 monorepo 项目。

```bash
# Lerna 发布
bun run release:lerna

# 独立版本模式
npx lerna version independent

# 固定版本模式
npx lerna version --conventional-commits
```

## 📝 约定式提交规范

使用约定式提交来自动化版本管理：

### 提交类型与版本影响

| 类型       | 描述     | 版本影响 | 示例                             |
| ---------- | -------- | -------- | -------------------------------- |
| `feat`     | 新功能   | Minor    | `feat: add new query builder`    |
| `fix`      | Bug 修复 | Patch    | `fix: resolve connection issue`  |
| `docs`     | 文档     | 无       | `docs: update API guide`         |
| `style`    | 代码格式 | 无       | `style: format code`             |
| `refactor` | 重构     | 无       | `refactor: optimize query logic` |
| `perf`     | 性能优化 | Patch    | `perf: improve query speed`      |
| `test`     | 测试     | 无       | `test: add unit tests`           |
| `build`    | 构建系统 | 无       | `build: update webpack config`   |
| `ci`       | CI/CD    | 无       | `ci: update GitHub Actions`      |
| `chore`    | 杂项     | 无       | `chore: update dependencies`     |
| `revert`   | 回滚     | Patch    | `revert: revert commit abc123`   |

### Breaking Changes（主版本）

```bash
# 方式 1：使用 ! 标记
feat!: redesign API structure

# 方式 2：在 footer 中说明
feat: redesign API structure

BREAKING CHANGE: The API structure has been completely redesigned.
Old methods are no longer available.
```

## 🚀 推荐的发布流程

### 标准发布流程

```bash
# 1. 确保代码是最新的
git pull origin main

# 2. 创建变更记录
bun run changeset

# 3. 查看待发布的变更
bun run version:check

# 4. 更新版本号
bun run version-packages

# 5. 构建和测试
bun run prerelease

# 6. 发布到 npm
bun run release

# 7. 推送到 GitHub
bun run postrelease
```

### 自动化 CI/CD 发布

推送到 main 分支后，GitHub Actions 会自动：

1. 运行测试
2. 构建包
3. 创建 Release PR
4. 合并后自动发布到 npm

## 🏷️ 版本标签策略

### 正式版本

```bash
# 生产版本
v1.0.0
v1.1.0
v2.0.0
```

### 预发布版本

```bash
# Alpha（内部测试）
v1.0.0-alpha.0
v1.0.0-alpha.1

# Beta（公开测试）
v1.0.0-beta.0
v1.0.0-beta.1

# RC（候选版本）
v1.0.0-rc.0
v1.0.0-rc.1
```

### 标签管理

```bash
# Canary（每日构建）
npm publish --tag canary

# Next（下一版本预览）
npm publish --tag next

# Latest（稳定版）
npm publish --tag latest
```

## 🔄 版本回滚

如果发布出现问题：

```bash
# 1. 撤销 npm 发布（24小时内）
npm unpublish package-name@version

# 2. 标记为废弃
npm deprecate package-name@version "Critical bug, use 1.2.4 instead"

# 3. Git 回滚
git revert <commit-hash>
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

## 📊 版本策略最佳实践

### 1. **语义化版本（SemVer）**

- **Major (x.0.0)**: Breaking changes
- **Minor (1.x.0)**: New features, backward compatible
- **Patch (1.0.x)**: Bug fixes, backward compatible

### 2. **发布频率建议**

- **Patch**: 随时（bug 修复）
- **Minor**: 每 2-4 周
- **Major**: 每 3-6 个月

### 3. **分支策略**

```
main         → 稳定版本
develop      → 开发版本
release/*    → 发布准备
hotfix/*     → 紧急修复
```

### 4. **自动化检查清单**

- ✅ 所有测试通过
- ✅ 代码覆盖率达标
- ✅ 无 lint 错误
- ✅ 文档已更新
- ✅ CHANGELOG 已更新
- ✅ Breaking changes 已记录

## 🛠️ 工具安装

```bash
# Changesets
bun add -d @changesets/cli @changesets/changelog-github

# Semantic Release
bun add -d semantic-release @semantic-release/changelog @semantic-release/git

# Release-It
bun add -d release-it @release-it/conventional-changelog

# Lerna
bun add -d lerna

# Commitizen（帮助写规范提交）
bun add -d commitizen cz-conventional-changelog
```

## 🔗 相关资源

- [Changesets 文档](https://github.com/changesets/changesets)
- [Semantic Release 文档](https://semantic-release.gitbook.io/)
- [Release-It 文档](https://github.com/release-it/release-it)
- [Lerna 文档](https://lerna.js.org/)
- [约定式提交规范](https://www.conventionalcommits.org/)

## 💡 选择建议

| 场景          | 推荐工具           | 原因                 |
| ------------- | ------------------ | -------------------- |
| Monorepo 项目 | Changesets         | 最佳的 monorepo 支持 |
| 完全自动化    | Semantic Release   | 零人工干预           |
| 需要审核      | Release-It         | 交互式确认           |
| 企业级项目    | Lerna + Changesets | 功能最完整           |
| 小型项目      | npm version        | 简单直接             |

---

📌 **当前项目推荐**: 继续使用 **Changesets**，配合 GitHub Actions 自动化，这是目前最优雅的解决方案！
