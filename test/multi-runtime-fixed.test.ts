import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Multi-Runtime Integration Tests - Fixed', () => {
  let originalProcess: any;
  let originalBun: any;

  beforeEach(() => {
    // Save original values
    originalProcess = globalThis.process;
    originalBun = (globalThis as any).Bun;
  });

  afterEach(() => {
    // Restore original values
    if (originalProcess !== undefined) {
      Object.defineProperty(globalThis, 'process', {
        value: originalProcess,
        configurable: true
      });
    } else {
      try {
        Object.defineProperty(globalThis, 'process', {
          value: undefined,
          configurable: true
        });
      } catch (e) {
        // Ignore error if property cannot be set
      }
    }
    
    if (originalBun !== undefined) {
      Object.defineProperty(globalThis, 'Bun', {
        value: originalBun,
        configurable: true
      });
    } else {
      try {
        Object.defineProperty(globalThis, 'Bun', {
          value: undefined,
          configurable: true
        });
      } catch (e) {
        // Ignore error if property cannot be set
      }
    }
    
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Runtime Detection', () => {
    it('should detect D1 environment correctly', () => {
      // Clear all runtime indicators
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      expect(adapter.getType()).toBe('d1');
    });

    it('should detect Bun environment correctly', () => {
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
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should detect Node.js environment correctly', () => {
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '22.5.0' } },
        configurable: true,
        writable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('node-sqlite');
    });

    it('should throw error when no runtime is available', () => {
      // Clear all runtime indicators to simulate no available runtime
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test.db')).toThrow('SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments');
    });
  });

  describe('D1 Runtime Compatibility', () => {
    let mockD1: any;
    let adapter: DatabaseAdapter;
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      // Clear runtime indicators to ensure D1 detection
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      mockD1 = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          const isCountQuery = sql.includes('COUNT(*)');
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ 
                results: isCountQuery 
                  ? [{ count: 1 }]
                  : [{ id: 1, name: 'Test User', email: 'test@example.com' }]
              }),
              first: vi.fn().mockResolvedValue(
                isCountQuery 
                  ? { count: 1 }
                  : { id: 1, name: 'Test User', email: 'test@example.com' }
              ),
              run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
            }),
            all: vi.fn().mockResolvedValue({ 
              results: isCountQuery 
                ? [{ count: 1 }]
                : [{ id: 1, name: 'Test User', email: 'test@example.com' }]
            }),
            first: vi.fn().mockResolvedValue(
              isCountQuery 
                ? { count: 1 }
                : { id: 1, name: 'Test User', email: 'test@example.com' }
            ),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
          };
        }),
        batch: vi.fn().mockResolvedValue([
          { results: [{ id: 1, name: 'Test User', email: 'test@example.com' }] }
        ]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      adapter = new DatabaseAdapter(mockD1);
      provider = dataProvider(mockD1);
    });

    it('should create adapter successfully', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getType()).toBe('d1');
    });

    it('should execute basic queries', async () => {
      const result = await adapter.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT * FROM users');
    });

    it('should execute parameterized queries', async () => {
      const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
    });

    it('should handle provider operations', async () => {
      const listResult = await provider.getList({ resource: 'users' });
      expect(listResult.data).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(listResult.total).toBe(1);
    });
  });

  describe('Bun Runtime Compatibility', () => {
    let mockBunDB: any;
    let adapter: DatabaseAdapter;
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      mockBunDB = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          const isCountQuery = sql.includes('COUNT(*)');
          return {
            all: vi.fn().mockReturnValue(
              isCountQuery 
                ? [{ count: 1 }]
                : [{ id: 1, name: 'Test User', email: 'test@example.com' }]
            ),
            get: vi.fn().mockReturnValue(
              isCountQuery 
                ? { count: 1 }
                : { id: 1, name: 'Test User', email: 'test@example.com' }
            ),
            run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
          };
        }),
        close: vi.fn()
      };

      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockImplementation(() => mockBunDB)
        },
        configurable: true
      });
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });

      adapter = new DatabaseAdapter('./test-bun.db');
      provider = dataProvider('./test-bun.db');
    });

    it('should create adapter successfully', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should execute basic queries', async () => {
      const result = await adapter.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
    });

    it('should handle provider operations', async () => {
      const listResult = await provider.getList({ resource: 'users' });
      expect(listResult.data).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(listResult.total).toBe(1);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle errors consistently across D1', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error('Database error')),
            first: vi.fn().mockRejectedValue(new Error('Database error')),
            run: vi.fn().mockRejectedValue(new Error('Database error'))
          }),
          all: vi.fn().mockRejectedValue(new Error('Database error')),
          first: vi.fn().mockRejectedValue(new Error('Database error')),
          run: vi.fn().mockRejectedValue(new Error('Database error'))
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      const adapter = new DatabaseAdapter(mockD1);
      
      await expect(adapter.query('SELECT * FROM invalid_table')).rejects.toThrow('Database error');
    });

    it('should handle runtime compatibility errors', () => {
      // Test with completely invalid input (should fail during validation)
      expect(() => new DatabaseAdapter(null as any)).toThrow();
    });
  });

  describe('Performance Consistency', () => {
    it('should have consistent basic performance patterns', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue({}),
            run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({}),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      const adapter = new DatabaseAdapter(mockD1);

      const start = Date.now();
      await adapter.query('SELECT 1');
      const end = Date.now();

      expect(end - start).toBeLessThan(1000); // Should complete within reasonable time
    });
  });
});
