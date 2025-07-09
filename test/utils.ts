/**
 * 跨运行时测试工具库
 * 提供统一的 API 来处理不同运行时环境的差异
 */

import { vi, test, expect } from 'vitest';
import { TEST_RUNTIME, createMockDatabase, getTestDbPath, type Runtime, getRuntimeKey } from './setup';

// 数据库适配器工厂
export class DatabaseTestFactory {
  static create(runtime: Runtime = TEST_RUNTIME as Runtime) {
    switch (runtime) {
      case 'bun':
        return new BunDatabaseTest();
      case 'workerd':
      case 'cloudflare-workers':
        return new CloudflareDatabaseTest();
      case 'deno':
        return new DenoDatabaseTest();
      case 'edge-light':
        return new EdgeDatabaseTest();
      case 'node':
        return new NodeDatabaseTest();
      default:
        return new NodeDatabaseTest();
    }
  }
}

// 基础数据库测试类
abstract class BaseDatabaseTest {
  protected dbPath: string;
  protected mockDb: any;

  constructor() {
    this.dbPath = getTestDbPath(this.constructor.name);
    this.mockDb = this.createMockDatabase();
  }

  abstract createMockDatabase(): any;
  abstract setupTestData(): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract getConnectionString(): string;
}

// Node.js SQLite 测试实现
class NodeDatabaseTest extends BaseDatabaseTest {
  createMockDatabase() {
    return createMockDatabase('node');
  }

  async setupTestData() {
    // 设置 Node.js SQLite 测试数据
    const mockPrepare = this.mockDb.prepare;
    
    // Mock 查询响应
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          all: vi.fn().mockReturnValue([
            { id: 1, name: 'Test User', email: 'test@example.com' }
          ]),
          get: vi.fn().mockReturnValue({ id: 1, name: 'Test User' }),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        };
      }
      
      return {
        all: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(null),
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      };
    });
  }

  async cleanup() {
    this.mockDb.close?.();
    vi.clearAllMocks();
  }

  getConnectionString() {
    return this.dbPath;
  }
}

// Bun SQLite 测试实现
class BunDatabaseTest extends BaseDatabaseTest {
  createMockDatabase() {
    const mockDb = createMockDatabase('bun');
    
    // Mock Bun.sqlite
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const global = globalThis as any;
    if (global.Bun?.sqlite) {
      global.Bun.sqlite.mockReturnValue(mockDb);
    }
    
    return mockDb;
  }

  async setupTestData() {
    const mockPrepare = this.mockDb.prepare;
    
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          all: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test User', email: 'test@example.com' }
          ]),
          get: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
          run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
        };
      }
      
      return {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
      };
    });
  }

  async cleanup() {
    this.mockDb.close?.();
    vi.clearAllMocks();
  }

  getConnectionString() {
    return this.dbPath;
  }
}

// Deno SQLite 测试实现
class DenoDatabaseTest extends BaseDatabaseTest {
  createMockDatabase() {
    return createMockDatabase('deno');
  }

  async setupTestData() {
    const mockPrepare = this.mockDb.prepare;
    
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          all: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test User', email: 'test@example.com' }
          ]),
          get: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
          run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
        };
      }
      
      return {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
      };
    });
  }

  async cleanup() {
    this.mockDb.close?.();
    vi.clearAllMocks();
  }

  getConnectionString() {
    return this.dbPath;
  }
}

// Edge Runtime 测试实现
class EdgeDatabaseTest extends BaseDatabaseTest {
  createMockDatabase() {
    return createMockDatabase('edge-light');
  }

  async setupTestData() {
    const mockPrepare = this.mockDb.prepare;
    
    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          all: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test User', email: 'test@example.com' }
          ]),
          get: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
          run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
        };
      }
      
      return {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 })
      };
    });
  }

  async cleanup() {
    this.mockDb.close?.();
    vi.clearAllMocks();
  }

  getConnectionString() {
    return 'edge-runtime-mock';
  }
}

// Cloudflare D1 测试实现
class CloudflareDatabaseTest extends BaseDatabaseTest {
  createMockDatabase() {
    return createMockDatabase('workerd');
  }

  async setupTestData() {
    const mockPrepare = this.mockDb.prepare;
    
    mockPrepare.mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({
        results: sql.includes('SELECT') ? [
          { id: 1, name: 'Test User', email: 'test@example.com' }
        ] : [],
        success: true,
        meta: { duration: 10 }
      }),
      first: vi.fn().mockResolvedValue(
        sql.includes('SELECT') ? { id: 1, name: 'Test User' } : null
      ),
      run: vi.fn().mockResolvedValue({
        success: true,
        meta: { changes: 1, last_row_id: 1, duration: 5 }
      })
    }));
  }

  async cleanup() {
    vi.clearAllMocks();
  }

  getConnectionString() {
    return 'cloudflare-d1-mock';
  }
}

// 运行时环境检测工具
export class RuntimeDetector {
  static isBun(): boolean {
    return TEST_RUNTIME === 'bun' || typeof (globalThis as any).Bun !== 'undefined';
  }

  static isNode(): boolean {
    return TEST_RUNTIME === 'node' || (typeof process !== 'undefined' && !!process.versions?.node);
  }

  static isCloudflareWorkers(): boolean {
    return TEST_RUNTIME === 'workerd' || 
           TEST_RUNTIME === 'cloudflare-workers' ||
           typeof (globalThis as any).WorkerGlobalScope !== 'undefined' ||
           typeof (globalThis as any).EdgeRuntime !== 'undefined';
  }

  static isDeno(): boolean {
    return TEST_RUNTIME === 'deno' || typeof (globalThis as any).Deno !== 'undefined';
  }

  static isEdgeLight(): boolean {
    return TEST_RUNTIME === 'edge-light' || typeof (globalThis as any).EdgeRuntime !== 'undefined';
  }

  static getRuntime(): Runtime {
    return getRuntimeKey();
  }
}

// 测试条件检查函数 - 简化版本
export const createSkipCondition = (condition: boolean) => condition;
export const createRunCondition = (condition: boolean) => condition;

// 运行时特定的测试条件
export const shouldSkipOnBun = () => !RuntimeDetector.isBun(); // 非 Bun 环境时跳过
export const shouldSkipOnNode = () => !RuntimeDetector.isNode(); // 非 Node 环境时跳过
export const shouldSkipOnCloudflare = () => !RuntimeDetector.isCloudflareWorkers(); // 非 Cloudflare 环境时跳过
export const shouldSkipOnDeno = () => !RuntimeDetector.isDeno(); // 非 Deno 环境时跳过

export const shouldRunOnlyBun = () => RuntimeDetector.isBun();
export const shouldRunOnlyNode = () => RuntimeDetector.isNode();
export const shouldRunOnlyCloudflare = () => RuntimeDetector.isCloudflareWorkers();
export const shouldRunOnlyDeno = () => RuntimeDetector.isDeno();

// 测试数据生成器
export class TestDataGenerator {
  static generateUsers(count: number = 5) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      active: i % 2 === 0 ? 1 : 0,
      created_at: new Date(2023, 0, i + 1).toISOString()
    }));
  }

  static generatePosts(count: number = 3) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      content: `Content for post ${i + 1}`,
      user_id: (i % 3) + 1,
      published: i % 2 === 0 ? 1 : 0
    }));
  }
}

// 统一的断言辅助工具
export class TestAssertions {
  static expectSuccess(result: any) {
    if (RuntimeDetector.isCloudflareWorkers()) {
      expect(result.success).toBe(true);
    } else {
      expect(result).toBeDefined();
    }
  }

  static expectResults(result: any, expectedLength?: number) {
    if (RuntimeDetector.isCloudflareWorkers()) {
      expect(result.results).toBeDefined();
      if (expectedLength !== undefined) {
        expect(result.results).toHaveLength(expectedLength);
      }
    } else {
      if (expectedLength !== undefined) {
        expect(result).toHaveLength(expectedLength);
      }
    }
  }

  static expectChanges(result: any, expectedChanges: number = 1) {
    if (RuntimeDetector.isCloudflareWorkers()) {
      expect(result.meta?.changes).toBe(expectedChanges);
    } else {
      expect(result.changes).toBe(expectedChanges);
    }
  }
}

export default {
  DatabaseTestFactory,
  RuntimeDetector,
  TestDataGenerator,
  TestAssertions,
  // 运行时检查函数
  shouldSkipOnBun,
  shouldSkipOnNode,
  shouldSkipOnCloudflare,
  shouldSkipOnDeno,
  shouldRunOnlyBun,
  shouldRunOnlyNode,
  shouldRunOnlyCloudflare,
  shouldRunOnlyDeno
};
