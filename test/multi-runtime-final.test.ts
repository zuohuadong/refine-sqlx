import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Multi-Runtime Tests - Fully Fixed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('D1 Runtime Support', () => {
    it('should work with D1 database objects', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ 
              results: [{ id: 1, name: 'Test User', email: 'test@example.com' }]
            }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'Test User', email: 'test@example.com' }),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
          }),
          all: vi.fn().mockResolvedValue({ 
            results: [{ id: 1, name: 'Test User', email: 'test@example.com' }]
          }),
          first: vi.fn().mockResolvedValue({ id: 1, name: 'Test User', email: 'test@example.com' }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
        }),
        batch: vi.fn().mockResolvedValue([
          { results: [{ id: 1, name: 'Test User', email: 'test@example.com' }] }
        ]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter.getType()).toBe('d1');

      const result = await adapter.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);

      const provider = dataProvider(mockD1 as any);
      const listResult = await provider.getList({ resource: 'users' });
      expect(listResult.data).toEqual([{ id: 1, name: 'Test User', email: 'test@example.com' }]);
    });

    it('should handle D1 insert operations', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 123 } })
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 123 } })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('INSERT INTO users (name) VALUES (?)', ['New User']);
      
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(123);
    });

    it('should handle D1 update and delete operations', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'User To Delete' })
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1 as any);
      
      // Test update
      const updateResult = await adapter.execute('UPDATE users SET name = ? WHERE id = ?', ['Updated', 1]);
      expect(updateResult.changes).toBe(1);

      // Test delete
      const deleteResult = await adapter.execute('DELETE FROM users WHERE id = ?', [1]);
      expect(deleteResult.changes).toBe(1);
    });

    it('should handle D1 batch operations', async () => {
      const mockD1 = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(), // Return `this` to allow chaining
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } }),
        }),
        batch: vi.fn().mockResolvedValue([
          { results: [{ id: 1 }] },
          { results: [{ id: 2 }] }
        ]),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1 as any);
      const statements = [
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User 1'] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User 2'] }
      ];

      const results = await adapter.batch(statements);
      expect(results).toHaveLength(2);
    });
  });

  describe('Provider Interface Consistency', () => {
    it('should provide consistent CRUD interface', async () => {
      const mockDatabase = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn((...params: any[]) => ({
            all: vi.fn().mockResolvedValue({ 
              results: [
                { id: 1, name: 'User 1', email: 'user1@example.com' },
                { id: 2, name: 'User 2', email: 'user2@example.com' }
              ]
            }),
            first: vi.fn().mockResolvedValue(
              params[0] === 3
                ? { id: 3, name: 'New User', email: 'new@example.com' }
                : { id: 1, name: 'User 1', email: 'user1@example.com' }
            ),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 3 } })
          })),
          all: vi.fn().mockResolvedValue({ 
            results: [
              { id: 1, name: 'User 1', email: 'user1@example.com' },
              { id: 2, name: 'User 2', email: 'user2@example.com' }
            ]
          }),
          first: vi.fn().mockResolvedValue({ count: 2 }), // Mock first() on the statement itself
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 3 } })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockDatabase as any);

      // Test getList
      const listResult = await provider.getList({ resource: 'users' });
      expect(listResult.data).toHaveLength(2);
      expect(listResult.total).toBe(2);

      // Test getOne
      const oneResult = await provider.getOne({ resource: 'users', id: 1 });
      expect(oneResult.data.id).toBe(1);

      // Test getMany
      const manyResult = await provider.getMany({ resource: 'users', ids: [1, 2] });
      expect(manyResult.data).toHaveLength(2);

      // Test create
      const createResult = await provider.create({ 
        resource: 'users', 
        variables: { name: 'New User', email: 'new@example.com' }
      });
      expect(createResult.data.id).toBe(3);

      // Test update
      const updateResult = await provider.update({ 
        resource: 'users', 
        id: 1, 
        variables: { name: 'Updated User' }
      });
      expect(updateResult.data.id).toBe(1);

      // Test delete
      const deleteResult = await provider.deleteOne({ resource: 'users', id: 1 });
      expect(deleteResult.data.id).toBe(1);
    });

    it('should handle custom queries', async () => {
      const mockDatabase = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ 
              results: [{ id: 1, custom_data: 'test' }]
            }),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
          }),
          all: vi.fn().mockResolvedValue({ 
            results: [{ id: 1, custom_data: 'test' }]
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockDatabase as any);

      // Test custom GET query
      const customResult = await provider.custom({
        url: '',
        method: 'get',
        payload: { sql: 'SELECT * FROM custom_view' }
      });
      
      expect(Array.isArray(customResult.data)).toBe(true);

      // Test custom POST query
      const customPostResult = await provider.custom({
        url: '',
        method: 'post',
        payload: { sql: 'INSERT INTO log (message) VALUES (?)', params: ['test'] }
      });
      
      expect(customPostResult.data).toBeDefined();
    });

    it('should handle error cases gracefully', async () => {
      const errorDatabase = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database connection failed');
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(errorDatabase as any);
      
      await expect(adapter.query('SELECT 1')).rejects.toThrow('Database connection failed');
    });

    it('should provide proper API URL', () => {
      const mockDatabase = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const provider = dataProvider(mockDatabase as any);
      const apiUrl = provider.getApiUrl();
      
      expect(typeof apiUrl).toBe('string');
      expect(apiUrl).toBe('/api');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent operations', async () => {
      const mockDatabase = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] })
          }),
          all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockDatabase as any);

      const promises = Array.from({ length: 10 }, () => 
        adapter.query('SELECT 1')
      );

      const start = Date.now();
      const results = await Promise.all(promises);
      const end = Date.now();

      expect(results).toHaveLength(10);
      expect(end - start).toBeLessThan(100); // Should be fast since mocked
    });

    it('should handle large data sets', async () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      const mockDatabase = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: largeDataSet })
          }),
          all: vi.fn().mockResolvedValue({ results: largeDataSet })
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockDatabase as any);

      const start = Date.now();
      const result = await adapter.query('SELECT * FROM users');
      const end = Date.now();

      expect(result).toHaveLength(1000);
      expect(end - start).toBeLessThan(50); // Should be very fast since mocked
    });

    it('should handle empty results gracefully', async () => {
      const mockDatabase = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null)
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null)
        }),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockDatabase as any);

      const queryResult = await adapter.query('SELECT * FROM empty_table');
      expect(queryResult).toEqual([]);

      const firstResult = await adapter.queryFirst('SELECT * FROM empty_table');
      expect(firstResult).toBeNull();
    });

    it('should close database connections properly', () => {
      const mockDatabase = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn(),
        close: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockDatabase as any);
      adapter.close();

      // For D1, close should not call the close method
      expect(mockDatabase.close).not.toHaveBeenCalled();
    });
  });

  describe('Type Safety and Validation', () => {
    it('should validate required parameters', () => {
      expect(() => new DatabaseAdapter(null as any)).toThrow('Database instance or path is required');
      expect(() => new DatabaseAdapter(undefined as any)).toThrow('Database instance or path is required');
    });

    it('should provide proper TypeScript interfaces', () => {
      const mockDatabase = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockDatabase as any);
      
      // These should all be functions with proper types
      expect(typeof adapter.query).toBe('function');
      expect(typeof adapter.queryFirst).toBe('function');
      expect(typeof adapter.execute).toBe('function');
      expect(typeof adapter.batch).toBe('function');
      expect(typeof adapter.close).toBe('function');
      expect(typeof adapter.getType).toBe('function');

      const provider = dataProvider(mockDatabase as any);
      
      // These should all be functions with proper types
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
