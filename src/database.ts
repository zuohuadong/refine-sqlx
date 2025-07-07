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

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<any[]> {
    const preparedStatements = statements.map(({ sql, params = [] }) => {
      const stmt = this.db.prepare(sql);
      return params.length > 0 ? stmt.bind(...params) : stmt;
    });
    
    const results = await this.db.batch(preparedStatements);
    return results.map(result => result.results || []);
  }

  getType(): string {
    return 'd1';
  }
}
