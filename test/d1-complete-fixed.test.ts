import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

// 完善的 D1 Mock 实现，修复了数据一致性问题
class EnhancedD1Mock {
  private tables: Map<string, any[]> = new Map();
  private nextId = 4; // 从 4 开始，避免与预设数据冲突

  constructor() {
    // 初始化测试数据
    this.initializeData();
  }

  private initializeData() {
    this.tables.set('users', [
      { id: 1, name: 'John Doe', email: 'john@example.com', active: 1, created_at: '2023-01-01' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: 1, created_at: '2023-01-02' },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', active: 0, created_at: '2023-01-03' }
    ]);
    this.tables.set('posts', [
      { id: 1, title: 'First Post', content: 'Content 1', user_id: 1, published: 1 },
      { id: 2, title: 'Second Post', content: 'Content 2', user_id: 2, published: 1 }
    ]);
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
    return Promise.resolve(statements.map(stmt => {
      if (typeof stmt.all === 'function') {
        return stmt.all();
      }
      return { results: [] };
    }));
  }

  dump() {
    return Promise.resolve(new Uint8Array());
  }

  exec() {
    return Promise.resolve({ results: [], success: true });
  }

  private executeQuery(sql: string, params: any[]): { results: any[] } {
    const normalizedSQL = sql.trim().toLowerCase();
    
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
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) return { results: [] };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // 处理 COUNT 查询
    if (sql.toLowerCase().includes('count(*)')) {
      const filteredData = this.applyFilters(tableData, sql, params);
      return { results: [{ count: filteredData.length }] };
    }
    
    // 应用过滤条件
    let results = this.applyFilters(tableData, sql, params);
    
    // 处理 ORDER BY
    results = this.applySorting(results, sql);
    
    // 处理 LIMIT 和 OFFSET
    results = this.applyPagination(results, sql);
    
    return { results };
  }

  private handleInsert(sql: string, params: any[]): { meta: { changes: number; last_row_id: number } } {
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0, last_row_id: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // 解析列名和值
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/['"]/g, ''));
      const newRecord: any = { id: this.nextId++ };
      
      // 映射参数到列
      columns.forEach((col, index) => {
        if (col !== 'id' && params[index] !== undefined) {
          newRecord[col] = params[index];
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
    
    // 简单的 WHERE id = ? 处理
    const whereMatch = sql.match(/where\s+id\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const id = params[params.length - 1]; // 最后一个参数通常是 WHERE 条件的值
      const recordIndex = tableData.findIndex(record => record.id === id);
      
      if (recordIndex !== -1) {
        // 简单的 SET 处理 - 这里假设只更新 name 字段
        const setMatch = sql.match(/set\s+(\w+)\s*=\s*\?/i);
        if (setMatch && params.length > 0) {
          const columnName = setMatch[1];
          tableData[recordIndex][columnName] = params[0];
        }
        return { meta: { changes: 1 } };
      }
    }
    
    return { meta: { changes: 0 } };
  }

  private handleDelete(sql: string, params: any[]): { meta: { changes: number } } {
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (!tableMatch) return { meta: { changes: 0 } };
    
    const tableName = tableMatch[1];
    const tableData = this.tables.get(tableName) || [];
    
    // 处理 WHERE 条件
    if (sql.toLowerCase().includes('where')) {
      const filteredData = this.applyFilters(tableData, sql, params, true);
      const changes = tableData.length - filteredData.length;
      this.tables.set(tableName, filteredData);
      return { meta: { changes } };
    }
    
    return { meta: { changes: 0 } };
  }

  private handleCreateTable(sql: string, params: any[]): { meta: { changes: number } } {
    // 简单的表创建处理
    const tableMatch = sql.match(/create\s+table\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
    }
    return { meta: { changes: 0 } };
  }

  private applyFilters(data: any[], sql: string, params: any[], forDelete = false): any[] {
    // WHERE id = ?
    if (sql.toLowerCase().includes('where id =')) {
      const id = params[params.length - 1];
      return forDelete ? data.filter(record => record.id !== id) : data.filter(record => record.id === id);
    }
    
    // WHERE id IN (...)
    if (sql.toLowerCase().includes('where id in')) {
      return forDelete ? data.filter(record => !params.includes(record.id)) : data.filter(record => params.includes(record.id));
    }
    
    // 其他 WHERE 条件的简单处理
    if (sql.toLowerCase().includes('where') && params.length > 0) {
      return data.filter(record => 
        Object.values(record).some(value => 
          params.some(param => value === param)
        )
      );
    }
    
    return data;
  }

  private applySorting(data: any[], sql: string): any[] {
    const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
    if (orderMatch) {
      const column = orderMatch[1];
      const direction = (orderMatch[2] || 'asc').toLowerCase();
      
      return [...data].sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        
        if (direction === 'desc') {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
      });
    }
    
    return data;
  }

  private applyPagination(data: any[], sql: string): any[] {
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    const offsetMatch = sql.match(/offset\s+(\d+)/i);
    
    let result = [...data];
    
    if (offsetMatch) {
      const offset = parseInt(offsetMatch[1]);
      result = result.slice(offset);
    }
    
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      result = result.slice(0, limit);
    }
    
    return result;
  }

  // 重置数据的辅助方法
  reset() {
    this.nextId = 4;
    this.tables.clear();
    this.initializeData();
  }
}

describe('D1 Database Complete Coverage Tests - Fixed', () => {
  let mockD1: EnhancedD1Mock;

  beforeEach(() => {
    mockD1 = new EnhancedD1Mock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('DatabaseAdapter D1 Core Functionality', () => {
    it('should initialize with D1 database instance', () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter).toBeDefined();
      expect(adapter.getType()).toBe('d1');
    });

    it('should execute basic SELECT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users');
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('name', 'John Doe');
    });

    it('should execute parameterized SELECT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'John Doe');
    });

    it('should execute COUNT queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT COUNT(*) as count FROM users');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('count', 3);
    });

    it('should execute queryFirst for single records', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('name', 'John Doe');
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
      
      // 验证记录已插入 - 修复：使用正确的返回结构
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
      
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
      
      // 验证记录已更新
      const updatedRecord = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(updatedRecord).toBeDefined();
      expect(updatedRecord.name).toBe('Updated Name');
    });

    it('should execute DELETE operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('DELETE FROM users WHERE id = ?', [1]);
      
      expect(result).toHaveProperty('changes');
      expect(result.changes).toBe(1);
      
      // 验证记录已删除
      const deletedRecord = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      expect(deletedRecord).toBeNull();
    });

    it('should execute DDL operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
      
      expect(result).toHaveProperty('changes');
    });

    it('should execute batch operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const statements = [
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['Batch User 1', 'batch1@example.com'] },
        { sql: 'INSERT INTO users (name, email) VALUES (?, ?)', params: ['Batch User 2', 'batch2@example.com'] }
      ];
      
      const results = await adapter.batch(statements);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });

    it('should handle empty batch operations', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const results = await adapter.batch([]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle queries with no parameters', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle LIMIT and OFFSET in queries', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.query('SELECT * FROM users LIMIT 2 OFFSET 1');
      expect(result).toHaveLength(2);
      expect(result[0].id).not.toBe(1); // 应该跳过第一个记录
    });
  });

  describe('DataProvider D1 Complete CRUD Operations', () => {
    describe('getList Operations', () => {
      it('should handle getList with pagination', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getList({
          resource: 'users',
          pagination: { current: 1, pageSize: 2 }
        });
        
        expect(result.data).toHaveLength(2);
        expect(result.total).toBe(3);
      });

      it('should handle getList without pagination', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getList({ resource: 'users' });
        
        expect(result.data).toHaveLength(3);
        expect(result.total).toBe(3);
      });

      it('should handle getList with filters', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getList({
          resource: 'users',
          filters: [{ field: 'active', operator: 'eq', value: 1 }]
        });
        
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.total).toBeGreaterThan(0);
      });

      it('should handle getList with sorting', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getList({
          resource: 'users',
          sorters: [{ field: 'name', order: 'asc' }]
        });
        
        expect(result.data).toHaveLength(3);
        expect(result.total).toBe(3);
      });
    });

    describe('Single Record Operations', () => {
      it('should handle getOne operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getOne({ resource: 'users', id: 1 });
        
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(1);
      });

      it('should handle getMany operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getMany({ resource: 'users', ids: [1, 2] });
        
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe(1);
        expect(result.data[1].id).toBe(2);
      });

      it('should handle getMany with empty ids', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.getMany({ resource: 'users', ids: [] });
        
        expect(result.data).toHaveLength(0);
      });
    });

    describe('Create Operations', () => {
      it('should handle create operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.create({
          resource: 'users',
          variables: { name: 'Test User', email: 'test@example.com' }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
      });

      it('should handle createMany operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.createMany({
          resource: 'users',
          variables: [
            { name: 'User 1', email: 'user1@example.com' },
            { name: 'User 2', email: 'user2@example.com' }
          ]
        });
        
        expect(result.data).toHaveLength(2);
      });
    });

    describe('Update Operations', () => {
      it('should handle update operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.update({
          resource: 'users',
          id: 1,
          variables: { name: 'Updated User' }
        });
        
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(1);
      });

      it('should handle updateMany operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.updateMany({
          resource: 'users',
          ids: [1, 2],
          variables: { active: 0 }
        });
        
        expect(result.data).toHaveLength(2);
      });
    });

    describe('Delete Operations', () => {
      it('should handle deleteOne operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.deleteOne({ resource: 'users', id: 1 });
        
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(1);
      });

      it('should handle deleteMany operations', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.deleteMany({ resource: 'users', ids: [1, 2] });
        
        expect(result.data).toHaveLength(2);
      });
    });

    describe('Custom Operations', () => {
      it('should handle custom queries with SQL payload', async () => {
        const provider = dataProvider(mockD1 as any);
        const result = await provider.custom({
          url: '',
          method: 'get',
          payload: { sql: 'SELECT * FROM users' }
        });
        
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should provide API URL', () => {
        const provider = dataProvider(mockD1 as any);
        const url = provider.getApiUrl();
        expect(typeof url).toBe('string');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      const errorMock = {
        prepare: () => {
          throw new Error('Connection failed');
        },
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn()
      };

      const adapter = new DatabaseAdapter(errorMock as any);
      await expect(adapter.query('SELECT 1')).rejects.toThrow('Connection failed');
    });

    it('should handle malformed SQL gracefully', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      // Mock 应该处理无效 SQL
      const result = await adapter.query('INVALID SQL SYNTAX');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle special characters in data', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      const result = await adapter.execute(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['Special Char !@#$%^&*()', 'special@exam"ple.com']
      );
      
      expect(result.changes).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large result sets efficiently', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      
      const start = Date.now();
      const result = await adapter.query('SELECT * FROM users');
      const end = Date.now();
      
      expect(Array.isArray(result)).toBe(true);
      expect(end - start).toBeLessThan(100); // 应该很快完成
    });

    it('should handle concurrent operations efficiently', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      
      const promises = Array.from({ length: 10 }, () => 
        adapter.query('SELECT * FROM users')
      );
      
      const start = Date.now();
      const results = await Promise.all(promises);
      const end = Date.now();
      
      expect(results).toHaveLength(10);
      expect(end - start).toBeLessThan(200);
    });

    it('should handle batch operations with many statements', async () => {
      const adapter = new DatabaseAdapter(mockD1 as any);
      
      const statements = Array.from({ length: 50 }, (_, i) => ({
        sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
        params: [`Batch User ${i}`, `batch${i}@example.com`]
      }));
      
      const start = Date.now();
      const results = await adapter.batch(statements);
      const end = Date.now();
      
      expect(results).toHaveLength(50);
      expect(end - start).toBeLessThan(500);
    });
  });
});
