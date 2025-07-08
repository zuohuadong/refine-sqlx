// 分析使用 Node.js 22.5+ 内置 sqlite 模块对包体积的影响

// 当前 D1 专用版本
const d1OnlyCode = `
import { D1Database } from './types';

export class DatabaseAdapter {
  private db: D1Database;

  constructor(db: D1Database) {
    if (!db) {
      throw new Error('D1 database instance is required');
    }
    this.db = db;
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id
    };
  }

  getType(): string {
    return 'd1';
  }
}`;

// 使用 Node.js 内置 sqlite 模块的版本
const nodeSqliteCode = `
import { D1Database } from './types';

type DatabaseInput = D1Database | string;

export class DatabaseAdapter {
  private db: any;
  private dbType: 'd1' | 'node-sqlite';

  constructor(dbInput: DatabaseInput) {
    if (!dbInput) {
      throw new Error('Database instance or path is required');
    }
    
    if (typeof dbInput === 'string') {
      // Node.js 22.5+ with built-in sqlite
      this.dbType = 'node-sqlite';
      if (typeof process === 'undefined' || !process.versions?.node) {
        throw new Error('Node.js sqlite is only available in Node.js 22.5+ environment');
      }
      
      const nodeVersion = process.versions.node.split('.').map(Number);
      if (nodeVersion[0] < 22 || (nodeVersion[0] === 22 && nodeVersion[1] < 5)) {
        throw new Error('Node.js sqlite requires Node.js 22.5 or higher');
      }
      
      this.initNodeSqlite(dbInput);
    } else {
      // Cloudflare D1
      this.dbType = 'd1';
      this.db = dbInput;
    }
  }

  private async initNodeSqlite(path: string) {
    const { DatabaseSync } = await import('node:sqlite');
    this.db = new DatabaseSync(path);
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.dbType === 'node-sqlite') {
      const stmt = this.db.prepare(sql);
      return stmt.all(params);
    } else {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all();
      return result.results || [];
    }
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.dbType === 'node-sqlite') {
      const stmt = this.db.prepare(sql);
      return stmt.get(params);
    } else {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      return await boundStmt.first();
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.dbType === 'node-sqlite') {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
      };
    } else {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await boundStmt.run();
      return {
        changes: result.meta.changes,
        lastInsertRowid: result.meta.last_row_id
      };
    }
  }

  getType(): string {
    return this.dbType;
  }
}`;

// 优化版本 - 更简洁的实现
const optimizedNodeSqliteCode = `
import { D1Database } from './types';

type DatabaseInput = D1Database | string;

export class DatabaseAdapter {
  private db: any;
  private isNodeSqlite: boolean;

  constructor(dbInput: DatabaseInput) {
    this.isNodeSqlite = typeof dbInput === 'string' && this.checkNodeSqliteSupport();
    
    if (this.isNodeSqlite) {
      this.initNodeSqlite(dbInput as string);
    } else if (typeof dbInput === 'string') {
      throw new Error('String paths require Node.js 22.5+ with sqlite support');
    } else {
      this.db = dbInput;
    }
  }

  private checkNodeSqliteSupport(): boolean {
    if (typeof process === 'undefined' || !process.versions?.node) return false;
    const [major, minor] = process.versions.node.split('.').map(Number);
    return major > 22 || (major === 22 && minor >= 5);
  }

  private async initNodeSqlite(path: string) {
    const { DatabaseSync } = await import('node:sqlite');
    this.db = new DatabaseSync(path);
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.isNodeSqlite) {
      return this.db.prepare(sql).all(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.isNodeSqlite) {
      return this.db.prepare(sql).get(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.isNodeSqlite) {
      const result = this.db.prepare(sql).run(params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
      };
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id
    };
  }

  getType(): string {
    return this.isNodeSqlite ? 'node-sqlite' : 'd1';
  }
}`;

// 支持三种运行时的版本 (D1 + better-sqlite3 + Node.js sqlite)
const tripleRuntimeCode = `
import { D1Database } from './types';

type DatabaseInput = D1Database | string | { type: 'better-sqlite3' | 'node-sqlite'; path: string };

export class DatabaseAdapter {
  private db: any;
  private dbType: 'd1' | 'better-sqlite3' | 'node-sqlite';

  constructor(dbInput: DatabaseInput) {
    if (typeof dbInput === 'object' && 'type' in dbInput) {
      // 显式指定类型
      this.dbType = dbInput.type;
      this.initSpecificDb(dbInput.type, dbInput.path);
    } else if (typeof dbInput === 'string') {
      // 自动检测运行时
      this.dbType = this.detectRuntime();
      this.initAutoDetectedDb(dbInput);
    } else {
      // D1 数据库
      this.dbType = 'd1';
      this.db = dbInput;
    }
  }

  private detectRuntime(): 'better-sqlite3' | 'node-sqlite' {
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error('SQLite support requires Node.js environment');
    }
    
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major > 22 || (major === 22 && minor >= 5)) {
      return 'node-sqlite'; // 优先使用内置 sqlite
    }
    return 'better-sqlite3';
  }

  private async initSpecificDb(type: 'better-sqlite3' | 'node-sqlite', path: string) {
    if (type === 'node-sqlite') {
      const { DatabaseSync } = await import('node:sqlite');
      this.db = new DatabaseSync(path);
    } else {
      const Database = await import('better-sqlite3');
      this.db = new Database.default(path);
      this.db.pragma('journal_mode = WAL');
    }
  }

  private async initAutoDetectedDb(path: string) {
    await this.initSpecificDb(this.dbType as any, path);
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.dbType === 'better-sqlite3' || this.dbType === 'node-sqlite') {
      return this.db.prepare(sql).all(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.dbType === 'better-sqlite3' || this.dbType === 'node-sqlite') {
      return this.db.prepare(sql).get(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.dbType === 'better-sqlite3' || this.dbType === 'node-sqlite') {
      const result = this.db.prepare(sql).run(params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
      };
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id
    };
  }

  getType(): string {
    return this.dbType;
  }
}`;

console.log('=== Node.js 22.5+ 内置 sqlite 模块对包体积的影响分析 ===\n');

const analysis = {
  current: { code: d1OnlyCode, name: '当前 D1 专用版本' },
  nodeSqlite: { code: nodeSqliteCode, name: 'D1 + Node.js 内置 sqlite' },
  optimized: { code: optimizedNodeSqliteCode, name: '优化的 Node.js sqlite 支持' },
  tripleRuntime: { code: tripleRuntimeCode, name: '三运行时支持 (D1 + better-sqlite3 + Node.js sqlite)' }
};

Object.entries(analysis).forEach(([key, { code, name }]) => {
  const size = code.length;
  const gzipSize = Math.round(size * 0.3);
  
  console.log(`${name}:`);
  console.log(`  代码大小: ${size} bytes (${(size/1024).toFixed(2)} KB)`);
  console.log(`  Gzip 估算: ${gzipSize} bytes`);
  
  if (key !== 'current') {
    const increase = size - analysis.current.code.length;
    const percentage = ((increase / analysis.current.code.length) * 100).toFixed(1);
    console.log(`  增长: +${increase} bytes (+${percentage}%)`);
  }
  console.log('');
});

// 对整体包的影响
const currentPackageSize = 3800; // 当前 3.8KB
console.log('📦 对整体包大小的影响:');
Object.entries(analysis).forEach(([key, { code, name }]) => {
  if (key === 'current') return;
  
  const increase = code.length - analysis.current.code.length;
  const newSize = currentPackageSize + increase;
  const packageIncrease = ((increase / currentPackageSize) * 100).toFixed(1);
  
  console.log(`${name}:`);
  console.log(`  新包大小: ${(newSize/1024).toFixed(1)} KB`);
  console.log(`  增长: +${packageIncrease}%`);
  console.log('');
});

console.log('💡 Node.js 22.5+ 内置 sqlite 的优势:');
console.log('1. ✅ 无需外部依赖 - 不需要安装 better-sqlite3');
console.log('2. ✅ 更好的兼容性 - 官方维护，API 稳定');
console.log('3. ✅ 更小的部署体积 - 没有二进制文件');
console.log('4. ✅ 更快的启动时间 - 内置模块加载更快');
console.log('5. ⚠️  需要 Node.js 22.5+ - 版本要求较高');
console.log('');

console.log('🔍 与 better-sqlite3 对比:');
console.log('Node.js sqlite:');
console.log('  ✅ 无外部依赖');
console.log('  ✅ 官方支持');
console.log('  ⚠️  版本要求高');
console.log('  ⚠️  功能相对简单');
console.log('');
console.log('better-sqlite3:');
console.log('  ✅ 功能丰富');
console.log('  ✅ 性能优异');
console.log('  ✅ 兼容性好');
console.log('  ❌ 需要编译');
console.log('  ❌ 外部依赖');
console.log('');

console.log('📋 推荐策略:');
console.log('1. 🎯 现阶段: 主推 better-sqlite3 (兼容性更好)');
console.log('2. 🔮 未来: 逐步迁移到 Node.js 内置 sqlite');
console.log('3. 🏗️  渐进式: 支持两种方式，让用户选择');
console.log('4. 📖 文档: 明确说明各种运行时的要求和优势');
