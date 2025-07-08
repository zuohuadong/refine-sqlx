import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

// Comprehensive D1 Mock that simulates real D1 behavior
class ComprehensiveD1Mock {
  private tables: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with some test data
    this.tables.set('users', [
      { id: 1, name: 'John Doe', email: 'john@example.com', active: 1, created_at: '2023-01-01' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1, created_at: '2023-01-02' },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0, created_at: '2023-01-03' }
    ]);
    this.tables.set('posts', [
      { id: 1, title: 'First Post', content: 'Content 1', user_id: 1, published: 1 },
      { id: 2, title: 'Second Post', content: 'Content 2', user_id: 2, published: 1 }
    ]);
    this.nextId = 4; // Start from 4 since we have 3 users already
  }

  prepare(sql: string) {
    const normalizedSQL = sql.trim().toLowerCase();
    
    return {
      bind: (...params: any[]) => ({
        all: async () => this.executeQuery(sql, params),
        first: async () => {
          const result = this.executeQuery(sql, params);
          return result.results?.[0] || null;
        },
        run: async () => this.executeStatement(sql, params)
      }),
      all: async () => this.executeQuery(sql, []),
      first: async () => {
        const result = this.executeQuery(sql, []);
        return result.results?.[0] || null;
      },
      run: async () => this.executeStatement(sql, [])
    };
  }

  batch(statements: any[]) {
    return Promise.resolve(statements.map(stmt => {
      if (typeof stmt.all === 'function') {
        return stmt.all();
      }
      return { results: [] };
    }));
  }

  private executeQuery(sql: string, params: any[]): { results: any[] } {
    const normalizedSQL = sql.trim().toLowerCase();
    
    // Handle SELECT queries
    if (normalizedSQL.startsWith('select')) {
      return this.handleSelect(sql, params);
    }
    
    return { results: [] };
  }

  private executeStatement(sql: string, params: any[]): { meta: { changes: number; last_row_id?: number } } {
    const normalizedSQL = sql.trim().toLowerCase();
    
    if (normalizedSQL.startsWith('insert')) {
      return this.handleInsert(sql, params);
    } else if (normalizedSQL.startsWith('update')) {
      return this.handleUpdate(sql, params);
    } else if (normalizedSQL.startsWith('delete')) {
      return this.handleDelete(sql, params);
    } else if (normalizedSQL.startsWith('create table')) {
      return this.handleCreateTable(sql, params);
    }
    
    return { meta: { changes: 0 } };
  }

  private handleSelect(sql: string, params: any[]): { results: any[] } {
    // Extract table name
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) return { results: [] };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // Handle COUNT queries
    if (sql.toLowerCase().includes('count(*)')) {
      return { results: [{ count: tableData.length }] };
    }
    
    // Handle WHERE clauses
    if (sql.toLowerCase().includes('where')) {
      const filtered = this.applyWhereClause(tableData, sql, params);
      return { results: filtered };
    }
    
    // Handle LIMIT and OFFSET
    let results = [...tableData];
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    const offsetMatch = sql.match(/offset\s+(\d+)/i);
    
    if (offsetMatch) {
      const offset = parseInt(offsetMatch[1]);
      results = results.slice(offset);
    }
    
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }
    
    return { results };
  }

  private handleInsert(sql: string, params: any[]): { meta: { changes: number; last_row_id: number } } {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0, last_row_id: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // Extract column names and values
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/['"]/g, ''));
      const newRecord: any = { id: this.nextId++ };
      
      // Map parameters to columns (skip 'id' if it's auto-generated)
      let paramIndex = 0;
      columns.forEach((col) => {
        if (col !== 'id') {
          newRecord[col] = params[paramIndex++];
        }
      });
      
      tableData.push(newRecord);
      this.tables.set(tableName, tableData);
      
      return { meta: { changes: 1, last_row_id: newRecord.id } };
    }
    
    return { meta: { changes: 0, last_row_id: 0 } };
  }

  private handleUpdate(sql: string, params: any[]): { meta: { changes: number } } {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // Simple update implementation
    const whereMatch = sql.match(/where\s+id\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const id = params[params.length - 1];
      const recordIndex = tableData.findIndex(record => record.id == id);
      
      if (recordIndex >= 0) {
        // Update the record with new values
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          const setValue = setMatch[1];
          const fieldMatch = setValue.match(/(\w+)\s*=\s*\?/);
          if (fieldMatch && params.length > 1) {
            const fieldName = fieldMatch[1];
            tableData[recordIndex][fieldName] = params[0];
            return { meta: { changes: 1 } };
          }
        }
      }
    }
    
    return { meta: { changes: 0 } };
  }

  private handleDelete(sql: string, params: any[]): { meta: { changes: number } } {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    const whereMatch = sql.match(/where\s+id\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const id = params[0];
      const originalLength = tableData.length;
      const filtered = tableData.filter(record => record.id != id);
      
      this.tables.set(tableName, filtered);
      return { meta: { changes: originalLength - filtered.length } };
    }
    
    return { meta: { changes: 0 } };
  }

  private handleCreateTable(sql: string, params: any[]): { meta: { changes: number } } {
    const tableMatch = sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }

  private applyWhereClause(data: any[], sql: string, params: any[]): any[] {
    // Handle specific WHERE patterns
    
    // Single ID lookup: WHERE id = ?
    if (sql.match(/where\s+id\s*=\s*\?/i) && params.length > 0) {
      const id = params[0];
      return data.filter(record => record.id == id);
    }
    
    // IN clause: WHERE id IN (?, ?, ...)
    if (sql.match(/where\s+id\s+in\s*\(/i)) {
      return data.filter(record => params.includes(record.id.toString()) || params.includes(record.id));
    }
    
    // Multiple conditions with AND/OR
    if (sql.includes('WHERE') || sql.includes('where')) {
      // For complex conditions, implement basic filtering
      if (params.length > 0) {
        return data.filter(record => {
          // Simple approach: match any parameter value to any record field
          return params.some(param => 
            Object.values(record).includes(param) ||
            Object.values(record).includes(param.toString())
          );
        });
      }
    }
    
    return data;
  }

  // Helper method to reset data
  reset() {
    this.tables.clear();
    this.nextId = 1;
  }

  // Helper method to add test data
  addTestData(tableName: string, data: any[]) {
    this.tables.set(tableName, data);
  }

  // Helper method to get table data
  getTableData(tableName: string): any[] {
    return this.tables.get(tableName) || [];
  }
}

describe('D1 Database Complete Coverage Tests', () => {
  let mockD1: ComprehensiveD1Mock;

  beforeEach(() => {
    mockD1 = new ComprehensiveD1Mock();
  });

  describe('DatabaseAdapter D1 Core Functionality', () => {
    it('should initialize with D1 database instance', () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter.getType()).toBe('d1');
    });

    it('should execute basic SELECT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('email');
    });

    it('should execute parameterized SELECT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('John Doe');
    });

    it('should execute COUNT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT COUNT(*) as count FROM users');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].count).toBe(3);
    });

    it('should execute queryFirst for single records', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [2]);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(2);
      expect(result.name).toBe('Jane Smith');
    });

    it('should return null for queryFirst with no results', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [999]);
      
      expect(result).toBeNull();
    });

    it('should execute INSERT operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute(
        'INSERT INTO users (name, email, active) VALUES (?, ?, ?)',
        ['New User', 'new@example.com', 1]
      );
      
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('lastInsertRowid');
      expect(result.changes).toBe(1);
      expect(typeof result.lastInsertRowid).toBe('number');
      
      // Verify the record was inserted
      const insertedRecord = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
      expect(insertedRecord).toBeDefined();
      expect(insertedRecord.name).toBe('New User');
    });

    it('should execute UPDATE operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        ['Updated Name', 1]
      );
      
      expect(result.changes).toBe(1);
      
      // Verify the record was updated
      const updatedRecord = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(updatedRecord.name).toBe('Updated Name');
    });

    it('should execute DELETE operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('DELETE FROM users WHERE id = ?', [3]);
      
      expect(result.changes).toBe(1);
      
      // Verify the record was deleted
      const deletedRecord = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [3]);
      expect(deletedRecord).toBeNull();
    });

    it('should execute DDL operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);
      
      expect(result.changes).toBe(1);
    });

    it('should execute batch operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const statements = [
        { sql: 'INSERT INTO users (name, email, active) VALUES (?, ?, ?)', params: ['Batch User 1', 'batch1@example.com', 1] },
        { sql: 'INSERT INTO users (name, email, active) VALUES (?, ?, ?)', params: ['Batch User 2', 'batch2@example.com', 1] },
        { sql: 'UPDATE users SET active = ? WHERE name = ?', params: [0, 'Batch User 1'] }
      ];
      
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(3);
    });

    it('should handle empty batch operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const results = await adapter.batch([]);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    it('should handle queries with no parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM posts');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should handle LIMIT and OFFSET in queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users LIMIT 2 OFFSET 1');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe('DataProvider D1 Complete CRUD Operations', () => {
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      provider = dataProvider(mockD1 as any);
    });

    describe('getList Operations', () => {
      it('should handle getList with pagination', async () => {
        const result = await provider.getList({
          resource: 'users',
          pagination: { current: 1, pageSize: 2 }
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(typeof result.total).toBe('number');
        expect(result.total).toBe(3);
      });

      it('should handle getList without pagination', async () => {
        const result = await provider.getList({
          resource: 'users'
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should handle getList with filters', async () => {
        const result = await provider.getList({
          resource: 'users',
          filters: [
            { field: 'active', operator: 'eq', value: 1 }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });

      it('should handle getList with multiple filters', async () => {
        const result = await provider.getList({
          resource: 'users',
          filters: [
            { field: 'active', operator: 'eq', value: 1 },
            { field: 'name', operator: 'contains', value: 'John' }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });

      it('should handle getList with sorting', async () => {
        const result = await provider.getList({
          resource: 'users',
          sorters: [
            { field: 'name', order: 'asc' }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });

      it('should handle getList with multiple sorters', async () => {
        const result = await provider.getList({
          resource: 'users',
          sorters: [
            { field: 'active', order: 'desc' },
            { field: 'name', order: 'asc' }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });

      it('should handle getList with filters, sorting, and pagination', async () => {
        const result = await provider.getList({
          resource: 'users',
          pagination: { current: 1, pageSize: 10 },
          filters: [
            { field: 'active', operator: 'eq', value: 1 }
          ],
          sorters: [
            { field: 'created_at', order: 'desc' }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });
    });

    describe('Single Record Operations', () => {
      it('should handle getOne operations', async () => {
        const result = await provider.getOne({
          resource: 'users',
          id: '1'
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(1);
      });

      it('should handle getMany operations', async () => {
        const result = await provider.getMany({
          resource: 'users',
          ids: ['1', '2']
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(2);
      });

      it('should handle getMany with empty ids', async () => {
        const result = await provider.getMany({
          resource: 'users',
          ids: []
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should handle getMany with non-existent ids', async () => {
        const result = await provider.getMany({
          resource: 'users',
          ids: ['999', '1000']
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('Create Operations', () => {
      it('should handle create operations', async () => {
        const result = await provider.create({
          resource: 'users',
          variables: {
            name: 'Test User',
            email: 'test@example.com',
            active: 1
          }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe('Test User');
        expect(result.data.email).toBe('test@example.com');
      });

      it('should handle create with minimal data', async () => {
        const result = await provider.create({
          resource: 'users',
          variables: {
            name: 'Minimal User'
          }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe('Minimal User');
      });

      it('should handle createMany operations', async () => {
        const result = await provider.createMany({
          resource: 'users',
          variables: [
            { name: 'User 1', email: 'user1@example.com', active: 1 },
            { name: 'User 2', email: 'user2@example.com', active: 1 },
            { name: 'User 3', email: 'user3@example.com', active: 0 }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(3);
      });

      it('should handle createMany with empty variables', async () => {
        const result = await provider.createMany({
          resource: 'users',
          variables: []
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(0);
      });
    });

    describe('Update Operations', () => {
      it('should handle update operations', async () => {
        const result = await provider.update({
          resource: 'users',
          id: '1',
          variables: {
            name: 'Updated John Doe',
            email: 'updated.john@example.com'
          }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe('Updated John Doe');
      });

      it('should handle partial updates', async () => {
        const result = await provider.update({
          resource: 'users',
          id: '2',
          variables: {
            active: 0
          }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.active).toBe(0);
      });

      it('should handle updateMany operations', async () => {
        const result = await provider.updateMany({
          resource: 'users',
          ids: ['1', '2'],
          variables: {
            active: 1
          }
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(2);
      });

      it('should handle updateMany with empty ids', async () => {
        const result = await provider.updateMany({
          resource: 'users',
          ids: [],
          variables: {
            active: 1
          }
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(0);
      });
    });

    describe('Delete Operations', () => {
      it('should handle deleteOne operations', async () => {
        const result = await provider.deleteOne({
          resource: 'users',
          id: '3'
        });
        
        expect(result.data).toBeDefined();
      });

      it('should handle deleteMany operations', async () => {
        const result = await provider.deleteMany({
          resource: 'users',
          ids: ['1', '2']
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(2);
      });

      it('should handle deleteMany with empty ids', async () => {
        const result = await provider.deleteMany({
          resource: 'users',
          ids: []
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(0);
      });

      it('should handle deleteMany with non-existent ids', async () => {
        const result = await provider.deleteMany({
          resource: 'users',
          ids: ['999', '1000']
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('Custom Operations', () => {
      it('should handle custom queries with SQL payload', async () => {
        const result = await provider.custom({
          url: '/custom',
          method: 'get',
          payload: {
            sql: 'SELECT COUNT(*) as total FROM users',
            params: []
          }
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should handle custom queries with URL parameters', async () => {
        const result = await provider.custom({
          url: '/custom?sql=SELECT * FROM users LIMIT 1',
          method: 'get'
        });
        
        expect(result.data).toBeDefined();
      });

      it('should handle custom POST operations', async () => {
        const result = await provider.custom({
          url: '/custom',
          method: 'post',
          payload: {
            sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
            params: ['Custom User', 'custom@example.com']
          }
        });
        
        expect(result.data).toBeDefined();
      });

      it('should throw error for custom queries without SQL', async () => {
        await expect(provider.custom({
          url: '/custom',
          method: 'get',
          payload: {}
        })).rejects.toThrow('No SQL query provided for custom method');
      });

      it('should throw error for custom queries with invalid payload', async () => {
        await expect(provider.custom({
          url: '/custom',
          method: 'get',
          payload: null
        })).rejects.toThrow('No SQL query provided for custom method');
      });

      it('should provide API URL', () => {
        const apiUrl = provider.getApiUrl();
        expect(apiUrl).toBe('/api');
      });
    });

    describe('Complex Query Scenarios', () => {
      it('should handle complex filtering scenarios', async () => {
        const result = await provider.getList({
          resource: 'users',
          filters: [
            { field: 'active', operator: 'eq', value: 1 },
            { field: 'name', operator: 'contains', value: 'John' },
            { field: 'created_at', operator: 'gte', value: '2023-01-01' }
          ]
        });
        
        expect(result.data).toBeDefined();
        expect(result.total).toBeDefined();
      });

      it('should handle joins through custom queries', async () => {
        const result = await provider.custom({
          url: '/custom',
          method: 'get',
          payload: {
            sql: `
              SELECT u.name, p.title 
              FROM users u 
              JOIN posts p ON u.id = p.user_id 
              WHERE u.active = ?
            `,
            params: [1]
          }
        });
        
        expect(result.data).toBeDefined();
      });

      it('should handle aggregation queries', async () => {
        const result = await provider.custom({
          url: '/stats',
          method: 'get',
          payload: {
            sql: `
              SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN active = 1 THEN 1 END) as active_users,
                COUNT(CASE WHEN active = 0 THEN 1 END) as inactive_users
              FROM users
            `,
            params: []
          }
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle operations on non-existent resources gracefully', async () => {
        const result = await provider.getList({
          resource: 'non_existent_table'
        });
        
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should handle malformed SQL in custom queries', async () => {
        await expect(provider.custom({
          url: '/custom',
          method: 'get',
          payload: {
            sql: 'INVALID SQL QUERY',
            params: []
          }
        })).resolves.toBeDefined(); // Should not throw, might return empty results
      });

      it('should handle very large parameter arrays', async () => {
        const largeParams = Array.from({ length: 1000 }, (_, i) => `param${i}`);
        const placeholders = largeParams.map(() => '?').join(', ');
        
        const result = await provider.custom({
          url: '/custom',
          method: 'get',
          payload: {
            sql: `SELECT * FROM users WHERE id IN (${placeholders})`,
            params: largeParams
          }
        });
        
        expect(result.data).toBeDefined();
      });

      it('should handle special characters in data', async () => {
        const result = await provider.create({
          resource: 'users',
          variables: {
            name: "O'Connor's Test & Data",
            email: 'special+chars@example.com'
          }
        });
        
        expect(result.data).toBeDefined();
      });

      it('should handle unicode characters', async () => {
        const result = await provider.create({
          resource: 'users',
          variables: {
            name: '测试用户 🚀 José María',
            email: 'unicode@example.com'
          }
        });
        
        expect(result.data).toBeDefined();
      });
    });
  });

  describe('D1 Performance and Scalability', () => {
    it('should handle large result sets efficiently', async () => {
      // Add large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 100,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: i % 2
      }));
      
      mockD1.addTestData('large_users', largeDataset);
      
      const adapter = new DatabaseAdapter(mockD1 as any);
      const start = Date.now();
      const result = await adapter.query('SELECT * FROM large_users');
      const duration = Date.now() - start;
      
      expect(result.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations efficiently', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      
      // Run multiple queries concurrently
      const promises = Array.from({ length: 50 }, (_, i) => 
        adapter.query(`SELECT * FROM users WHERE id = ?`, [i % 3 + 1])
      );
      
      const start = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - start;
      
      expect(results.length).toBe(50);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle batch operations with many statements', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      
      const statements = Array.from({ length: 100 }, (_, i) => ({
        sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
        params: [`Batch User ${i}`, `batch${i}@example.com`]
      }));
      
      const start = Date.now();
      const results = await adapter.batch(statements);
      const duration = Date.now() - start;
      
      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });
});
