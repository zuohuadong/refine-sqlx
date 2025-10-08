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

// Re-export test functions based on runtime
let testFramework: any;

if (isBun) {
  // Using bun:test
  testFramework = await import('bun:test');
} else {
  // Using jest - use globals instead of import
  // In Jest, describe, it, test, expect, etc. are globally available
  // Access them through globalThis with proper typing
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

  const g = globalThis as typeof globalThis & JestGlobals;
  testFramework = {
    describe: g.describe,
    it: g.it,
    test: g.test,
    expect: g.expect,
    beforeAll: g.beforeAll,
    afterAll: g.afterAll,
    beforeEach: g.beforeEach,
    afterEach: g.afterEach,
    jest: g.jest,
    spyOn: g.jest?.spyOn,
  };
}

// Export unified test API
export const {
  describe: baseDescribe,
  it,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} = testFramework;

// Create a compatible describe with skipIf support
const createDescribeWithSkipIf = () => {
  const desc: any = baseDescribe;

  // Add skipIf for bun compatibility (Bun already has native skipIf)
  // For Jest, we need to add a custom implementation
  if (!isBun) {
    desc.skipIf = (condition: boolean) => {
      // Return a wrapper function that accepts (name, fn) parameters
      // This wrapper either calls describe.skip or describe based on the condition
      const wrapper = (name: string, fn: () => void) => {
        if (condition) {
          return baseDescribe.skip(name, fn);
        } else {
          return baseDescribe(name, fn);
        }
      };

      // Copy over any properties from describe (like .only, .skip, etc)
      return Object.assign(wrapper, baseDescribe);
    };
  }

  return desc;
};

export const describe = createDescribeWithSkipIf();

// Export jest or mock from the framework
export const jest = testFramework.jest || testFramework;
export const mock = testFramework.mock;
export const spyOn = testFramework.spyOn;

// Mock function helper that works with both frameworks
export const createMock = <T extends (...args: any[]) => any>(
  implementation?: T
): any => {
  if (isBun) {
    return testFramework.mock(implementation);
  } else {
    return testFramework.jest.fn(implementation);
  }
};

// Spy function helper
export const createSpy = <T extends object, M extends keyof T>(
  object: T,
  method: M
): any => {
  if (isBun) {
    return testFramework.spyOn(object, method);
  } else {
    return testFramework.jest.spyOn(object, method);
  }
};

// Helper to check if running in bun
export const isRunningInBun = (): boolean => isBun;

// Helper to check if running in node
export const isRunningInNode = (): boolean => !isBun;
