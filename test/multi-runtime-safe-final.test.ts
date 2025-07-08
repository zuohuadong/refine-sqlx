import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

// Enhanced Mock for D1 Database
class SafeD1Mock {
  private tables: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    this.tables.set('users', [
      { id: 1, name: 'John Doe', email: 'john@example.com', active: 1 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1 },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0 }
    ]);
    this.nextId = 4;
  }

  prepare(sql: string) {
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
    return Promise.resolve(statements.map(() => ({ results: [] })));
  }

  private executeQuery(sql: string, params: any[]): { results: any[] } {
    const normalizedSQL = sql.trim().toLowerCase();
    
    if (normalizedSQL.startsWith('select')) {
      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) return { results: [] };
      
      const tableName = tableMatch[1];
      const tableData = this.tables.get(tableName) || [];
      
      if (sql.toLowerCase().includes('count(*)')) {
        return { results: [{ count: tableData.length }] };
      }
      
      if (sql.toLowerCase().includes('where')) {
        return { results: this.applyWhereClause(tableData, sql, params) };
      }
      
      return { results: [...tableData] };
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
    }
    
    return { meta: { changes: 0 } };
  }

  private handleInsert(sql: string, params: any[]): { meta: { changes: number; last_row_id: number } } {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0, last_row_id: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/['"]/g, ''));
      const newRecord: any = { id: this.nextId++ };
      
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
    
    if (sql.includes('WHERE id = ?') && params.length > 0) {
      const id = params[params.length - 1];
      const recordIndex = tableData.findIndex(record => record.id == id);
      
      if (recordIndex >= 0) {
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch && params.length > 1) {
          const fieldMatch = setMatch[1].match(/(\w+)\s*=\s*\?/);
          if (fieldMatch) {
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
    
    if (sql.includes('WHERE id = ?') && params.length > 0) {
      const id = params[0];
      const originalLength = tableData.length;
      const filtered = tableData.filter(record => record.id != id);
      
      this.tables.set(tableName, filtered);
      return { meta: { changes: originalLength - filtered.length } };
    }
    
    return { meta: { changes: 0 } };
  }

  private applyWhereClause(data: any[], sql: string, params: any[]): any[] {
    if (sql.match(/where\s+id\s*=\s*\?/i) && params.length > 0) {
      const id = params[0];
      return data.filter(record => record.id == id);
    }
    
    if (sql.match(/where\s+id\s+in\s*\(/i)) {
      return data.filter(record => 
        params.includes(record.id.toString()) || params.includes(record.id)
      );
    }
    
    return data;
  }

  reset() {
    this.tables.clear();
    this.initializeTestData();
  }
}

// Enhanced Mock for Bun SQLite
class SafeBunSQLiteMock {
  private tables: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    this.tables.set('users', [
      { id: 1, name: 'John Doe', email: 'john@example.com', active: 1 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1 },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0 }
    ]);
    this.nextId = 4;
  }

  prepare(sql: string) {
    return {
      all: (...params: any[]) => this.executeQuery(sql, params),
      get: (...params: any[]) => {
        const result = this.executeQuery(sql, params);
        return result[0] || null;
      },
      run: (...params: any[]) => this.executeStatement(sql, params)
    };
  }

  private executeQuery(sql: string, params: any[]): any[] {
    const normalizedSQL = sql.trim().toLowerCase();
    
    if (normalizedSQL.startsWith('select')) {
      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) return [];
      
      const tableName = tableMatch[1];
      const tableData = this.tables.get(tableName) || [];
      
      if (sql.toLowerCase().includes('count(*)')) {
        return [{ count: tableData.length }];
      }
      
      if (sql.toLowerCase().includes('where')) {
        return this.applyWhereClause(tableData, sql, params);
      }
      
      return [...tableData];
    }
    
    return [];
  }

  private executeStatement(sql: string, params: any[]): { changes: number; lastInsertRowid?: number } {
    const normalizedSQL = sql.trim().toLowerCase();
    
    if (normalizedSQL.startsWith('insert')) {
      return this.handleInsert(sql, params);
    } else if (normalizedSQL.startsWith('update')) {
      return this.handleUpdate(sql, params);
    } else if (normalizedSQL.startsWith('delete')) {
      return this.handleDelete(sql, params);
    }
    
    return { changes: 0 };
  }

  private handleInsert(sql: string, params: any[]): { changes: number; lastInsertRowid: number } {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) return { changes: 0, lastInsertRowid: 0 };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/['"]/g, ''));
      const newRecord: any = { id: this.nextId++ };
      
      let paramIndex = 0;
      columns.forEach((col) => {
        if (col !== 'id') {
          newRecord[col] = params[paramIndex++];
        }
      });
      
      tableData.push(newRecord);
      this.tables.set(tableName, tableData);
      
      return { changes: 1, lastInsertRowid: newRecord.id };
    }
    
    return { changes: 0, lastInsertRowid: 0 };
  }

  private handleUpdate(sql: string, params: any[]): { changes: number } {
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    if (sql.includes('WHERE id = ?') && params.length > 0) {
      const id = params[params.length - 1];
      const recordIndex = tableData.findIndex(record => record.id == id);
      
      if (recordIndex >= 0) {
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch && params.length > 1) {
          const fieldMatch = setMatch[1].match(/(\w+)\s*=\s*\?/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            tableData[recordIndex][fieldName] = params[0];
            return { changes: 1 };
          }
        }
      }
    }
    
    return { changes: 0 };
  }

  private handleDelete(sql: string, params: any[]): { changes: number } {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    if (sql.includes('WHERE id = ?') && params.length > 0) {
      const id = params[0];
      const originalLength = tableData.length;
      const filtered = tableData.filter(record => record.id != id);
      
      this.tables.set(tableName, filtered);
      return { changes: originalLength - filtered.length };
    }
    
    return { changes: 0 };
  }

  private applyWhereClause(data: any[], sql: string, params: any[]): any[] {
    if (sql.match(/where\s+id\s*=\s*\?/i) && params.length > 0) {
      const id = params[0];
      return data.filter(record => record.id == id);
    }
    
    if (sql.match(/where\s+id\s+in\s*\(/i)) {
      return data.filter(record => 
        params.includes(record.id.toString()) || params.includes(record.id)
      );
    }
    
    return data;
  }

  close() {
    // Mock close method
  }

  reset() {
    this.tables.clear();
    this.initializeTestData();
  }
}

describe('Multi-Runtime Safe Integration Tests', () => {
  let originalBun: any;
  let originalProcess: any;

  beforeEach(() => {
    // Save original globals
    originalBun = (globalThis as any).Bun;
    originalProcess = (globalThis as any).process;
  });

  afterEach(() => {
    // Restore original globals
    if (originalBun !== undefined) {
      (globalThis as any).Bun = originalBun;
    } else {
      delete (globalThis as any).Bun;
    }
    if (originalProcess !== undefined) {
      (globalThis as any).process = originalProcess;
    } else {
      delete (globalThis as any).process;
    }
  });

  describe('Runtime Detection', () => {
    it('should detect D1 environment', () => {
      const mockD1 = new SafeD1Mock();
      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter.getType()).toBe('d1');
    });

    it('should detect Bun environment simulation', () => {
      // Test Bun detection logic without affecting global state
      const mockBunSQLite = new SafeBunSQLiteMock();
      
      // Simulate Bun environment temporarily
      const originalBun = (globalThis as any).Bun;
      const originalProcess = (globalThis as any).process;
      
      try {
        (globalThis as any).Bun = {
          version: '1.2.0',
          sqlite: class {
            constructor() {
              return mockBunSQLite;
            }
          }
        };
        delete (globalThis as any).process;
        
        const adapter = new DatabaseAdapter('./test.db');
        expect(adapter.getType()).toBe('bun-sqlite');
      } finally {
        (globalThis as any).Bun = originalBun;
        (globalThis as any).process = originalProcess;
      }
    });

    it('should handle runtime detection errors gracefully', () => {
      // Simulate unsupported environment
      const originalBun = (globalThis as any).Bun;
      const originalProcess = (globalThis as any).process;
      
      try {
        delete (globalThis as any).Bun;
        delete (globalThis as any).process;
        
        expect(() => new DatabaseAdapter('./test.db')).toThrow('SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments');
      } finally {
        (globalThis as any).Bun = originalBun;
        (globalThis as any).process = originalProcess;
      }
    });
  });

  describe('D1 Runtime Compatibility', () => {
    let d1Mock: SafeD1Mock;
    let provider: ReturnType<typeof dataProvider>;

    beforeEach(() => {
      d1Mock = new SafeD1Mock();
      provider = dataProvider(d1Mock as any);
    });

    it('should handle D1 adapter creation', () => {
      const adapter = new DatabaseAdapter(d1Mock as any);
      expect(adapter.getType()).toBe('d1');
    });

    it('should handle D1 provider operations', async () => {
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should handle D1 create operations', async () => {
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
      expect(result.data.id).toBe(4);
    });

    it('should handle D1 update operations', async () => {
      const result = await provider.update({
        resource: 'users',
        id: '1',
        variables: {
          name: 'Updated User'
        }
      });
      
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('Updated User');
    });

    it('should handle D1 delete operations', async () => {
      const result = await provider.deleteOne({
        resource: 'users',
        id: '1'
      });
      
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(1);
    });
  });

  describe('Mock Runtime Compatibility', () => {
    let bunMock: SafeBunSQLiteMock;

    beforeEach(() => {
      bunMock = new SafeBunSQLiteMock();
    });

    it('should handle Bun-like operations', () => {
      const stmt = bunMock.prepare('SELECT * FROM users');
      const results = stmt.all();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
    });

    it('should handle Bun-like insert operations', () => {
      const stmt = bunMock.prepare('INSERT INTO users (name, email, active) VALUES (?, ?, ?)');
      const result = stmt.run('New User', 'new@example.com', 1);
      
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(4);
    });

    it('should handle Bun-like queries with parameters', () => {
      const stmt = bunMock.prepare('SELECT * FROM users WHERE id = ?');
      const result = stmt.get(1);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.name).toBe('John Doe');
    });
  });

  describe('Interface Consistency', () => {
    it('should maintain consistent provider interface across runtimes', async () => {
      const d1Mock = new SafeD1Mock();
      const d1Provider = dataProvider(d1Mock as any);
      
      // Test that all provider methods exist and return consistent structures
      const methods = ['getList', 'getOne', 'getMany', 'create', 'update', 'deleteOne', 'createMany', 'updateMany', 'deleteMany', 'custom', 'getApiUrl'] as const;
      
      methods.forEach(method => {
        expect(typeof (d1Provider as any)[method]).toBe('function');
      });
    });

    it('should handle error conditions consistently', async () => {
      const d1Mock = new SafeD1Mock();
      const provider = dataProvider(d1Mock as any);
      
      // Test error handling for non-existent resource
      const result = await provider.getOne({
        resource: 'users',
        id: '999'
      });
      
      expect(result.data).toBeNull();
    });

    it('should maintain data type consistency', async () => {
      const d1Mock = new SafeD1Mock();
      const provider = dataProvider(d1Mock as any);
      
      const listResult = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 }
      });
      
      expect(Array.isArray(listResult.data)).toBe(true);
      expect(typeof listResult.total).toBe('number');
      
      if (listResult.data.length > 0) {
        const record = listResult.data[0];
        expect(typeof record.id).toBe('number');
        expect(typeof record.name).toBe('string');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const d1Mock = new SafeD1Mock();
      const provider = dataProvider(d1Mock as any);
      
      const promises = Array.from({ length: 10 }, (_, i) => 
        provider.getOne({ resource: 'users', id: '1' })
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(1);
      });
    });

    it('should handle large parameter arrays efficiently', async () => {
      const d1Mock = new SafeD1Mock();
      const provider = dataProvider(d1Mock as any);
      
      const ids = Array.from({ length: 100 }, (_, i) => (i + 1).toString());
      const result = await provider.getMany({
        resource: 'users',
        ids
      });
      
      expect(Array.isArray(result.data)).toBe(true);
      // Should return available records (3 in our mock)
      expect(result.data.length).toBeLessThanOrEqual(3);
    });

    it('should maintain performance with complex queries', async () => {
      const d1Mock = new SafeD1Mock();
      const provider = dataProvider(d1Mock as any);
      
      const start = Date.now();
      const result = await provider.getList({
        resource: 'users',
        pagination: { current: 1, pageSize: 10 },
        filters: [
          { field: 'active', operator: 'eq', value: 1 }
        ],
        sorters: [
          { field: 'name', order: 'asc' }
        ]
      });
      const end = Date.now();
      
      expect(result.data).toBeDefined();
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });
  });
});
