// scripts/env-detect.js - 独立的环境检测脚本，不依赖 vitest
function detectRuntime() {
  if (typeof global !== 'undefined') {
    if (global.Deno) {
      return 'deno';
    } else if (global.Bun) {
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

console.log(`[ci] 检测到运行时环境: ${detectRuntime()}`);
