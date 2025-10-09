/**
 * Shared test utilities for bun:test and jest compatibility
 * This module provides a unified API that works with both test frameworks
 */

// Runtime detection
const isBun = typeof Bun !== 'undefined';

// Type definitions for mock functions
type MockFunction = {
  mock: { calls: any[][]; results: any[]; instances: any[] };
  mockImplementation: (fn: any) => MockFunction;
  mockReturnValue: (value: any) => MockFunction;
  mockResolvedValue: (value: any) => MockFunction;
  mockRejectedValue: (value: any) => MockFunction;
  mockClear: () => void;
  mockReset: () => void;
  mockRestore?: () => void;
};

// Type definitions for Jest globals
interface JestGlobals {
  describe: any;
  it: any;
  test: any;
  expect: any;
  beforeAll: any;
  afterAll: any;
  beforeEach: any;
  afterEach: any;
  jest: any;
}

// Lazy loader for bun:test to avoid top-level await
let bunTest: any = null;
async function getBunTest() {
  if (!bunTest && isBun) {
    bunTest = await import('bun:test');
  }
  return bunTest;
}

// For Jest, directly access globals - they're set up before test modules load
const g = globalThis as typeof globalThis & JestGlobals;

// Export test functions with conditional logic
const baseDescribe: any =
  isBun ?
    new Proxy(
      {},
      {
        get: (_, prop) =>
          (bunTest || (async () => await getBunTest())()).describe?.[prop],
      }
    )
  : g.describe;

// Add skipIf support for Jest (Bun has it natively)
if (!isBun && baseDescribe) {
  baseDescribe.skipIf = (condition: boolean) => {
    // Return a wrapper function that accepts (name, fn) parameters
    return (name: string, fn: () => void) => {
      if (condition) {
        return baseDescribe.skip(name, fn);
      } else {
        return baseDescribe(name, fn);
      }
    };
  };
}

export const describe = baseDescribe;

export const it: any = isBun ? bunTest?.it || g.it : g.it;

export const test: any = isBun ? bunTest?.test || g.test : g.test;

export const expect: any = isBun ? bunTest?.expect || g.expect : g.expect;

export const beforeAll: any =
  isBun ? bunTest?.beforeAll || g.beforeAll : g.beforeAll;

export const afterAll: any =
  isBun ? bunTest?.afterAll || g.afterAll : g.afterAll;

export const beforeEach: any =
  isBun ? bunTest?.beforeEach || g.beforeEach : g.beforeEach;

export const afterEach: any =
  isBun ? bunTest?.afterEach || g.afterEach : g.afterEach;

// Export jest - IMPORTANT: For Jest, this must be available synchronously
// Use Proxy to defer access to runtime when jest globals are available
export const jest: any =
  isBun ?
    {
      get fn() {
        return bunTest?.mock || g.jest?.fn;
      },
      get spyOn() {
        return bunTest?.spyOn || g.jest?.spyOn;
      },
      get mock() {
        return bunTest?.mock || g.jest?.mock;
      },
    }
  : new Proxy(
      {},
      {
        get(target, prop) {
          // Access jest from globalThis at runtime, not at module load time
          const jestGlobal = (globalThis as any).jest;
          if (jestGlobal && prop in jestGlobal) {
            return jestGlobal[prop];
          }
          return undefined;
        },
      }
    );

export const mock: any = isBun ? bunTest?.mock : undefined;
export const spyOn: any = isBun ? bunTest?.spyOn : undefined;

// Mock function helper that works with both frameworks
export const createMock = <T extends (...args: any[]) => any>(
  implementation?: T
): any => {
  if (isBun) {
    return (bunTest?.mock || (globalThis as any).jest?.fn)(implementation);
  } else {
    return (globalThis as any).jest?.fn(implementation);
  }
};

// Spy function helper
export const createSpy = <T extends object, M extends keyof T>(
  object: T,
  method: M
): any => {
  if (isBun) {
    return (bunTest?.spyOn || (globalThis as any).jest?.spyOn)(object, method);
  } else {
    return (globalThis as any).jest?.spyOn(object, method);
  }
};

// Helper to check if running in bun
export const isRunningInBun = (): boolean => isBun;

// Helper to check if running in node
export const isRunningInNode = (): boolean => !isBun;

// Initialize bun:test on first import if in Bun
if (isBun) {
  getBunTest();
}
