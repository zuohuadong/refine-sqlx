// 当前 D1 专用代码
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

// 添加 Node.js 支持的代码
const nodeJsSupportCode = `
export class DatabaseAdapter {
  private db: any;
  private isNode = typeof process !== 'undefined' && process.versions?.node;

  constructor(dbInput: D1Database | string) {
    if (this.isNode && typeof dbInput === 'string') {
      this.initNodeDb(dbInput);
    } else if (typeof dbInput === 'string') {
      throw new Error('String paths only supported in Node.js environment');
    } else {
      this.db = dbInput;
    }
  }

  private async initNodeDb(path: string) {
    const Database = await import('better-sqlite3');
    this.db = new Database.default(path);
    this.db.pragma('journal_mode = WAL');
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    if (this.isNode) {
      return this.db.prepare(sql).all(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    if (this.isNode) {
      return this.db.prepare(sql).get(params);
    }
    const stmt = this.db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.isNode) {
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
    return this.isNode ? 'better-sqlite3' : 'd1';
  }
}`;

console.log('=== Node.js 支持体积影响实测 ===\n');

console.log('当前 D1 专用版本:');
console.log(`  代码长度: ${d1OnlyCode.length} bytes`);
console.log(`  Gzip 估算: ${Math.round(d1OnlyCode.length * 0.3)} bytes\n`);

console.log('+ Node.js 支持版本:');
console.log(`  代码长度: ${nodeJsSupportCode.length} bytes`);
console.log(`  Gzip 估算: ${Math.round(nodeJsSupportCode.length * 0.3)} bytes\n`);

const increase = nodeJsSupportCode.length - d1OnlyCode.length;
const percentage = ((increase / d1OnlyCode.length) * 100).toFixed(1);

console.log('影响分析:');
console.log(`  绝对增长: +${increase} bytes`);
console.log(`  相对增长: +${percentage}%`);
console.log(`  Gzip 增长: +${Math.round(increase * 0.3)} bytes\n`);

const currentPackageSize = 3800;
const newSize = currentPackageSize + increase;
const packageIncrease = ((increase / currentPackageSize) * 100).toFixed(1);

console.log('对当前 3.8KB 包的影响:');
console.log(`  当前包大小: ${currentPackageSize} bytes`);
console.log(`  新包大小: ${newSize} bytes`);
console.log(`  包体积增长: +${packageIncrease}%\n`);

console.log('✅ 结论: 影响适中，建议添加 Node.js 支持！');
console.log('💡 关键优势: better-sqlite3 作为外部依赖不计入 bundle 大小');
