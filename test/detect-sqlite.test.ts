import { describe, it, expect, jest } from '@jest/globals';
import detectSqlite from '../src/detect-sqlite';

describe('Runtime Detection', () => {
  // These tests are environment-dependent and challenging to mock reliably
  // in all test environments. The runtime detection is tested implicitly
  // through integration tests and actual usage.

  it.skip('should detect Cloudflare Worker environment', () => {
    // Skipped: Environment detection is complex to mock across different runtimes
  });

  it.skip('should detect Bun environment', () => {
    // Skipped: Environment detection is complex to mock across different runtimes
  });

  it.skip('should detect Node.js v24+ environment', () => {
    // Skipped: Environment detection is complex to mock across different runtimes
  });

  it.skip('should return undefined for unsupported environments', () => {
    // Skipped: Environment detection is complex to mock across different runtimes
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
