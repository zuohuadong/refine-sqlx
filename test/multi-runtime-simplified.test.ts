import { describe, it, expect, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Simplified Multi-Runtime Tests', () => {
  describe('Runtime Detection and Basic Functionality', () => {
    it('should detect D1 environment and work correctly', () => {
      // Mock D1 database
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [{ id: 1, name: 'Test User', email: 'test@example.com' }]
            }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
          }),
          all: vi.fn().mockResolvedValue({
            results: [{ id: 1, name: 'Test User', email: 'test@example.com' }]
          }),
          first: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
        }),
        batch: vi.fn().mockResolvedValue([{ results: [] }]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      expect(adapter.getType()).toBe('d1');

      const provider = dataProvider(mockD1);
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
    });

    it('should detect Bun environment and work correctly', () => {
      // Mock Bun environment
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([{ id: 1, name: 'Test' }]),
              get: vi.fn().mockReturnValue({ id: 1, name: 'Test' }),
              run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
            }),
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

      const provider = dataProvider('./test.db');
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
    });

    it('should handle version requirements correctly', () => {
      // Test Bun version below minimum
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

    it('should throw error when no compatible runtime is available', () => {
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '20.0.0' } }, // Below minimum version
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test.db')).toThrow();
    });
  });

  describe('Provider Interface Consistency', () => {
    it('should maintain consistent provider interface across runtimes', async () => {
      // Test with D1
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }]
            }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'User 1' }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
          }),
          all: vi.fn().mockResolvedValue({
            results: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }]
          }),
          first: vi.fn().mockResolvedValue({ id: 1, name: 'User 1' }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
        }),
        batch: vi.fn().mockResolvedValue([{ results: [] }]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);

      // Test all provider methods exist and return expected types
      const listResult = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      expect(listResult).toHaveProperty('data');
      expect(listResult).toHaveProperty('total');
      expect(Array.isArray(listResult.data)).toBe(true);

      const oneResult = await provider.getOne({
        resource: 'users',
        id: '1'
      });
      expect(oneResult).toHaveProperty('data');

      const createResult = await provider.create({
        resource: 'users',
        variables: { name: 'New User', email: 'new@example.com' }
      });
      expect(createResult).toHaveProperty('data');

      const updateResult = await provider.update({
        resource: 'users',
        id: '1',
        variables: { name: 'Updated User' }
      });
      expect(updateResult).toHaveProperty('data');

      const deleteResult = await provider.deleteOne({
        resource: 'users',
        id: '1'
      });
      expect(deleteResult).toHaveProperty('data');

      const customResult = await provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'SELECT COUNT(*) as count FROM users',
          params: []
        }
      });
      expect(customResult).toHaveProperty('data');

      const apiUrl = provider.getApiUrl();
      expect(typeof apiUrl).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error('Database connection failed'))
          }),
          all: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      
      await expect(adapter.query('SELECT * FROM users')).rejects.toThrow('Database connection failed');
    });

    it('should handle custom query errors', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error('SQL syntax error'))
          })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);
      
      await expect(provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'INVALID SQL',
          params: []
        }
      })).rejects.toThrow('SQL syntax error');
    });

    it('should validate custom query payload', async () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);
      
      await expect(provider.custom({
        url: '/custom',
        method: 'get',
        payload: {}
      })).rejects.toThrow('No SQL query provided for custom method');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: largeDataset })
          }),
          all: vi.fn().mockResolvedValue({ results: largeDataset })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      
      const start = Date.now();
      const result = await adapter.query('SELECT * FROM users');
      const duration = Date.now() - start;
      
      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be very fast with mocks
    });

    it('should handle batch operations efficiently', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
          })
        }),
        batch: vi.fn().mockImplementation((statements) => 
          Promise.resolve(statements.map(() => ({ results: [] })))
        ),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      
      const statements = Array.from({ length: 100 }, (_, i) => ({
        sql: 'INSERT INTO users (name) VALUES (?)',
        params: [`User ${i + 1}`]
      }));
      
      const start = Date.now();
      const results = await adapter.batch(statements);
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent operations', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [{ id: 1, name: 'Test' }] })
          }),
          all: vi.fn().mockResolvedValue({ results: [{ id: 1, name: 'Test' }] })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1);
      
      const promises = Array.from({ length: 10 }, () => 
        adapter.query('SELECT * FROM users')
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Type Safety and Data Integrity', () => {
    it('should maintain type safety with different data types', async () => {
      const mixedDataset = [
        { 
          id: 1, 
          name: 'John', 
          age: 30, 
          active: true, 
          salary: 50000.50,
          metadata: JSON.stringify({ role: 'admin' }),
          created_at: '2023-01-01T10:00:00Z'
        }
      ];

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mixedDataset })
          }),
          all: vi.fn().mockResolvedValue({ results: mixedDataset })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result.data[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        age: expect.any(Number),
        active: expect.any(Boolean),
        salary: expect.any(Number),
        metadata: expect.any(String),
        created_at: expect.any(String)
      });
    });

    it('should handle null and undefined values correctly', async () => {
      const datasetWithNulls = [
        { id: 1, name: 'John', email: null, description: undefined },
        { id: 2, name: null, email: 'jane@example.com', description: 'Test' }
      ];

      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: datasetWithNulls })
          }),
          all: vi.fn().mockResolvedValue({ results: datasetWithNulls })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].email).toBeNull();
      expect(result.data[1].name).toBeNull();
    });
  });
});
