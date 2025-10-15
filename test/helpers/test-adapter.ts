/**
 * Test Adapter Layer for Bun and Jest Compatibility
 *
 * This adapter provides a unified testing API that works across both Bun test
 * and Jest environments. It automatically detects the runtime and imports the
 * appropriate test framework, allowing test code to be shared between environments.
 *
 * Key Features:
 * - ✅ Runtime detection (Bun vs Node.js/Jest)
 * - ✅ Unified mock function creation (mock() vs jest.fn())
 * - ✅ Unified spy creation (spyOn() vs jest.spyOn())
 * - ✅ Mock lifecycle management (clear, reset, restore)
 * - ✅ Type-safe mock verification helpers
 * - ✅ Async testing utilities
 * - ✅ Full TypeScript type safety
 *
 * @see https://bun.sh/docs/test/writing - Bun test API
 * @see https://jestjs.io/docs/api - Jest API
 */

// ============================================================================
// RUNTIME DETECTION
// ============================================================================

/**
 * Detect if we're running in Bun environment
 * This uses a simple check for the global Bun object
 */
export const isBun = typeof Bun !== 'undefined';

// ============================================================================
// SYNCHRONOUS IMPORTS (No top-level await)
// ============================================================================

// Use require for Jest (CommonJS) and conditional imports for Bun
const testFramework = isBun
  ? require('bun:test')
  : require('@jest/globals');

// ============================================================================
// CORE TEST APIs (100% Compatible - No Adaptation Needed)
// ============================================================================
// These APIs are identical in both Bun test and Jest

/**
 * Describe a test suite
 * Works identically in both Bun and Jest
 */
export const describe = testFramework.describe;

/**
 * Define a test case (alias for test)
 * Works identically in both Bun and Jest
 */
export const it = testFramework.it;

/**
 * Define a test case
 * Works identically in both Bun and Jest
 */
export const test = testFramework.test;

/**
 * Assertion function
 * Works identically in both Bun and Jest
 */
export const expect = testFramework.expect;

/**
 * Run a function before each test in a suite
 * Works identically in both Bun and Jest
 */
export const beforeEach = testFramework.beforeEach;

/**
 * Run a function after each test in a suite
 * Works identically in both Bun and Jest
 */
export const afterEach = testFramework.afterEach;

/**
 * Run a function before all tests in a suite
 * Works identically in both Bun and Jest
 */
export const beforeAll = testFramework.beforeAll;

/**
 * Run a function after all tests in a suite
 * Works identically in both Bun and Jest
 */
export const afterAll = testFramework.afterAll;

// ============================================================================
// MOCK APIs (Require Adaptation)
// ============================================================================
// These APIs have different names/structures between frameworks

/**
 * Create a mock function (works in both Bun and Jest)
 *
 * This function abstracts the difference between:
 * - Bun: `mock(implementation)`
 * - Jest: `jest.fn(implementation)`
 *
 * @example
 * ```typescript
 * const mockFn = createMock(() => 'hello');
 * mockFn(); // returns 'hello'
 * expect(mockFn).toHaveBeenCalled();
 * ```
 *
 * @param implementation - Optional mock implementation function
 * @returns Mock function that can be verified with expect()
 */
export function createMock<T extends (...args: any[]) => any>(
  implementation?: T,
): T {
  if (isBun) {
    return testFramework.mock(implementation) as T;
  } else {
    return testFramework.jest.fn(implementation) as unknown as T;
  }
}

/**
 * Create a spy on an object method (works in both Bun and Jest)
 *
 * This function abstracts the difference between:
 * - Bun: `spyOn(object, method)`
 * - Jest: `jest.spyOn(object, method)`
 *
 * @example
 * ```typescript
 * const obj = { method: () => 'original' };
 * const spy = createSpyOn(obj, 'method');
 * obj.method(); // still calls original
 * expect(spy).toHaveBeenCalled();
 * ```
 *
 * @param object - The object containing the method to spy on
 * @param method - The method name to spy on
 * @returns Spy function that tracks calls while preserving original behavior
 */
export function createSpyOn<T extends object, K extends keyof T>(
  object: T,
  method: K,
): any {
  if (isBun) {
    return testFramework.spyOn(object, method as any);
  } else {
    return testFramework.jest.spyOn(object, method as any);
  }
}

// ============================================================================
// MODULE MOCKING APIs
// ============================================================================

/**
 * Mock an entire module (advanced usage)
 *
 * IMPORTANT: Module mocking has different semantics in Bun vs Jest
 * - In Bun: Use mock.module() before importing the module
 * - In Jest: Use jest.mock() at the top of the file (hoisted)
 *
 * @example
 * ```typescript
 * mockModule('./database', () => ({
 *   connect: createMock(() => Promise.resolve('connected')),
 *   query: createMock(() => Promise.resolve([])),
 * }));
 * ```
 *
 * @param modulePath - Path to the module to mock
 * @param factory - Factory function that returns the mock module
 */
export function mockModule(modulePath: string, factory: () => any): void {
  if (isBun) {
    testFramework.mock.module(modulePath, factory);
  } else {
    testFramework.jest.mock(modulePath, factory);
  }
}

// ============================================================================
// MOCK LIFECYCLE Management
// ============================================================================

/**
 * Clear all mock call history (but keep implementations)
 *
 * @example
 * ```typescript
 * const mockFn = createMock();
 * mockFn(1, 2);
 * expect(mockFn).toHaveBeenCalledTimes(1);
 *
 * clearAllMocks();
 * expect(mockFn).toHaveBeenCalledTimes(0); // Call history cleared
 * mockFn(3, 4);
 * expect(mockFn).toHaveBeenCalledTimes(1); // New calls still tracked
 * ```
 */
export function clearAllMocks(): void {
  if (isBun) {
    // Bun automatically clears mocks between tests
    // No action needed
  } else {
    testFramework.jest.clearAllMocks();
  }
}

/**
 * Reset all mocks (clear history AND implementations)
 *
 * @example
 * ```typescript
 * const mockFn = createMock(() => 'hello');
 * mockFn(); // returns 'hello'
 *
 * resetAllMocks();
 * mockFn(); // returns undefined (implementation reset)
 * ```
 */
export function resetAllMocks(): void {
  if (isBun) {
    // Bun automatically resets mocks between tests
    // No action needed
  } else {
    testFramework.jest.resetAllMocks();
  }
}

/**
 * Restore all mocked functions to their original implementations
 *
 * Note: In Bun, mocks are automatically restored between tests
 * In Jest, this restores spies to their original implementations
 */
export function restoreAllMocks(): void {
  if (isBun) {
    // Bun automatically restores mocks between tests
    // No action needed
  } else {
    testFramework.jest.restoreAllMocks();
  }
}

// ============================================================================
// TYPE-SAFE MOCK VERIFICATION HELPERS
// ============================================================================

/**
 * Type-safe mock verification interface
 * Provides type-checked methods for verifying mock calls
 */
export interface MockVerification<T extends (...args: any[]) => any> {
  /** Verify the mock was called at least once */
  toHaveBeenCalled(): void;

  /** Verify the mock was called exactly N times */
  toHaveBeenCalledTimes(times: number): void;

  /** Verify the mock was called with specific arguments (type-safe) */
  toHaveBeenCalledWith(...args: Parameters<T>): void;

  /** Verify the mock returned a specific value (type-safe) */
  toHaveReturnedWith(value: ReturnType<T>): void;

  /** Verify the mock was last called with specific arguments */
  toHaveBeenLastCalledWith(...args: Parameters<T>): void;

  /** Verify the mock was called with arguments matching a pattern */
  toHaveBeenNthCalledWith(nthCall: number, ...args: Parameters<T>): void;
}

/**
 * Create a type-safe mock verification helper
 *
 * @example
 * ```typescript
 * const addMock = createMock((a: number, b: number) => a + b);
 * addMock(1, 2);
 *
 * const verify = verifyMock(addMock);
 * verify.toHaveBeenCalled();
 * verify.toHaveBeenCalledWith(1, 2); // Type-safe: only accepts (number, number)
 * verify.toHaveReturnedWith(3); // Type-safe: only accepts number
 * ```
 *
 * @param mockFn - The mock function to verify
 * @returns Type-safe verification interface
 */
export function verifyMock<T extends (...args: any[]) => any>(
  mockFn: T,
): MockVerification<T> {
  return {
    toHaveBeenCalled: () => expect(mockFn).toHaveBeenCalled(),
    toHaveBeenCalledTimes: (times) => expect(mockFn).toHaveBeenCalledTimes(times),
    toHaveBeenCalledWith: (...args) => expect(mockFn).toHaveBeenCalledWith(...args),
    toHaveReturnedWith: (value) => expect(mockFn).toHaveReturnedWith(value),
    toHaveBeenLastCalledWith: (...args) =>
      expect(mockFn).toHaveBeenLastCalledWith(...args),
    toHaveBeenNthCalledWith: (nthCall, ...args) =>
      expect(mockFn).toHaveBeenNthCalledWith(nthCall, ...args),
  };
}

// ============================================================================
// ASYNC TESTING HELPERS
// ============================================================================

/**
 * Wait for all pending promises to resolve
 * Useful for testing async operations
 *
 * @example
 * ```typescript
 * const mockAsync = createMock(() => Promise.resolve('done'));
 * const promise = mockAsync();
 *
 * await flushPromises();
 * expect(mockAsync).toHaveBeenCalled();
 * ```
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create a resolved promise (useful for mock implementations)
 *
 * @example
 * ```typescript
 * const mockDb = {
 *   query: createMock(() => resolvedPromise([{ id: 1 }])),
 * };
 * ```
 *
 * @param value - The value to resolve with
 * @returns Promise that resolves immediately with the value
 */
export function resolvedPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/**
 * Create a rejected promise (useful for testing error cases)
 *
 * @example
 * ```typescript
 * const mockDb = {
 *   query: createMock(() => rejectedPromise(new Error('Connection failed'))),
 * };
 * ```
 *
 * @param error - The error to reject with
 * @returns Promise that rejects immediately with the error
 */
export function rejectedPromise(error: Error): Promise<never> {
  return Promise.reject(error);
}

// ============================================================================
// RUNTIME DETECTION FLAGS
// ============================================================================

/** True if running in Bun test environment */
export const isRunningInBun = isBun;

/** True if running in Jest test environment */
export const isRunningInJest = !isBun;

/**
 * Get the name of the current test framework
 * @returns 'bun' or 'jest'
 */
export function getTestFramework(): 'bun' | 'jest' {
  return isBun ? 'bun' : 'jest';
}

// ============================================================================
// FRAMEWORK-SPECIFIC UTILITIES (Optional)
// ============================================================================

/**
 * Access to Jest-specific utilities
 * Only available in Jest environment, undefined in Bun
 *
 * @example
 * ```typescript
 * if (jest) {
 *   jest.useFakeTimers(); // Jest-only feature
 * }
 * ```
 */
export const jest = !isBun ? testFramework.jest : undefined;

/**
 * Access to Bun-specific mock utilities
 * Only available in Bun environment, undefined in Jest
 */
export const bunMock = isBun ? testFramework.mock : undefined;
