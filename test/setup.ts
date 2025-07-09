// test/setup.ts
// 测试环境设置文件，确保CI环境中Node.js SQLite功能正常工作

import { beforeAll, vi } from 'vitest';

// 增强的SQLite模拟类，支持更复杂的SQL操作
class MockSQLiteStatement {
  constructor(private sql: string, private db: MockSQLiteDatabase) {}

  all(...params: any[]): any[] {
    const upperSQL = this.sql.toUpperCase();
    
    // 检查SQL语法错误
    if (upperSQL.includes('INVALID SQL') || upperSQL.includes('INVALID')) {
      throw new Error('SQL syntax error: Invalid SQL statement');
    }
    
    // 处理 INSERT/UPDATE/DELETE ... RETURNING 语句
    if ((upperSQL.includes('INSERT') || upperSQL.includes('UPDATE') || upperSQL.includes('DELETE')) && upperSQL.includes('RETURNING')) {
      const tableName = this.extractTableName();
      
      if (upperSQL.includes('INSERT')) {
        const newItem = this.parseInsertValues(params);
        newItem.id = newItem.id || Date.now() + Math.floor(Math.random() * 1000);
        this.db.insertIntoTable(tableName, newItem);
        return [newItem]; // 返回插入的数据
      }
      
      if (upperSQL.includes('UPDATE')) {
        const updates = this.parseUpdateValues(params);
        this.db.updateTable(tableName, updates, params);
        // 返回更新后的数据
        return this.db.getTableData(tableName).filter(item => 
          params.length > 0 && item.id == params[params.length - 1]
        );
      }
      
      if (upperSQL.includes('DELETE')) {
        const data = this.db.getTableData(tableName);
        if (params.length > 0) {
          const idToDelete = params[params.length - 1];
          const toDelete = data.filter(item => item.id == idToDelete);
          this.db.deleteFromTable(tableName, params);
          return toDelete; // 返回删除的数据
        }
      }
    }
    
    // 处理COUNT查询
    if (upperSQL.includes('SELECT COUNT(*)')) {
      let count = this.db.getTableData(this.extractTableName()).length;
      
      // 处理WHERE条件
      if (upperSQL.includes('WHERE') && params.length > 0) {
        const data = this.db.getTableData(this.extractTableName());
        count = this.applyWhereFilter(data, params).length;
      }
      
      // 处理AS别名 (如 COUNT(*) as total, COUNT(*) as count)
      const aliasMatch = upperSQL.match(/COUNT\(\*\)\s+(?:AS\s+)?(\w+)/);
      const aliasName = aliasMatch ? aliasMatch[1].toLowerCase() : 'count';
      
      return [{ [aliasName]: count }];
    }
    
    // 处理SELECT查询
    if (upperSQL.includes('SELECT')) {
      const tableName = this.extractTableName();
      let data = this.db.getTableData(tableName);
      
      // 应用WHERE过滤
      if (upperSQL.includes('WHERE') && params.length > 0) {
        data = this.applyWhereFilter(data, params);
      }
      
      // 处理SELECT字段
      if (!upperSQL.includes('SELECT *')) {
        const selectFields = this.extractSelectFields();
        if (selectFields.length > 0) {
          data = data.map((row: any) => {
            const result: any = {};
            selectFields.forEach(field => {
              // 处理别名映射
              const fieldParts = field.split('.');
              const fieldName = fieldParts[fieldParts.length - 1];
              if (row[fieldName] !== undefined) {
                result[fieldName] = row[fieldName];
              }
            });
            return result;
          });
        }
      }
      
      return data.slice(); // 返回副本
    }
    
    return [];
  }

  get(...params: any[]): any | null {
    const results = this.all(...params);
    return results.length > 0 ? results[0] : null;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const upperSQL = this.sql.toUpperCase();
    const tableName = this.extractTableName();
    let changes = 0;
    let lastInsertRowid = 0;
    
    if (upperSQL.includes('INSERT')) {
      const newItem = this.parseInsertValues(params);
      newItem.id = newItem.id || Date.now() + Math.floor(Math.random() * 1000);
      this.db.insertIntoTable(tableName, newItem);
      changes = 1;
      lastInsertRowid = newItem.id;
    } else if (upperSQL.includes('UPDATE')) {
      const updates = this.parseUpdateValues(params);
      changes = this.db.updateTable(tableName, updates, params);
    } else if (upperSQL.includes('DELETE')) {
      changes = this.db.deleteFromTable(tableName, params);
    }
    
    return { changes, lastInsertRowid };
  }

  private extractTableName(): string {
    const upperSQL = this.sql.toUpperCase();
    
    // 匹配FROM子句
    let match = upperSQL.match(/FROM\s+(\w+)/);
    if (match) return match[1].toLowerCase();
    
    // 匹配INSERT INTO
    match = upperSQL.match(/INSERT\s+INTO\s+(\w+)/);
    if (match) return match[1].toLowerCase();
    
    // 匹配UPDATE
    match = upperSQL.match(/UPDATE\s+(\w+)/);
    if (match) return match[1].toLowerCase();
    
    // 匹配DELETE FROM
    match = upperSQL.match(/DELETE\s+FROM\s+(\w+)/);
    if (match) return match[1].toLowerCase();
    
    return 'posts'; // 默认表名
  }

  private extractSelectFields(): string[] {
    const upperSQL = this.sql.toUpperCase();
    const match = upperSQL.match(/SELECT\s+(.*?)\s+FROM/);
    if (!match || match[1].includes('*')) return [];
    
    return match[1].split(',').map(field => field.trim().toLowerCase());
  }

  private applyWhereFilter(data: any[], params: any[]): any[] {
    if (params.length === 0) return data;
    
    const upperSQL = this.sql.toUpperCase();
    
    // 简单的WHERE条件处理
    if (upperSQL.includes('WHERE')) {
      // 处理status = ?的情况
      if (upperSQL.includes('STATUS') && params.length > 0) {
        return data.filter(item => item.status === params[0]);
      }
      
      // 处理id = ?的情况
      if (upperSQL.includes('ID') && params.length > 0) {
        return data.filter(item => item.id == params[params.length - 1]);
      }
      
      // 通用参数匹配
      return data.filter(item => 
        Object.values(item).some(val => params.includes(val))
      );
    }
    
    return data;
  }

  private parseInsertValues(params: any[]): any {
    const upperSQL = this.sql.toUpperCase();
    
    // 解析INSERT INTO table (columns) VALUES (?)格式
    const columnsMatch = upperSQL.match(/\(([^)]+)\)\s*VALUES/);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(col => col.trim().toLowerCase());
      const result: any = {};
      
      columns.forEach((col, i) => {
        if (i < params.length) {
          result[col] = params[i];
        }
      });
      
      return result;
    }
    
    // 简单格式，使用默认字段名
    return {
      title: params[0] || 'Test Title',
      status: params[1] || 'published',
      content: params[2] || 'Test Content'
    };
  }

  private parseUpdateValues(params: any[]): any {
    const upperSQL = this.sql.toUpperCase();
    
    // 解析UPDATE table SET field1 = ?, field2 = ? WHERE ...格式
    const setMatch = upperSQL.match(/SET\s+(.+?)\s+WHERE/);
    if (setMatch && params.length > 0) {
      const setPart = setMatch[1];
      const setFields = setPart.split(',').map(part => {
        const fieldMatch = part.trim().match(/(\w+)\s*=\s*\?/);
        return fieldMatch ? fieldMatch[1].toLowerCase() : null;
      }).filter(field => field !== null);
      
      const result: any = {};
      setFields.forEach((field, i) => {
        if (i < params.length - 1) { // 最后一个参数通常是WHERE条件的ID
          result[field!] = params[i];
        }
      });
      
      return result;
    }
    
    // 回退到简单解析
    return {
      status: params[0] || 'updated',
      title: params[1] || 'Updated Title'
    };
  }
}

class MockSQLiteDatabase {
  private tables: Map<string, any[]> = new Map();
  private transactionActive: boolean = false;
  private transactionBackup?: Map<string, any[]>;

  constructor() {
    // 初始化默认表
    this.tables.set('posts', []);
    this.tables.set('users', []);
    this.tables.set('categories', []);
  }

  getTableData(tableName: string): any[] {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }
    return this.tables.get(tableName) || [];
  }

  insertIntoTable(tableName: string, data: any): void {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }
    this.tables.get(tableName)?.push(data);
  }

  updateTable(tableName: string, updates: any, params: any[]): number {
    const data = this.getTableData(tableName);
    let changes = 0;
    
    // 简单的更新逻辑
    if (params.length > 0) {
      const idToUpdate = params[params.length - 1];
      const index = data.findIndex(item => item.id == idToUpdate);
      if (index !== -1) {
        Object.assign(data[index], updates);
        changes = 1;
      }
    } else if (data.length > 0) {
      // 如果没有WHERE条件，更新第一条记录
      Object.assign(data[0], updates);
      changes = 1;
    }
    
    return changes;
  }

  deleteFromTable(tableName: string, params: any[]): number {
    const data = this.getTableData(tableName);
    let changes = 0;
    
    if (params.length > 0) {
      const idToDelete = params[params.length - 1];
      const index = data.findIndex(item => item.id == idToDelete);
      if (index !== -1) {
        data.splice(index, 1);
        changes = 1;
      }
    }
    
    return changes;
  }

  // 事务支持
  beginTransaction(): void {
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }
    this.transactionActive = true;
    // 备份当前数据状态
    this.transactionBackup = new Map();
    this.tables.forEach((data, tableName) => {
      this.transactionBackup!.set(tableName, [...data]);
    });
  }

  commitTransaction(): void {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    this.transactionActive = false;
    this.transactionBackup = undefined;
  }

  rollbackTransaction(): void {
    if (!this.transactionActive) {
      throw new Error('No active transaction');
    }
    // 恢复备份的数据
    if (this.transactionBackup) {
      this.tables = this.transactionBackup;
      this.transactionBackup = undefined;
    }
    this.transactionActive = false;
  }

  prepare(sql: string): MockSQLiteStatement {
    return new MockSQLiteStatement(sql, this);
  }

  close(): void {
    // Mock close
  }

  exec(sql: string): void {
    const upperSQL = sql.toUpperCase().trim();
    
    // 处理事务命令
    if (upperSQL === 'BEGIN TRANSACTION' || upperSQL === 'BEGIN') {
      this.beginTransaction();
      return;
    }
    if (upperSQL === 'COMMIT') {
      this.commitTransaction();
      return;
    }
    if (upperSQL === 'ROLLBACK') {
      this.rollbackTransaction();
      return;
    }
    
    // Mock exec for DDL operations like CREATE TABLE
    if (upperSQL.includes('CREATE TABLE')) {
      // 解析表名并创建表
      const match = sql.match(/CREATE TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    }
  }

  // 向后兼容的属性
  get data(): any[] {
    return this.getTableData('posts');
  }
}

beforeAll(async () => {
  // 检测是否在CI环境中
  const isCI = (typeof process !== 'undefined' && process.env && 
               (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'));
  
  if (isCI) {
    console.log('设置CI测试环境...');
    
    // 检查Node.js版本
    const nodeVersion = typeof process !== 'undefined' && process.version ? process.version : 'v0.0.0';
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    console.log(`Node.js版本: ${nodeVersion}`);
    
    // 确保Node.js 22+才尝试使用原生SQLite
    if (majorVersion >= 22) {
      try {
        // 尝试导入node:sqlite来验证实验性功能是否可用
        await import('node:sqlite');
        console.log('Node.js SQLite实验性功能可用');
        
        // 设置环境变量确保测试使用正确的runtime
        process.env.FORCE_NODE_SQLITE = 'true';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Node.js SQLite实验性功能不可用，将使用增强模拟:', errorMessage);
        
        // 如果Node.js SQLite不可用，使用增强模拟
        process.env.FORCE_MOCK_SQLITE = 'true';
        
        // 全局模拟node:sqlite模块
        vi.mock('node:sqlite', () => ({
          DatabaseSync: vi.fn().mockImplementation(() => new MockSQLiteDatabase())
        }));
      }
    } else {
      console.log(`Node.js版本${majorVersion} < 22，使用增强模拟SQLite`);
      process.env.FORCE_MOCK_SQLITE = 'true';
      
      // 全局模拟node:sqlite模块
      vi.mock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => new MockSQLiteDatabase())
      }));
    }
  } else {
    // 本地开发环境，检查是否需要模拟
    try {
      await import('node:sqlite');
      console.log('本地环境：Node.js SQLite可用');
    } catch (error) {
      console.log('本地环境：使用增强SQLite模拟');
      vi.mock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => new MockSQLiteDatabase())
      }));
    }
  }
  
  // 设置测试数据库路径
  if (typeof process !== 'undefined' && process.env && !process.env.TEST_DB_DIR) {
    process.env.TEST_DB_DIR = process.cwd();
  }
});

// 导出测试助手函数
export function shouldUseMockSQLite(): boolean {
  return (typeof process !== 'undefined' && process.env && process.env.FORCE_MOCK_SQLITE === 'true') || false;
}

export function isNodeVersionSupported(): boolean {
  if (typeof process === 'undefined' || !process.version) return false;
  const majorVersion = parseInt(process.version.substring(1).split('.')[0]);
  return majorVersion >= 22;
}
