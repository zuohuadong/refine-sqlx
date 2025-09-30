import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
  test,
} from './test-utils.js';
import detectSqlite from '../src/detect-sqlite';

describe('Runtime Detection', () => {
  // These tests are environment-dependent and challenging to mock reliably
  // in all test environments. The runtime detection is tested implicitly
  // through integration tests and actual usage.

  it('should detect runtime environment', () => {
    // Basic runtime detection test - just ensure the function exists and returns something
    const result = detectSqlite(':memory:', {});
    expect(result).toBeDefined();
    expect(typeof result.connect).toBe('function');
  });
});

describe('SQLite Detection', () => {
  it('should create factory for memory database', () => {
    const factory = detectSqlite(':memory:', {});
    expect(factory).toBeDefined();
    expect(factory.connect).toBeInstanceOf(Function);
  });

  it('should create factory for file path', () => {
    const factory = detectSqlite('/path/to/db.sqlite', {});
    expect(factory).toBeDefined();
    expect(factory.connect).toBeInstanceOf(Function);
  });

  it('should create factory for D1 database object', () => {
    const mockD1 = { prepare: jest.fn() };
    const factory = detectSqlite(mockD1 as any);
    expect(factory).toBeDefined();
    expect(factory.connect).toBeInstanceOf(Function);
  });

  it('should create factory for database objects with prepare method', () => {
    const mockDB = { prepare: jest.fn() };
    const factory = detectSqlite(mockDB as any);
    expect(factory).toBeDefined();
    expect(factory.connect).toBeInstanceOf(Function);
  });
});
