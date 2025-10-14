# D1 构建版包大小分析

## 目标：30KB (gzipped) 以内

### 当前依赖分析

#### 核心依赖
- **drizzle-orm/d1**: ~7.4KB (minified + gzipped) ✅
- **drizzle-orm/sqlite-core**: ~3-5KB (部分模块) ✅

#### 我们的代码估算
- **Refine DataProvider 接口实现**: ~5-8KB
- **工具函数和辅助方法**: ~2-3KB
- **类型定义**: ~1-2KB (会被 tree-shake)

### 总计估算

| 组件 | 未压缩 | Minified | Gzipped |
|------|--------|----------|---------|
| drizzle-orm/d1 | ~40KB | ~15KB | ~7.4KB |
| drizzle-orm/sqlite-core (部分) | ~20KB | ~8KB | ~3KB |
| Refine DataProvider | ~25KB | ~10KB | ~4KB |
| 工具函数 | ~10KB | ~4KB | ~1.5KB |
| **总计** | **~95KB** | **~37KB** | **~16KB** ✅

### 结论：完全可行！

**预期 D1 构建版大小：15-20KB (gzipped)**

这比目标 30KB 小得多，有充足的优化空间。

---

## 极限优化方案

如果需要进一步压缩到 < 10KB，可以采用以下策略：

### 1. 最小化 Drizzle 导入

```typescript
// ✅ 仅导入必需的模块
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or } from 'drizzle-orm/expressions';

// ❌ 避免导入整个 sqlite-core
// import * as sqliteCore from 'drizzle-orm/sqlite-core';
```

**节省**: ~2-3KB

### 2. 精简 Refine DataProvider 方法

只实现 D1 环境常用的方法：

```typescript
export function createRefineD1Lite(db: D1Database) {
  return {
    // 核心方法
    getList: async (params) => { /* ... */ },
    getOne: async (params) => { /* ... */ },
    create: async (params) => { /* ... */ },
    update: async (params) => { /* ... */ },
    deleteOne: async (params) => { /* ... */ },

    // 可选方法（按需导入）
    // getMany, createMany, updateMany, deleteMany
  };
}
```

**节省**: ~3-5KB

### 3. 内联小型工具函数

```typescript
// ❌ 独立工具函数文件
import { buildWhereClause } from './utils';

// ✅ 内联到主文件（让 bundler 优化）
const buildWhereClause = (filters) => { /* ... */ };
```

**节省**: ~1-2KB

### 4. 使用 Brotli 压缩

Cloudflare Workers 支持 Brotli，比 gzip 压缩率更高：

```typescript
// wrangler.toml
[build.upload]
format = "modules"
main = "./dist/d1.mjs"
compression = "brotli"  # 比 gzip 节省 15-20%
```

**节省**: ~2-3KB

### 5. 条件编译

```typescript
// build-time 条件移除
const IS_D1 = true;

if (IS_D1) {
  // D1 专用代码
} else {
  // 其他环境代码（会被移除）
}
```

**节省**: ~2-4KB

---

## 极限优化后的包大小

| 策略 | 节省 (gzipped) |
|------|----------------|
| 最小化 Drizzle 导入 | -2.5KB |
| 精简 DataProvider | -4KB |
| 内联工具函数 | -1.5KB |
| Brotli 压缩 | -2.5KB |
| 条件编译 | -3KB |
| **总节省** | **-13.5KB** |

**极限优化后**: ~16KB - 13.5KB = **2.5-5KB** ✅

---

## 实际构建配置

### build.config.ts (极限优化)

```typescript
import { defineBuildConfig } from 'unbuild';
import { Plugin } from 'rollup';

// 自定义插件：移除未使用代码
const removeUnusedCode = (): Plugin => ({
  name: 'remove-unused-code',
  transform(code, id) {
    if (id.includes('drizzle-orm')) {
      // 移除不需要的导出
      code = code.replace(/export \{ unused.*?\}/g, '');
    }
    return { code };
  }
});

export default defineBuildConfig({
  entries: [
    {
      input: 'src/d1/index',
      outDir: 'dist',
      name: 'd1',
      builder: 'rollup',
      rollup: {
        esbuild: {
          target: 'es2022',
          minify: true,
          minifySyntax: true,
          minifyWhitespace: true,
          minifyIdentifiers: true,
          treeShaking: true,
          platform: 'browser',
          legalComments: 'none',
        },
        resolve: {
          exportConditions: ['workerd', 'worker', 'import'],
        },
        plugins: [
          removeUnusedCode(),
        ],
        output: {
          format: 'es',
          compact: true,
          generatedCode: {
            constBindings: true,
            objectShorthand: true,
          },
        },
      },
    },
  ],
  rollup: {
    emitCJS: false,
    esbuild: {
      minify: true,
    },
  },
  externals: [
    '@cloudflare/workers-types',
    'cloudflare:*',
  ],
});
```

### package.json scripts

```json
{
  "scripts": {
    "build:d1": "unbuild --stub=false --minify",
    "build:d1:analyze": "unbuild --minify && size-limit",
    "size": "size-limit"
  },
  "size-limit": [
    {
      "name": "D1 Build",
      "path": "dist/d1.mjs",
      "limit": "30 KB",
      "gzip": true,
      "brotli": true
    }
  ]
}
```

---

## 基准测试

### 实际包大小目标

| 场景 | 未压缩 | Gzipped | Brotli |
|------|--------|---------|--------|
| **标准构建** | 95KB | 16KB ✅ | 13KB ✅ |
| **优化构建** | 60KB | 10KB ✅ | 8KB ✅ |
| **极限构建** | 35KB | 5KB ✅ | 4KB ✅ |

### Workers 大小限制

- **免费版**: 1MB (未压缩)
- **付费版**: 10MB (未压缩)

我们的 D1 构建版：
- 标准构建：95KB (9.5% 使用率) ✅✅✅
- 优化构建：60KB (6% 使用率) ✅✅✅
- 极限构建：35KB (3.5% 使用率) ✅✅✅

---

## 推荐策略

### 方案 1: 标准构建 (推荐)
- **大小**: ~16KB (gzipped)
- **特点**: 完整功能，易于维护
- **适用**: 大多数场景

### 方案 2: 优化构建
- **大小**: ~10KB (gzipped)
- **特点**: 移除部分高级特性
- **适用**: 对包大小敏感的场景

### 方案 3: 极限构建 (备选)
- **大小**: ~5KB (gzipped)
- **特点**: 仅核心功能，手动优化
- **适用**: 极端包大小要求

---

## 结论

**D1 构建版完全可以做到 30KB 以内！**

- ✅ **标准构建**: ~16KB (gzipped) - 远低于目标
- ✅ **优化构建**: ~10KB (gzipped) - 大幅低于目标
- ✅ **极限构建**: ~5KB (gzipped) - 极致优化

建议采用**标准构建**，既保证功能完整性，又能轻松满足 30KB 的目标。

如果未来需要进一步优化，可以逐步应用优化策略，最终可达到 5KB 的极限大小。

---

## 监控和验证

### CI/CD 集成

```yaml
# .github/workflows/size-check.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  check-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build:d1
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

这样可以确保每次 PR 都检查包大小，防止意外增长。
