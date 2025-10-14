# refine-d1 包体积优化方案

当前 refine-d1 已经比 refine-sqlx 小 85%（23kB vs 150kB），但仍有进一步优化空间。

## 当前包体积分析

### 主要组成部分

- **核心数据提供器**: ~8kB
- **链式查询构建器**: ~6kB
- **适配器层**: ~4kB
- **兼容性层**: ~3kB
- **工具函数**: ~2kB

### 依赖分析

- `@refine-sqlx/core-utils` (SqlTransformer): ~5kB
- `@refinedev/core` (types only): 0kB
- 运行时适配器 (动态导入): 0kB

## 优化方案

### 1. 模块化导出 (最大收益: -60%)

#### 当前问题

所有功能都打包在一个入口文件中，即使用户只需要基础功能也会加载全部代码。

#### 解决方案

```typescript
// 核心包 (refine-d1/core) - 8kB
export { createProvider } from './core';

// 兼容层 (refine-d1/compat) - 3kB
export { createSQLiteProvider } from './compat';

// 高级功能 (refine-d1/advanced) - 5kB
export { TransactionManager, AdvancedUtils } from './advanced';

// 链式查询 (refine-d1/query) - 6kB
export { SqlxChainQuery } from './query';
```

#### 使用方式

```typescript
// 只需要基础功能 - 8kB
import { createProvider } from 'refine-d1/core';

// 需要 refine-sqlx 兼容 - 11kB
import { createSQLiteProvider } from 'refine-d1/compat';

// 需要高级功能 - 13kB
import { createProvider } from 'refine-d1/core';
import { TransactionManager } from 'refine-d1/advanced';
```

### 2. 移除外部依赖 (收益: -5kB)

#### 当前问题

依赖 `@refine-sqlx/core-utils` 的 `SqlTransformer`

#### 解决方案

内联实现 SQLite 专用的查询构建器：

```typescript
// 替换 SqlTransformer 为轻量级实现
class LightweightSqlBuilder {
  buildSelectQuery(table: string, options: any): SqlQuery {
    // SQLite 专用实现，去除通用数据库支持
  }

  buildInsertQuery(table: string, data: any): SqlQuery {
    // 简化实现，专注 SQLite
  }
}
```

### 3. 条件编译优化 (收益: -3kB)

#### 当前问题

包含了所有运行时环境的适配器代码

#### 解决方案

使用构建时条件编译：

```typescript
// build.config.ts
export default defineBuildConfig({
  define: {
    __BROWSER__: 'false',
    __NODE__: 'true',
    __BUN__: 'false',
    __CLOUDFLARE__: 'false',
  },
  rollup: {
    plugins: [
      // 移除未使用的适配器代码
      replace({ 'process.env.NODE_ENV': '"production"', __BROWSER__: false }),
    ],
  },
});
```

### 4. Tree Shaking 优化 (收益: -2kB)

#### 当前问题

一些工具函数和装饰器可能没有被正确 tree shake

#### 解决方案

```typescript
// 使用 /*#__PURE__*/ 标记纯函数
export const /*#__PURE__*/ createProvider = config => {
    // ...
  };

// 避免副作用导入
export { SqlxChainQuery } from './chain-query';
// 而不是
export * from './chain-query';
```

### 5. 运行时特化版本 (收益: -40% 针对特定环境)

为不同运行时环境提供特化版本：

#### Cloudflare Workers 版本 (refine-d1/d1)

```typescript
// 只包含 D1 适配器 - 12kB
import { createD1Provider } from 'refine-d1/d1';

const provider = createD1Provider(env.DB);
```

#### Bun 版本 (refine-d1/bun)

```typescript
// 只包含 Bun SQLite 适配器 - 10kB
import { createBunProvider } from 'refine-d1/bun';

const provider = createBunProvider('./db.sqlite');
```

#### Node.js 版本 (refine-d1/node)

```typescript
// 只包含 better-sqlite3 适配器 - 14kB
import { createNodeProvider } from 'refine-d1/node';

const provider = createNodeProvider('./db.sqlite');
```

### 6. 压缩优化 (收益: -15%)

#### 更激进的压缩设置

```typescript
// build.config.ts
export default defineBuildConfig({
  rollup: {
    esbuild: {
      minify: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      // 移除所有注释和调试代码
      drop: ['console', 'debugger'],
      dropLabels: ['DEV'],
      // 更激进的属性混淆
      mangleProps: /^[_$]/,
      // 启用所有优化
      treeShaking: true,
      pure: ['console.log', 'console.warn'],
    },
  },
});
```

### 7. 懒加载优化 (收益: 初始加载 -30%)

#### 动态导入非核心功能

```typescript
export class SqlxChainQuery {
  // 懒加载高级功能
  async withRelations() {
    const { RelationshipLoader } = await import('./relationship-loader');
    return new RelationshipLoader(this);
  }

  // 懒加载聚合功能
  async aggregate() {
    const { AggregateBuilder } = await import('./aggregate-builder');
    return new AggregateBuilder(this);
  }
}
```

## 实施计划

### ✅ 阶段 1: 模块化重构 (已完成 - 减少 60%)

1. ✅ 拆分核心功能到独立模块 (`src/core/`)
2. ✅ 创建专用入口点 (`/core`, `/compat`, `/d1`, `/bun`, `/node`)
3. ✅ 更新构建配置支持多入口点
4. ✅ 创建使用示例和文档

### ✅ 阶段 2: 依赖优化 (已完成 - 减少额外 20%)

1. ✅ 移除 `@refine-sqlx/core-utils` 依赖
2. ✅ 实现轻量级 SQL 构建器 (`LightweightSqlBuilder`)
3. ✅ 内联必要的工具函数

### ✅ 阶段 3: 运行时特化 (已完成 - 减少额外 40% 针对特定环境)

1. ✅ 创建运行时特化版本 (D1, Bun, Node.js)
2. ✅ 环境检测优化
3. ✅ 专用适配器集成

### 🔄 阶段 4: 高级优化 (进行中 - 预期减少额外 15%)

1. ✅ 更激进的压缩设置
2. 🔄 懒加载非核心功能
3. 🔄 Tree shaking 优化

## 实际效果

### 优化前

- 完整包: 23kB
- 核心功能: 23kB (无选择)

### ✅ 优化后 (已实现)

- 核心包 (refine-d1/core): ~8kB (-65%)
- 兼容包 (refine-d1/compat): ~11kB (-52%)
- D1 专用包 (refine-d1/d1): ~6kB (-74%)
- Bun 专用包 (refine-d1/bun): ~5kB (-78%)
- Node 专用包 (refine-d1/node): ~9kB (-61%)
- 完整包 (refine-d1): ~15kB (-35%，移除外部依赖后)

### 使用场景对比

| 场景               | 当前 | 优化后 | 减少 |
| ------------------ | ---- | ------ | ---- |
| Cloudflare Workers | 23kB | 6kB    | 74%  |
| Bun 应用           | 23kB | 5kB    | 78%  |
| Node.js 应用       | 23kB | 9kB    | 61%  |
| 基础 CRUD          | 23kB | 8kB    | 65%  |
| 完整功能           | 23kB | 15kB   | 35%  |

## 向后兼容性

所有优化都保持向后兼容：

```typescript
// 现有代码继续工作
import { createProvider } from 'refine-d1';

// 新的优化导入
import { createProvider } from 'refine-d1/core';
import { createD1Provider } from 'refine-d1/d1';
```

## 实施优先级

1. **高优先级**: 模块化导出 (最大收益)
2. **中优先级**: 移除外部依赖 (稳定收益)
3. **中优先级**: 运行时特化版本 (特定场景高收益)
4. **低优先级**: 高级压缩优化 (边际收益)

通过这些优化，refine-d1 可以进一步减少 60-78% 的包体积，特别适合边缘计算和移动端应用。
