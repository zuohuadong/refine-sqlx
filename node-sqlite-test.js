// Node.js 内置 sqlite 体积影响测试

// 当前 D1 专用版本
const d1OnlyCode = `
export class DatabaseAdapter {
  private db: D1Database;

  constructor(db: D1Database) {
    if (!db) throw new Error('D1 database instance is required');
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

// 使用 Node.js 内置 sqlite 的版本
const nodeSqliteCode = `
export class DatabaseAdapter {
  private db: any;
  private isNode = typeof process !== 'undefined' && process.versions?.node;

  constructor(dbInput: D1Database | string) {
    if (this.isNode && typeof dbInput === 'string') {
      const nodeVersion = parseFloat(process.versions.node);
      if (nodeVersion < 22.5) {
        throw new Error('Node.js 22.5+ required for SQLite support');
      }
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(dbInput);
    } else if (typeof dbInput === 'string') {
      throw new Error('String paths only supported in Node.js 22.5+');
    } else {
      this.db = dbInput;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.isNode) {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.isNode) {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.isNode) {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
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
    return this.isNode ? 'node-sqlite' : 'd1';
  }
}`;

// 混合支持版本 (内置 + better-sqlite3 降级)
const hybridCode = `
export class DatabaseAdapter {
  private db: any;
  private dbType: 'd1' | 'node-sqlite' | 'better-sqlite3';
  private isNode = typeof process !== 'undefined' && process.versions?.node;

  constructor(dbInput: D1Database | string) {
    if (this.isNode && typeof dbInput === 'string') {
      this.initNodeDb(dbInput);
    } else if (typeof dbInput === 'string') {
      throw new Error('String paths only supported in Node.js environment');
    } else {
      this.db = dbInput;
      this.dbType = 'd1';
    }
  }

  private async initNodeDb(path: string) {
    const nodeVersion = parseFloat(process.versions.node);
    
    if (nodeVersion >= 22.5) {
      try {
        const { DatabaseSync } = require('node:sqlite');
        this.db = new DatabaseSync(path);
        this.dbType = 'node-sqlite';
        return;
      } catch (e) {
        // 降级到 better-sqlite3
      }
    }
    
    const Database = await import('better-sqlite3');
    this.db = new Database.default(path);
    this.db.pragma('journal_mode = WAL');
    this.dbType = 'better-sqlite3';
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.dbType === 'node-sqlite' || this.dbType === 'better-sqlite3') {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.dbType === 'node-sqlite' || this.dbType === 'better-sqlite3') {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.dbType === 'node-sqlite' || this.dbType === 'better-sqlite3') {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
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

console.log('=== Node.js 内置 SQLite 体积影响测试 ===\n');

const tests = [
  { name: 'D1 专用版本', code: d1OnlyCode },
  { name: '+ Node.js 内置 sqlite', code: nodeSqliteCode },
  { name: '+ 混合支持 (内置+降级)', code: hybridCode }
];

tests.forEach((test, index) => {
  const size = test.code.length;
  const gzipSize = Math.round(size * 0.3);
  
  console.log(`${test.name}:`);
  console.log(`  代码大小: ${size} bytes`);
  console.log(`  Gzip 估算: ${gzipSize} bytes`);
  
  if (index > 0) {
    const baseSize = tests[0].code.length;
    const increase = size - baseSize;
    const percentage = ((increase / baseSize) * 100).toFixed(1);
    console.log(`  增长: +${increase} bytes (+${percentage}%)`);
    
    const currentPackageSize = 3800;
    const packageIncrease = ((increase / currentPackageSize) * 100).toFixed(1);
    console.log(`  对总包影响: +${packageIncrease}%`);
  }
  console.log('');
});

console.log('🎯 结论对比:');
console.log('1. 内置 sqlite: 最小体积增长，零外部依赖');
console.log('2. 混合支持: 最大兼容性，但体积稍大');
console.log('3. 推荐: 优先采用 Node.js 内置 sqlite 方案');

const nodeSqliteIncrease = nodeSqliteCode.length - d1OnlyCode.length;
const betterSqliteIncrease = 817; // 从之前的测试

console.log('\n📊 与 better-sqlite3 方案对比:');
console.log(`Node.js 内置 sqlite: +${nodeSqliteIncrease} bytes`);
console.log(`better-sqlite3: +${betterSqliteIncrease} bytes`);
console.log(`体积节省: ${betterSqliteIncrease - nodeSqliteIncrease} bytes (${(((betterSqliteIncrease - nodeSqliteIncrease) / betterSqliteIncrease) * 100).toFixed(1)}%)`);
