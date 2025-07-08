import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Bun 1.2+ Native SQLite Tests', () => {
  let originalGlobalThis: any;

  beforeEach(() => {
    originalGlobalThis = globalThis;
    
    // Mock Bun environment
    Object.defineProperty(globalThis, 'Bun', {
      value: { 
        version: '1.2.0',
        sqlite: vi.fn()
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'process', {
      value: undefined,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'process', {
      value: originalGlobalThis.process,
      configurable: true
    });
    Object.defineProperty(globalThis, 'Bun', {
      value: originalGlobalThis.Bun,
      configurable: true
    });
    vi.clearAllMocks();
  });

  describe('DatabaseAdapter Bun Integration', () => {
    it('should correctly detect Bun runtime', () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue(null),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-bun.db');
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should handle version requirements correctly', () => {
      // Test minimum version
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn(),
            close: vi.fn()
          })
        },
        configurable: true
      });
      
      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();

      // Test version above minimum
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.3.0',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn(),
            close: vi.fn()
          })
        },
        configurable: true
      });
      
      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();

      // Test version below minimum
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.1.9',
          sqlite: vi.fn()
        },
        configurable: true
      });
      
      expect(() => new DatabaseAdapter('./test.db')).toThrow(
        'Bun version 1.2.0 or higher is required for built-in SQLite support'
      );
    });

    it('should properly initialize SQLite database with file path', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([{ id: 1, name: 'test' }]),
          get: vi.fn().mockReturnValue({ id: 1, name: 'test' }),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-bun.db');
      
      // Test query
      const queryResult = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(queryResult)).toBe(true);
      
      // Test queryFirst
      const firstResult = await adapter.queryFirst('SELECT * FROM users WHERE id = 1');
      expect(firstResult).toBeDefined();
      
      // Test execute
      const executeResult = await adapter.execute('INSERT INTO users (name) VALUES (?)', ['Test']);
      expect(executeResult.changes).toBe(1);
      expect(executeResult.lastInsertRowid).toBe(1);
    });

    it('should handle batch operations correctly', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-bun.db');
      
      const statements = [
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User1'] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User2'] }
      ];
      
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle close method properly', async () => {
      const mockBunDB = {
        prepare: vi.fn(),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-bun.db');
      adapter.close();
      
      expect(mockBunDB.close).toHaveBeenCalled();
    });

    it('should handle Bun.sqlite constructor with options', () => {
      const mockBunDB = {
        prepare: vi.fn(),
        close: vi.fn()
      };

      const sqliteSpy = vi.fn().mockReturnValue(mockBunDB);
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: sqliteSpy
        },
        configurable: true
      });

      new DatabaseAdapter('./test-options.db');
      
      expect(sqliteSpy).toHaveBeenCalledWith('./test-options.db');
    });
  });

  describe('DataProvider Bun Integration', () => {
    let mockBunDB: any;

    beforeEach(() => {
      mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: 1, name: 'John', email: 'john@example.com' },
            { id: 2, name: 'Jane', email: 'jane@example.com' }
          ]),
          get: vi.fn().mockReturnValue({ id: 1, name: 'John', email: 'john@example.com' }),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);
    });

    it('should create data provider with Bun SQLite', () => {
      const provider = dataProvider('./test-bun.db');
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
    });

    it('should perform CRUD operations with Bun SQLite', async () => {
      const provider = dataProvider('./test-bun.db');
      
      // Test getList
      const listResult = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      expect(listResult.data).toBeDefined();
      expect(Array.isArray(listResult.data)).toBe(true);

      // Test getOne
      const oneResult = await provider.getOne({
        resource: 'users',
        id: '1'
      });
      expect(oneResult.data).toBeDefined();

      // Test create
      const createResult = await provider.create({
        resource: 'users',
        variables: { name: 'New User', email: 'new@example.com' }
      });
      expect(createResult.data).toBeDefined();

      // Test update
      const updateResult = await provider.update({
        resource: 'users',
        id: '1',
        variables: { name: 'Updated Name' }
      });
      expect(updateResult.data).toBeDefined();

      // Test delete
      const deleteResult = await provider.deleteOne({
        resource: 'users',
        id: '1'
      });
      expect(deleteResult.data).toBeDefined();
    });

    it('should handle custom SQL queries', async () => {
      const provider = dataProvider('./test-bun.db');
      
      const customResult = await provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'SELECT COUNT(*) as total FROM users',
          params: []
        }
      });
      
      expect(customResult.data).toBeDefined();
    });

    it('should handle filtering and sorting', async () => {
      const provider = dataProvider('./test-bun.db');
      
      const result = await provider.getList({
        resource: 'users',
        filters: [
          { field: 'active', operator: 'eq', value: 1 }
        ],
        sorters: [
          { field: 'name', order: 'asc' }
        ],
        pagination: { current: 1, pageSize: 5 }
      });
      
      expect(result.data).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should handle bulk operations efficiently', async () => {
      const provider = dataProvider('./test-bun.db');
      
      // Test createMany
      const createManyResult = await provider.createMany({
        resource: 'users',
        variables: [
          { name: 'User1', email: 'user1@example.com' },
          { name: 'User2', email: 'user2@example.com' },
          { name: 'User3', email: 'user3@example.com' }
        ]
      });
      
      expect(createManyResult.data).toBeDefined();
      expect(Array.isArray(createManyResult.data)).toBe(true);

      // Test updateMany
      const updateManyResult = await provider.updateMany({
        resource: 'users',
        ids: ['1', '2', '3'],
        variables: { active: 1 }
      });
      
      expect(updateManyResult.data).toBeDefined();
      expect(Array.isArray(updateManyResult.data)).toBe(true);

      // Test deleteMany
      const deleteManyResult = await provider.deleteMany({
        resource: 'users',
        ids: ['1', '2', '3']
      });
      
      expect(deleteManyResult.data).toBeDefined();
      expect(Array.isArray(deleteManyResult.data)).toBe(true);
    });
  });

  describe('Bun Error Scenarios', () => {
    it('should handle SQLite initialization errors', () => {
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockImplementation(() => {
            throw new Error('SQLite initialization failed');
          })
        },
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test-fail.db')).toThrow();
    });

    it('should handle database operation errors', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockImplementation(() => {
            throw new Error('Database error');
          })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-error.db');
      
      await expect(adapter.query('SELECT * FROM invalid')).rejects.toThrow();
    });

    it('should handle missing Bun.sqlite method', () => {
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0'
          // sqlite method missing
        },
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test-missing.db')).toThrow();
    });
  });

  describe('Bun Performance Tests', () => {
    it('should handle large batch operations efficiently', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-perf.db');
      
      // Create large batch
      const statements = Array.from({ length: 1000 }, (_, i) => ({
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: [`User${i}`]
      }));
      
      const start = Date.now();
      const results = await adapter.batch(statements);
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent operations', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([{ id: 1, name: 'test' }]),
          get: vi.fn().mockReturnValue({ id: 1, name: 'test' })
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-concurrent.db');
      
      // Run multiple queries concurrently
      const promises = Array.from({ length: 10 }, () => 
        adapter.query('SELECT * FROM users')
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should handle memory management with large datasets', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `User${i}`,
        email: `user${i}@example.com`,
        data: 'x'.repeat(1000) // 1KB per record
      }));

      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue(largeDataset),
          get: vi.fn().mockReturnValue(largeDataset[0])
        }),
        close: vi.fn()
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-memory.db');
      
      const start = process.memoryUsage().heapUsed;
      const results = await adapter.query('SELECT * FROM large_table');
      const end = process.memoryUsage().heapUsed;
      
      expect(results).toHaveLength(10000);
      // Memory usage should be reasonable (less than 100MB increase)
      expect(end - start).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Bun Specific Features', () => {
    it('should handle Bun-specific SQLite features', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([{ result: 'success' }]),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn(),
        // Bun-specific methods
        exec: vi.fn().mockReturnValue(true),
        pragma: vi.fn().mockReturnValue('wal')
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-bun-features.db');
      
      // Test basic operations work
      const result = await adapter.query('PRAGMA journal_mode');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Bun SQLite with WAL mode', async () => {
      const mockBunDB = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([{ journal_mode: 'wal' }])
        }),
        close: vi.fn(),
        pragma: vi.fn().mockReturnValue('wal')
      };

      (globalThis as any).Bun.sqlite.mockReturnValue(mockBunDB);

      const adapter = new DatabaseAdapter('./test-wal.db');
      
      // Verify WAL mode can be queried
      const result = await adapter.query('PRAGMA journal_mode');
      expect(result).toBeDefined();
    });

    it('should handle Bun version edge cases', () => {
      // Test with patch versions
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.5',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn(),
            close: vi.fn()
          })
        },
        configurable: true
      });
      
      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();

      // Test with pre-release versions
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0-canary.1',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn(),
            close: vi.fn()
          })
        },
        configurable: true
      });
      
      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
    });
  });
});
