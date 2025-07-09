// 统一测试环境检测与日志输出，便于各端集成
import { beforeAll } from 'vitest';

export type RuntimeEnv = 'node' | 'bun' | 'd1' | 'deno' | 'browser' | 'unknown';

export function detectRuntime(): RuntimeEnv {
  if (typeof global !== 'undefined') {
    if ((global as any).Deno) {
      return 'deno';
    } else if ((global as any).Bun) {
      return 'bun';
    } else {
      // 进一步判断 D1
      if (typeof globalThis !== 'undefined' &&
        ('D1Database' in globalThis || ('caches' in globalThis && 'fetch' in globalThis))) {
        return 'd1';
      }
      return 'node';
    }
  }
  return 'browser';
}

export function checkNodeVersion(): boolean {
  const runtime = detectRuntime();
  if (runtime !== 'node') return true;
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major >= 22) return true;
  console.warn(`Node.js 版本 ${nodeVersion} 不支持原生 SQLite（需要 22.5+）`);
  return false;
}

beforeAll(() => {
  const runtime = detectRuntime();
  console.log(`[test-setup] 当前运行时环境：${runtime}`);
  if (runtime === 'node') {
    const ok = checkNodeVersion();
    if (ok) {
      console.log('[test-setup] Node.js 环境：SQLite 支持已启用');
    } else {
      console.log('[test-setup] Node.js 环境：SQLite 支持未启用，部分测试可能跳过');
    }
  } else if (runtime === 'bun') {
    console.log('[test-setup] Bun 环境：原生 SQLite 支持已启用');
  } else if (runtime === 'd1') {
    console.log('[test-setup] Cloudflare D1 环境：Workers SQLite 支持已启用');
  } else if (runtime === 'deno') {
    console.log('[test-setup] Deno 环境：请确保 SQLite 支持');
  } else if (runtime === 'browser') {
    console.log('[test-setup] 浏览器环境：请确保 SQLite 支持或使用 Polyfill');
  } else {
    console.log('[test-setup] 未知环境：可能的测试兼容性问题');
  }
  // 不进行任何 SQLite 模拟
});
