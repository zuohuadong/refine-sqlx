/**
 * Shared test utilities for bun:test and jest compatibility
 * This module provides a unified API that works with both test frameworks
 */

// Runtime detection
const isBun = typeof Bun !== 'undefined';

// For Jest ES module mode, import from @jest/globals
// This import is conditional and will only be resolved when not in Bun
import * as jestGlobalsImport from '@jest/globals';

// For Bun, we use top-level await to load bun:test
// Top-level await is supported in ES modules
let bunTest: any = null;
if (isBun) {
  bunTest = await import('bun:test');
}

// Select the Jest globals source based on runtime
// Use type assertion to avoid null check issues since jestGlobals is only used when !isBun
const jestGlobals = (
  isBun ? null : jestGlobalsImport) as typeof jestGlobalsImport;

// Export test functions
export const describe: any = isBun ? bunTest.describe : jestGlobals.describe;
export const it: any = isBun ? bunTest.it : jestGlobals.it;
export const test: any = isBun ? bunTest.test : jestGlobals.test;
export const expect: any = isBun ? bunTest.expect : jestGlobals.expect;
export const beforeAll: any = isBun ? bunTest.beforeAll : jestGlobals.beforeAll;
export const afterAll: any = isBun ? bunTest.afterAll : jestGlobals.afterAll;
export const beforeEach: any =
  isBun ? bunTest.beforeEach : jestGlobals.beforeEach;
export const afterEach: any = isBun ? bunTest.afterEach : jestGlobals.afterEach;

//  Add skipIf support for Jest (Bun has it natively)
if (!isBun && describe) {
  (describe as any).skipIf =
    (condition: boolean) => (name: string, fn: () => void) => {
      if (condition) {
        return (describe as any).skip(name, fn);
      } else {
        return describe(name, fn);
      }
    };
}

export const jest: any =
  isBun ?
    {
      fn: bunTest.mock,
      spyOn: bunTest.spyOn,
      mock: bunTest.mock,
      clearAllMocks: () => {
        // Bun doesn't have a built-in clearAllMocks, so this is a no-op
        // In Bun, mocks are automatically cleared between tests
      },
    }
  : jestGlobals.jest;

export const mock: any = isBun ? bunTest.mock : undefined;
export const spyOn: any = isBun ? bunTest.spyOn : undefined;

// Mock function helper that works with both frameworks
export const createMock = <T extends (...args: any[]) => any>(
  implementation?: T
): any => {
  if (isBun) {
    return bunTest.mock(implementation);
  } else {
    return jestGlobals.jest.fn(implementation);
  }
};

// Spy function helper
export const createSpy = <T extends object, M extends keyof T>(
  object: T,
  method: M
): any => {
  if (isBun) {
    return bunTest.spyOn(object, method);
  } else {
    return jestGlobals.jest.spyOn(object, method as any);
  }
};

// Helper to check if running in bun
export const isRunningInBun = (): boolean => isBun;

// Helper to check if running in node
export const isRunningInNode = (): boolean => !isBun;
