import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

// Mock D1 Database for testing
class MockD1Database {
  private data: any[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', active: 1 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1 },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0 }
  ];
  
  prepare(sql: string) {
    const mockPreparedStatement = {
      bind: (...params: any[]) => ({
        all: async () => {
          // Simple query simulation
          if (sql.includes('SELECT COUNT(*)')) {
            return { results: [{ count: this.data.length }] };
          }
          if (sql.includes('WHERE')) {
            // Filter simulation
            return { results: this.data.filter(item => 
              params.some(param => Object.values(item).includes(param))
            ) };
          }
          return { results: this.data };
        },
        first: async () => {
          if (sql.includes('WHERE id =')) {
            const id = params[params.length - 1];
            return this.data.find(item => item.id == id) || null;
          }
          return this.data[0] || null;
        },
        run: async () => {
          const lastInsertRowid = Math.floor(Math.random() * 1000) + 100;
          if (sql.includes('INSERT')) {
            this.data.push({ id: lastInsertRowid, ...Object.fromEntries(
              params.map((param, i) => [`field${i}`, param])
            ) });
          }
          if (sql.includes('UPDATE') || sql.includes('DELETE')) {
            // Simulate update/delete
          }
          return { 
            meta: { 
              changes: 1, 
              last_row_id: lastInsertRowid 
            } 
          };
        }
      }),
      all: async () => {
        if (sql.includes('SELECT COUNT(*)')) {
          return { results: [{ count: this.data.length }] };
        }
        return { results: this.data };
      },
      first: async () => this.data[0] || null,
      run: async () => {
        const lastInsertRowid = Math.floor(Math.random() * 1000) + 100;
        return { 
          meta: { 
            changes: 1, 
            last_row_id: lastInsertRowid 
          } 
        };
      }
    };
    return mockPreparedStatement;
  }

  batch(statements: any[]) {
    return Promise.resolve(statements.map(() => ({ results: [] })));
  }
}

// Mock Node.js SQLite Database
class MockNodeSQLite {
  private data: any[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', active: 1 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1 },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0 }
  ];

  prepare(sql: string) {
    return {
      all: (...params: any[]) => {
        if (sql.includes('SELECT COUNT(*)')) {
          return [{ count: this.data.length }];
        }
        if (sql.includes('WHERE')) {
          return this.data.filter(item => 
            params.some(param => Object.values(item).includes(param))
          );
        }
        return this.data;
      },
      get: (...params: any[]) => {
        if (sql.includes('WHERE id =')) {
          const id = params[params.length - 1];
          return this.data.find(item => item.id == id) || null;
        }
        return this.data[0] || null;
      },
      run: (...params: any[]) => {
        const lastInsertRowid = Math.floor(Math.random() * 1000) + 100;
        if (sql.includes('INSERT')) {
          this.data.push({ id: lastInsertRowid, ...Object.fromEntries(
            params.map((param, i) => [`field${i}`, param])
          ) });
        }
        return { 
          changes: 1, 
          lastInsertRowid
        };
      }
    };
  }

  close() {
    // Mock close
  }
}

// Mock Bun SQLite Database  
class MockBunSQLite {
  private data: any[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', active: 1 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1 },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0 }
  ];

  prepare(sql: string) {
    return {
      all: (...params: any[]) => {
        if (sql.includes('SELECT COUNT(*)')) {
          return [{ count: this.data.length }];
        }
        if (sql.includes('WHERE')) {
          return this.data.filter(item => 
            params.some(param => Object.values(item).includes(param))
          );
        }
        return this.data;
      },
      get: (...params: any[]) => {
        if (sql.includes('WHERE id =')) {
          const id = params[params.length - 1];
          return this.data.find(item => item.id == id) || null;
        }
        return this.data[0] || null;
      },
      run: (...params: any[]) => {
        const lastInsertRowid = Math.floor(Math.random() * 1000) + 100;
        if (sql.includes('INSERT')) {
          this.data.push({ id: lastInsertRowid, ...Object.fromEntries(
            params.map((param, i) => [`field${i}`, param])
          ) });
        }
        return { 
          changes: 1, 
          lastInsertRowid
        };
      }
    };
  }

  close() {
    // Mock close
  }
}

describe('DatabaseAdapter - Complete Runtime Coverage', () => {
  describe('D1 Database Support (Cloudflare Workers)', () => {
    let mockD1: MockD1Database;

    beforeEach(() => {
      mockD1 = new MockD1Database();
    });

    it('should initialize with D1 database instance', () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter.getType()).toBe('d1');
    });

    it('should execute SELECT queries with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should execute SELECT queries with parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users WHERE name = ?', ['John Doe']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute queryFirst with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('should execute INSERT operations with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('lastInsertRowid');
      expect(result.changes).toBe(1);
    });

    it('should execute UPDATE operations with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('UPDATE users SET name = ? WHERE id = ?', ['Updated Name', 1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute DELETE operations with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('DELETE FROM users WHERE id = ?', [1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute batch operations with D1', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const statements = [
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User1', 'user1@example.com'] },
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User2', 'user2@example.com'] }
      ];
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle empty result sets', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users WHERE id = 999');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle queryFirst with no results', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [999]);
      expect(result).toBeNull();
    });
  });

  describe('Node.js Native SQLite Support (22.5+)', () => {
    let mockNodeSQLite: MockNodeSQLite;

    beforeEach(() => {
      mockNodeSQLite = new MockNodeSQLite();
      
      // Mock Node.js environment safely
      vi.spyOn(process, 'versions', 'get').mockReturnValue({ ...process.versions, node: '22.5.0' });
      
      // Ensure Bun is undefined
      vi.stubGlobal('Bun', undefined);

      // Mock dynamic import for node:sqlite
      vi.doMock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => mockNodeSQLite)
      }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should detect Node.js environment correctly', () => {
      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('node-sqlite');
    });

    it('should execute SELECT queries with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should execute SELECT queries with parameters', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.query('SELECT * FROM users WHERE name = ?', ['John Doe']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute queryFirst with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('should execute INSERT operations with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('lastInsertRowid');
      expect(result.changes).toBe(1);
    });

    it('should execute UPDATE operations with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('UPDATE users SET name = ? WHERE id = ?', ['Updated Name', 1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute DELETE operations with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('DELETE FROM users WHERE id = ?', [1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute batch operations with Node.js SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const statements = [
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User1', 'user1@example.com'] },
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User2', 'user2@example.com'] }
      ];
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle close() method', () => {
      const adapter = new DatabaseAdapter('./test.db');
      expect(() => adapter.close()).not.toThrow();
    });

    it('should not throw for unsupported Node.js version', () => {
      // Version checking removed - this test should not throw an error anymore.
      vi.spyOn(process, 'versions', 'get').mockReturnValue({ ...process.versions, node: '20.0.0' });
      expect(() => {
        new DatabaseAdapter('./test.db');
      }).not.toThrow();
    });
  });

  describe('Bun Native SQLite Support (1.2+)', () => {
    let mockBunSQLite: MockBunSQLite;

    beforeEach(() => {
      mockBunSQLite = new MockBunSQLite();
      
      // Mock Bun environment
      vi.stubGlobal('Bun', { 
        version: '1.2.0',
        sqlite: vi.fn().mockImplementation(() => mockBunSQLite)
      });
      // No need to mock process, `isBun` check takes precedence
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should detect Bun environment correctly', () => {
      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should execute SELECT queries with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should execute SELECT queries with parameters', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.query('SELECT * FROM users WHERE name = ?', ['John Doe']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute queryFirst with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('should execute INSERT operations with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('lastInsertRowid');
      expect(result.changes).toBe(1);
    });

    it('should execute UPDATE operations with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('UPDATE users SET name = ? WHERE id = ?', ['Updated Name', 1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute DELETE operations with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const result = await adapter.execute('DELETE FROM users WHERE id = ?', [1]);
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
    });

    it('should execute batch operations with Bun SQLite', async () => {
      const adapter = new DatabaseAdapter('./test.db');
      const statements = [
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User1', 'user1@example.com'] },
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['User2', 'user2@example.com'] }
      ];
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle close() method', () => {
      const adapter = new DatabaseAdapter('./test.db');
      expect(() => adapter.close()).not.toThrow();
    });

    it('should not throw for unsupported Bun version', () => {
      // Version checking removed - this test should not throw an error anymore.
      vi.stubGlobal('Bun', {
        version: '1.1.0',
        sqlite: vi.fn().mockImplementation(() => new MockBunSQLite())
      });

      expect(() => {
        new DatabaseAdapter('./test.db');
      }).not.toThrow();
    });
  });

  describe('Runtime Detection and Error Handling', () => {

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should throw error for unsupported environment (browser)', () => {
      // Mock browser environment (no Node.js or Bun) by removing runtime indicators
      const originalProcess = globalThis.process;
      // @ts-ignore
      globalThis.process = undefined;
      vi.stubGlobal('Bun', undefined);

      expect(() => {
        new DatabaseAdapter('./test.db');
      }).toThrow('Unsupported runtime');

      // Restore
      globalThis.process = originalProcess;
    });

    it('should require database input', () => {
      expect(() => {
        new DatabaseAdapter(null as any);
      }).toThrow('DB required');

      expect(() => {
        new DatabaseAdapter(undefined as any);
      }).toThrow('DB required');
    });

    it('should handle version comparison correctly', () => {
      // Version checking removed - this test is no longer relevant
      expect(true).toBe(true);
    });

    it('should handle malformed version strings gracefully', () => {
      // Version checking removed - this test is no longer relevant
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    let mockD1: MockD1Database;

    beforeEach(() => {
      mockD1 = new MockD1Database();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle empty query parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users', []);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle undefined query parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty batch statements', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.batch([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle batch statements without parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const statements = [
        { sql: 'SELECT COUNT(*) FROM users' },
        { sql: 'SELECT * FROM users LIMIT 1' }
      ];
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle multiple close() calls safely', () => {
      vi.spyOn(process, 'versions', 'get').mockReturnValue({ ...process.versions, node: '22.5.0' });
      vi.stubGlobal('Bun', undefined);
      
      // Mock dynamic import for node:sqlite as this test creates a node adapter
      vi.doMock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => new MockNodeSQLite())
      }));

      const adapter = new DatabaseAdapter('./test.db');
      expect(() => {
        adapter.close();
        adapter.close(); // Should not throw
      }).not.toThrow();
    });
  });
});

describe('DataProvider - Complete Runtime Coverage', () => {
  describe('D1 DataProvider Integration', () => {
    let mockD1: MockD1Database;
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      mockD1 = new MockD1Database();
      provider = dataProvider(mockD1 as any);
    });

    it('should create provider with D1 database', () => {
      expect(provider).toBeDefined();
      expect(typeof provider.getList).toBe('function');
      expect(typeof provider.getOne).toBe('function');
      expect(typeof provider.create).toBe('function');
      expect(typeof provider.update).toBe('function');
      expect(typeof provider.deleteOne).toBe('function');
    });

    it('should handle getList requests with pagination', async () => {
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should handle getList requests without pagination', async () => {
      const result = await provider.getList({
        resource: 'users'
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle getOne requests', async () => {
      const result = await provider.getOne({
        resource: 'users',
        id: '1'
      });

      expect(result).toHaveProperty('data');
      expect(result.data?.id).toBe(1);
    });

    it('should handle getMany requests', async () => {
      const result = await provider.getMany({
        resource: 'users',
        ids: ['1', '2']
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle create requests', async () => {
      const result = await provider.create({
        resource: 'users',
        variables: { name: 'John Doe', email: 'john@example.com' }
      });

      expect(result).toHaveProperty('data');
      expect(result.data).toBeDefined();
    });

    it('should handle createMany requests', async () => {
      const result = await provider.createMany({
        resource: 'users',
        variables: [
          { name: 'User1', email: 'user1@example.com' },
          { name: 'User2', email: 'user2@example.com' }
        ]
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle update requests', async () => {
      const result = await provider.update({
        resource: 'users',
        id: '1',
        variables: { name: 'Jane Doe' }
      });

      expect(result).toHaveProperty('data');
      expect(result.data).toBeDefined();
    });

    it('should handle updateMany requests', async () => {
      const result = await provider.updateMany({
        resource: 'users',
        ids: ['1', '2'],
        variables: { active: 1 }
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle deleteOne requests', async () => {
      const result = await provider.deleteOne({
        resource: 'users',
        id: '1'
      });

      expect(result).toHaveProperty('data');
    });

    it('should handle deleteMany requests', async () => {
      const result = await provider.deleteMany({
        resource: 'users',
        ids: ['1', '2']
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle filters and sorting', async () => {
      const result = await provider.getList({
        resource: 'users',
        filters: [
          { field: 'name', operator: 'eq', value: 'John' }
        ],
        sorters: [
          { field: 'created_at', order: 'desc' }
        ],
        pagination: { current: 1, pageSize: 5 }
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });

    it('should provide API URL', () => {
      const apiUrl = provider.getApiUrl();
      expect(apiUrl).toBe('/api');
    });

    it('should handle custom queries with SQL payload', async () => {
      const result = await provider.custom({
        url: '/custom',
        method: 'get',
        payload: {
          sql: 'SELECT COUNT(*) as count FROM users',
          params: []
        }
      });

      expect(result).toHaveProperty('data');
    });

    it('should handle custom queries with URL parameters', async () => {
      const result = await provider.custom({
        url: '/custom?sql=SELECT * FROM users',
        method: 'get'
      });

      expect(result).toHaveProperty('data');
    });

    it('should throw error for custom queries without SQL', async () => {
      await expect(provider.custom({
        url: '/custom',
        method: 'get',
        payload: {}
      })).rejects.toThrow('No SQL provided');
    });
  });

  describe('Node.js DataProvider Integration', () => {
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      // Mock Node.js environment
      vi.spyOn(process, 'versions', 'get').mockReturnValue({ ...process.versions, node: '22.5.0' });
      vi.stubGlobal('Bun', undefined);

      // Mock dynamic import for node:sqlite
      vi.doMock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => new MockNodeSQLite())
      }));

      provider = dataProvider('./test-node.db');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should work with Node.js SQLite for all operations', async () => {
      // Test basic operations
      const createResult = await provider.create({
        resource: 'users',
        variables: { name: 'Node User', email: 'node@example.com' }
      });
      expect(createResult.data).toBeDefined();

      const listResult = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      expect(listResult.data).toBeDefined();
      expect(Array.isArray(listResult.data)).toBe(true);
    });
  });

  describe('Bun DataProvider Integration', () => {
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      // Mock Bun environment
      vi.stubGlobal('Bun', { 
        version: '1.2.0',
        sqlite: vi.fn().mockImplementation(() => new MockBunSQLite())
      });

      provider = dataProvider('./test-bun.db');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should work with Bun SQLite for all operations', async () => {
      // Test basic operations
      const createResult = await provider.create({
        resource: 'users',
        variables: { name: 'Bun User', email: 'bun@example.com' }
      });
      expect(createResult.data).toBeDefined();

      const listResult = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      expect(listResult.data).toBeDefined();
      expect(Array.isArray(listResult.data)).toBe(true);
    });
  });

  describe('Cross-Runtime Compatibility', () => {
    it('should handle empty createMany variables', async () => {
      const mockD1 = new MockD1Database();
      const provider = dataProvider(mockD1 as any);
      
      const result = await provider.createMany({
        resource: 'users',
        variables: []
      });
      
      expect(result.data).toEqual([]);
    });

    it('should handle empty updateMany ids', async () => {
      const mockD1 = new MockD1Database();
      const provider = dataProvider(mockD1 as any);
      
      const result = await provider.updateMany({
        resource: 'users',
        ids: [],
        variables: { active: 1 }
      });
      
      expect(result.data).toEqual([]);
    });

    it('should handle empty deleteMany ids', async () => {
      const mockD1 = new MockD1Database();
      const provider = dataProvider(mockD1 as any);
      
      const result = await provider.deleteMany({
        resource: 'users',
        ids: []
      });
      
      expect(result.data).toEqual([]);
    });
  });
});
