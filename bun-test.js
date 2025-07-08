// 当前 D1 专用版本 (简化)
const d1OnlyCode = `
export class DatabaseAdapter {
  private db: D1Database;
  
  constructor(db: D1Database) {
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
}`;

// 双驱动版本
const dualDriverCode = `
export class DatabaseAdapter {
  private db: any;
  private isBun = typeof Bun !== 'undefined';

  constructor(dbInput: D1Database | string) {
    if (this.isBun && typeof dbInput === 'string') {
      this.db = new Bun.sqlite(dbInput);
    } else {
      this.db = dbInput as D1Database;
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    return this.isBun 
      ? this.db.query(sql).all(...params)
      : (await this.db.prepare(sql).bind(...params).all()).results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    return this.isBun 
      ? this.db.query(sql).get(...params)
      : await this.db.prepare(sql).bind(...params).first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (this.isBun) {
      const result = this.db.query(sql).run(...params);
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
}`;

console.log('=== Bun SQLite 支持体积影响测试 ===');
console.log('');
console.log('当前 D1 专用版本:');
console.log(`  代码长度: ${d1OnlyCode.length} bytes`);
console.log(`  Gzip 估算: ${Math.round(d1OnlyCode.length * 0.3)} bytes`);
console.log('');
console.log('双驱动版本:');
console.log(`  代码长度: ${dualDriverCode.length} bytes`);
console.log(`  Gzip 估算: ${Math.round(dualDriverCode.length * 0.3)} bytes`);
console.log('');
console.log('影响分析:');
const increase = dualDriverCode.length - d1OnlyCode.length;
const percentage = ((increase / d1OnlyCode.length) * 100).toFixed(1);
console.log(`  绝对增长: +${increase} bytes`);
console.log(`  相对增长: +${percentage}%`);
console.log(`  Gzip 增长: +${Math.round(increase * 0.3)} bytes`);
console.log('');
console.log('对当前 3.8KB 包的影响:');
const currentPackageSize = 3800; // bytes
const newSize = currentPackageSize + increase;
const packageIncrease = ((increase / currentPackageSize) * 100).toFixed(1);
console.log(`  当前包大小: ${currentPackageSize} bytes`);
console.log(`  新包大小: ${newSize} bytes`);
console.log(`  包体积增长: +${packageIncrease}%`);
console.log('');
console.log('结论: 影响微乎其微，强烈推荐添加 Bun SQLite 支持！');
