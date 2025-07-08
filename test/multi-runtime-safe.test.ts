import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Multi-Runtime Integration Tests - Simplified', () => {
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

  describe('D1 Runtime Tests', () => {
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

    it('should create D1 adapter successfully', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getType()).toBe('d1');
    });

    it('should execute D1 basic queries', async () => {
      const result = await adapter.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT * FROM users');
    });

    it('should execute D1 parameterized queries', async () => {
      const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
    });

    it('should execute D1 single row queries', async () => {
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
    });

    it('should execute D1 insert operations', async () => {
      const result = await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['New User', 'new@example.com']);
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(1);
    });

    it('should handle D1 provider getList', async () => {
      const result = await provider.getList({ resource: 'users' });
      expect(result.data).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
      expect(result.total).toBe(1);
    });

    it('should handle D1 provider getOne', async () => {
      const result = await provider.getOne({ resource: 'users', id: 1 });
      expect(result.data).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
    });

    it('should handle D1 provider create', async () => {
      const result = await provider.create({ 
        resource: 'users', 
        variables: { name: 'New User', email: 'new@example.com' }
      });
      expect(result.data.id).toBe(1);
    });

    it('should handle D1 provider update', async () => {
      const result = await provider.update({ 
        resource: 'users', 
        id: 1,
        variables: { name: 'Updated User' }
      });
      expect(result.data.id).toBe(1);
    });

    it('should handle D1 provider delete', async () => {
      const result = await provider.deleteOne({ resource: 'users', id: 1 });
      expect(result.data.id).toBe(1);
    });

    it('should handle D1 batch operations', async () => {
      const statements = [
        { sql: 'SELECT * FROM users', params: [] }
      ];
      const result = await adapter.batch(statements);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle D1 database errors', async () => {
      const mockD1WithError = {
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

      const adapter = new DatabaseAdapter(mockD1WithError);
      
      await expect(adapter.query('SELECT * FROM invalid_table')).rejects.toThrow('Database error');
    });

    it('should handle missing database input', () => {
      expect(() => new DatabaseAdapter(null as any)).toThrow('Database instance or path is required');
    });

    it('should handle empty batch operations', async () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn().mockResolvedValue([]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      const result = await adapter.batch([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent operations efficiently', async () => {
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

      const promises = Array.from({ length: 10 }, () => 
        adapter.query('SELECT 1')
      );

      const start = Date.now();
      await Promise.all(promises);
      const end = Date.now();

      expect(end - start).toBeLessThan(1000);
    });

    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: largeResultSet }),
            first: vi.fn().mockResolvedValue(largeResultSet[0]),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
          }),
          all: vi.fn().mockResolvedValue({ results: largeResultSet }),
          first: vi.fn().mockResolvedValue(largeResultSet[0]),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
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
      const results = await adapter.query('SELECT * FROM large_table');
      const end = Date.now();

      expect(results.length).toBe(1000);
      expect(end - start).toBeLessThan(5000);
    });

    it('should handle batch operations with many statements', async () => {
      const statements = Array.from({ length: 100 }, (_, i) => ({
        sql: `INSERT INTO users (name) VALUES (?)`,
        params: [`User ${i + 1}`]
      }));

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
        }),
        batch: vi.fn().mockResolvedValue(statements.map((_, i) => ({ 
          results: [{ id: i + 1 }] 
        }))),
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
      const result = await adapter.batch(statements);
      const end = Date.now();

      expect(result.length).toBe(100);
      expect(end - start).toBeLessThan(1000);
    });
  });

  describe('Type Safety Tests', () => {
    it('should maintain consistent interfaces for D1', () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      
      expect(typeof adapter.query).toBe('function');
      expect(typeof adapter.queryFirst).toBe('function');
      expect(typeof adapter.execute).toBe('function');
      expect(typeof adapter.batch).toBe('function');
      expect(typeof adapter.close).toBe('function');
      expect(typeof adapter.getType).toBe('function');
    });

    it('should provide proper provider interface', () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);
      
      expect(typeof provider.getList).toBe('function');
      expect(typeof provider.getOne).toBe('function');
      expect(typeof provider.getMany).toBe('function');
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.createMany).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.updateMany).toBe('function');
      expect(typeof provider.deleteOne).toBe('function');
      expect(typeof provider.deleteMany).toBe('function');
      expect(typeof provider.custom).toBe('function');
      expect(typeof provider.getApiUrl).toBe('function');
    });
  });
});
