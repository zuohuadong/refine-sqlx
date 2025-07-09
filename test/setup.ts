/**
 * 统一的测试环境设置文件
 * 支持 Node.js、Bun、Cloudflare Workers 等多环境运行
 */

import { beforeEach, afterEach, vi } from 'vitest';

// 运行时类型定义 - 参考 Hono 的设计
export type Runtime = 'node' | 'deno' | 'bun' | 'workerd' | 'fastly' | 'edge-light' | 'cloudflare-workers' | 'other'

// 已知用户代理 - 参考 Hono 的设计
export const knownUserAgents: Partial<Record<Runtime, string>> = {
  deno: 'Deno',
  bun: 'Bun',
  workerd: 'Cloudflare-Workers',
  node: 'Node.js',
}

// 检查用户代理是否匹配
const checkUserAgentEquals = (platform: string): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return false;
  }
  return navigator.userAgent.startsWith(platform);
}

// 运行时检测 - 参考 Hono 的 getRuntimeKey 实现
export const getRuntimeKey = (): Runtime => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = globalThis as any;

  // 检查当前运行时是否支持 navigator.userAgent
  const userAgentSupported = 
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string';

  // 如果支持，检查用户代理
  if (userAgentSupported) {
    for (const [runtimeKey, userAgent] of Object.entries(knownUserAgents)) {
      if (checkUserAgentEquals(userAgent)) {
        return runtimeKey as Runtime;
      }
    }
  }

  // 检查是否在 Edge Runtime 上运行
  if (typeof global?.EdgeRuntime === 'string') {
    return 'edge-light';
  }

  // 检查是否在 Fastly 上运行
  if (global?.fastly !== undefined) {
    return 'fastly';
  }

  // 检查是否在 Cloudflare Workers 上运行
  if (typeof global?.WorkerGlobalScope !== 'undefined' || 
      typeof global?.ServiceWorkerGlobalScope !== 'undefined') {
    return 'workerd';
  }

  // 检查是否在 Bun 上运行
  if (typeof global?.Bun !== 'undefined') {
    return 'bun';
  }

  // 检查是否在 Deno 上运行
  if (typeof global?.Deno !== 'undefined') {
    return 'deno';
  }

  // userAgent 在 Node v21.1.0 之前不支持，所以回退到旧方法
  if (global?.process?.release?.name === 'node') {
    return 'node';
  }

  // 无法检测运行时
  return 'other';
}

// 当前运行时检测
export const RUNTIME = getRuntimeKey();

export const TEST_RUNTIME = process.env.TEST_RUNTIME || RUNTIME;

// 环境变量检测
export const isCI = process.env.CI === 'true';
export const isRunningInDocker = process.env.DOCKER === 'true';

// 测试数据库配置
export const getTestDbPath = (testName?: string) => {
  const timestamp = Date.now();
  const runtime = TEST_RUNTIME;
  const suffix = testName ? `-${testName}` : '';
  return `test-${runtime}-${timestamp}${suffix}.db`;
};

// 全局 mock 设置
beforeEach(() => {
  // 在每个测试前清理模拟
  vi.clearAllMocks();
});

afterEach(() => {
  // 测试后清理
  vi.restoreAllMocks();
});

// 根据运行时环境配置不同的全局变量
export const setupRuntimeGlobals = () => {
  switch (TEST_RUNTIME) {
    case 'bun':
      setupBunGlobals();
      break;
    case 'workerd':
    case 'cloudflare-workers':
      setupCloudflareGlobals();
      break;
    case 'deno':
      setupDenoGlobals();
      break;
    case 'node':
      setupNodeGlobals();
      break;
    default:
      // 默认 Node.js 环境
      setupNodeGlobals();
  }
};

const setupBunGlobals = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = globalThis as any;
  if (typeof global.Bun === 'undefined') {
    // Mock Bun environment for testing in Node.js
    Object.defineProperty(globalThis, 'Bun', {
      value: {
        version: '1.2.0',
        sqlite: vi.fn(),
      },
      configurable: true,
    });
  }
};

const setupCloudflareGlobals = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = globalThis as any;
  
  // Mock Cloudflare Workers environment
  if (typeof global.WorkerGlobalScope === 'undefined') {
    Object.defineProperty(globalThis, 'WorkerGlobalScope', {
      value: function WorkerGlobalScope() {},
      configurable: true,
    });
  }
  
  // Mock D1 Database
  if (typeof global.D1Database === 'undefined') {
    Object.defineProperty(globalThis, 'D1Database', {
      value: function D1Database() {},
      configurable: true,
    });
  }
};

const setupDenoGlobals = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = globalThis as any;
  
  if (typeof global.Deno === 'undefined') {
    // Mock Deno environment for testing in Node.js
    Object.defineProperty(globalThis, 'Deno', {
      value: {
        version: { deno: '1.40.0' },
        env: {
          toObject: vi.fn().mockReturnValue({}),
          get: vi.fn(),
          set: vi.fn(),
        },
      },
      configurable: true,
    });
  }
};

const setupNodeGlobals = () => {
  // 确保 Node.js 环境下的全局变量正确设置
  if (typeof globalThis.process === 'undefined' && typeof process !== 'undefined') {
    Object.defineProperty(globalThis, 'process', {
      value: process,
      configurable: true,
    });
  }
};

// 运行时特定的工具函数
export const createMockDatabase = (runtime: Runtime = TEST_RUNTIME as Runtime) => {
  switch (runtime) {
    case 'bun':
      return createBunMockDatabase();
    case 'workerd':
    case 'cloudflare-workers':
      return createCloudflareD1MockDatabase();
    case 'deno':
      return createDenoMockDatabase();
    case 'node':
      return createNodeMockDatabase();
    case 'edge-light':
      return createEdgeMockDatabase();
    default:
      return createNodeMockDatabase();
  }
};

const createBunMockDatabase = () => {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
    }),
    close: vi.fn(),
  };
};

const createCloudflareD1MockDatabase = () => {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } }),
    }),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };
};

const createDenoMockDatabase = () => {
  // Deno 可能使用不同的 SQLite 实现
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
    }),
    close: vi.fn(),
    exec: vi.fn(),
  };
};

const createEdgeMockDatabase = () => {
  // Edge Runtime 可能有特殊的数据库实现
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
    }),
    close: vi.fn(),
  };
};

const createNodeMockDatabase = () => {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(null),
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    }),
    close: vi.fn(),
    exec: vi.fn(),
  };
};

// 超时配置 - 根据不同运行时特性调整
export const getTestTimeout = (runtime: Runtime = TEST_RUNTIME as Runtime) => {
  switch (runtime) {
    case 'bun':
      return 30000; // Bun 通常比较快
    case 'deno':
      return 35000; // Deno 性能较好
    case 'workerd':
    case 'cloudflare-workers':
      return 60000; // Workers 可能需要更多时间
    case 'edge-light':
      return 45000; // Edge Runtime 中等
    case 'fastly':
      return 50000; // Fastly 可能需要更多时间
    case 'node':
      return 40000; // Node.js 中等时间
    default:
      return 30000;
  }
};

// 内存限制和性能配置 - 根据运行时特性优化
export const getPerformanceConfig = (runtime: Runtime = TEST_RUNTIME as Runtime) => {
  const configs = {
    bun: {
      maxConcurrency: 2, // Bun 支持较好的并发
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    deno: {
      maxConcurrency: 2, // Deno 也有不错的并发性能
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    workerd: {
      maxConcurrency: 1, // Workers 环境保持单线程
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    'cloudflare-workers': {
      maxConcurrency: 1,
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    'edge-light': {
      maxConcurrency: 1, // Edge Runtime 限制并发
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    fastly: {
      maxConcurrency: 1, // Fastly 保守配置
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    node: {
      maxConcurrency: 1, // Node.js 保守配置
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    },
    other: {
      maxConcurrency: 1,
      fileParallelism: false,
      isolate: true,
      poolOptions: { forks: { singleFork: true } }
    }
  };

  return configs[runtime] || configs.other;
};

// 初始化测试环境
setupRuntimeGlobals();

// 导出配置
export default {
  RUNTIME,
  TEST_RUNTIME,
  isCI,
  isRunningInDocker,
  getTestDbPath,
  createMockDatabase,
  getTestTimeout,
  getPerformanceConfig,
};
