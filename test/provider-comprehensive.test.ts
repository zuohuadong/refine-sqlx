import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dataProvider } from '../src/provider';
import { DatabaseAdapter } from '../src/database';

describe('DataProvider Comprehensive Tests', () => {
  describe('Provider with D1 Database', () => {
    let mockD1: any;

    beforeEach(() => {
      // Setup D1 environment
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [
                { id: 1, name: 'John', email: 'john@example.com', active: 1 },
                { id: 2, name: 'Jane', email: 'jane@example.com', active: 1 }
              ]
            }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'John', email: 'john@example.com' }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 123 } })
          }),
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 1, name: 'John', email: 'john@example.com', active: 1 },
              { id: 2, name: 'Jane', email: 'jane@example.com', active: 1 }
            ]
          }),
          first: vi.fn().mockResolvedValue({ id: 1, name: 'John', email: 'john@example.com' }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 123 } })
        }),
        batch: vi.fn().mockResolvedValue([
          { results: [] },
          { results: [] }
        ])
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create provider with D1 database instance', () => {
      const provider = dataProvider(mockD1);
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
      expect(typeof provider.getOne).toBe('function');
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.deleteOne).toBe('function');
    });

    it('should handle getList with D1', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockD1.prepare).toHaveBeenCalled();
    });

    it('should handle getOne with D1', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.getOne({
        resource: 'users',
        id: '1'
      });

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('id', 1);
      expect(mockD1.prepare).toHaveBeenCalled();
    });

    it('should handle create with D1', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.create({
        resource: 'users',
        variables: {
          name: 'New User',
          email: 'new@example.com'
        }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
    });

    it('should handle update with D1', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.update({
        resource: 'users',
        id: '1',
        variables: {
          name: 'Updated Name'
        }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
    });

    it('should handle deleteOne with D1', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.deleteOne({
        resource: 'users',
        id: '1'
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
    });

    it('should handle bulk operations with D1', async () => {
      const provider = dataProvider(mockD1);
      
      // Test createMany
      const createManyResult = await provider.createMany({
        resource: 'users',
        variables: [
          { name: 'User1', email: 'user1@example.com' },
          { name: 'User2', email: 'user2@example.com' }
        ]
      });

      expect(createManyResult).toHaveProperty('data');
      expect(Array.isArray(createManyResult.data)).toBe(true);

      // Test updateMany
      const updateManyResult = await provider.updateMany({
        resource: 'users',
        ids: ['1', '2'],
        variables: { active: 1 }
      });

      expect(updateManyResult).toHaveProperty('data');
      expect(Array.isArray(updateManyResult.data)).toBe(true);

      // Test deleteMany
      const deleteManyResult = await provider.deleteMany({
        resource: 'users',
        ids: ['1', '2']
      });

      expect(deleteManyResult).toHaveProperty('data');
      expect(Array.isArray(deleteManyResult.data)).toBe(true);
    });
  });

  describe('Provider with Database Path (Multi-Runtime)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create provider with Bun SQLite path', () => {
      // Mock Bun environment
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([]),
              get: vi.fn().mockReturnValue(null),
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

      const provider = dataProvider('./test-bun.db');
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
    });

    it('should create provider with Node.js SQLite path', () => {
      // Mock Node.js environment
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '22.5.0' } },
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      vi.doMock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => ({
          prepare: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
            get: vi.fn().mockReturnValue(null),
            run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
          }),
          close: vi.fn()
        }))
      }));

      const provider = dataProvider('./test-nodejs.db');
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
    });
  });

  describe('Provider Error Handling', () => {
    it('should handle database connection errors', () => {
      const mockBadD1 = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database connection failed');
        })
      };

      expect(() => dataProvider(mockBadD1)).not.toThrow(); // Provider creation shouldn't throw
      
      const provider = dataProvider(mockBadD1);
      
      // But operations should handle errors gracefully
      expect(async () => {
        await provider.getList({ resource: 'users', pagination: { current: 1, pageSize: 10 } });
      }).rejects.toThrow();
    });

    it('should handle invalid database path', () => {
      // Mock environment where no runtime is available
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '20.0.0' } }, // Below minimum version
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      expect(() => dataProvider('./invalid.db')).toThrow();
    });

    it('should handle malformed SQL queries', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error('SQL syntax error'))
          })
        })
      };

      const provider = dataProvider(mockD1);
      
      await expect(provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      })).rejects.toThrow();
    });
  });

  describe('Provider Filtering and Sorting', () => {
    let mockD1: any;

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [
                { id: 1, name: 'Alice', age: 30, active: 1 },
                { id: 2, name: 'Bob', age: 25, active: 0 }
              ]
            })
          })
        })
      };
    });

    it('should handle complex filtering', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        filters: [
          { field: 'active', operator: 'eq', value: 1 },
          { field: 'age', operator: 'gte', value: 25 },
          { field: 'name', operator: 'contains', value: 'Ali' }
        ],
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
      
      // Verify the SQL was built with proper WHERE clauses
      const prepareCall = mockD1.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('WHERE');
    });

    it('should handle multiple sorting', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        sorters: [
          { field: 'name', order: 'asc' },
          { field: 'age', order: 'desc' }
        ],
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
      
      // Verify the SQL was built with proper ORDER BY clauses
      const prepareCall = mockD1.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('ORDER BY');
    });

    it('should handle pagination correctly', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 2, pageSize: 5 }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalled();
      
      // Verify the SQL was built with proper LIMIT and OFFSET
      const prepareCall = mockD1.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('LIMIT');
      expect(prepareCall).toContain('OFFSET');
    });
  });

  describe('Provider Custom Operations', () => {
    let mockD1: any;

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [{ count: 5 }]
            }),
            first: vi.fn().mockResolvedValue({ result: 'success' }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
          })
        })
      };
    });

    it('should handle custom GET queries', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'SELECT COUNT(*) as count FROM users WHERE active = ?',
          params: [1]
        }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users WHERE active = ?');
    });

    it('should handle custom POST queries', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.custom({
        url: '/custom',
        method: 'post',
        payload: {
          sql: 'INSERT INTO logs (message, timestamp) VALUES (?, ?)',
          params: ['User logged in', '2023-01-01 10:00:00']
        }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalledWith('INSERT INTO logs (message, timestamp) VALUES (?, ?)');
    });

    it('should handle custom queries without parameters', async () => {
      const provider = dataProvider(mockD1);
      
      const result = await provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'SELECT * FROM system_info'
        }
      });

      expect(result).toHaveProperty('data');
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT * FROM system_info');
    });
  });

  describe('Provider Performance Tests', () => {
    let mockD1: any;

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
          })
        }),
        batch: vi.fn().mockImplementation((statements) => 
          Promise.resolve(statements.map(() => ({ results: [] })))
        )
      };
    });

    it('should handle large batch operations efficiently', async () => {
      const provider = dataProvider(mockD1);
      
      // Create 100 records
      const variables = Array.from({ length: 100 }, (_, i) => ({
        name: `User${i}`,
        email: `user${i}@example.com`
      }));

      const start = Date.now();
      const result = await provider.createMany({
        resource: 'users',
        variables
      });
      const duration = Date.now() - start;

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      const provider = dataProvider(mockD1);
      
      // Run multiple getList operations concurrently
      const promises = Array.from({ length: 10 }, () => 
        provider.getList({
          resource: 'users',
          pagination: { current: 1, pageSize: 10 }
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('total');
      });
    });
  });

  describe('Provider Type Safety', () => {
    it('should maintain type safety with different data types', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [
                { 
                  id: 1, 
                  name: 'John', 
                  age: 30, 
                  active: true, 
                  salary: 50000.50,
                  metadata: JSON.stringify({ role: 'admin' }),
                  created_at: '2023-01-01T10:00:00Z'
                }
              ]
            })
          })
        })
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
  });
});
