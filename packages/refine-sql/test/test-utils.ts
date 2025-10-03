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
  testFramework = {
    describe: globalThis.describe,
    it: globalThis.it,
    test: globalThis.test,
    expect: globalThis.expect,
    beforeAll: globalThis.beforeAll,
    afterAll: globalThis.afterAll,
    beforeEach: globalThis.beforeEach,
    afterEach: globalThis.afterEach,
    jest: globalThis.jest,
    spyOn: globalThis.jest?.spyOn,
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

  // Add skipIf for jest compatibility
  if (!isBun) {
    desc.skipIf = (condition: boolean) => {
      return condition ? baseDescribe.skip : baseDescribe;
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
