import { D1Database, DatabaseConfig, RuntimeEnvironment } from './types';

// Runtime detection utilities
export function detectRuntime(): RuntimeEnvironment {
  const isCloudflareWorker = typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().startsWith('cloudflare');

  // Use try-catch to safely check for Node.js environment
  let isNode = false;
  try {
    isNode = !!(globalThis as any).process?.versions?.node;
  } catch {
    // isNode is already false, no need to reassign
  }

  return {
    isCloudflareWorker,
    isNode,
    supportsSQLite: isNode
  };
}

export class DatabaseAdapter {
  private config: DatabaseConfig;
  private runtime: RuntimeEnvironment;
  private db: any; // Cache the database instance

  constructor(dbOrPath: string | D1Database) {
    this.runtime = detectRuntime();
    
    this.config = {
      type: typeof dbOrPath === 'string' ? 'sqlite' : 'd1',
      connection: dbOrPath
    };
  }

  private async getDatabase() {
    if (this.db) {
      return this.db;
    }

    if (this.config.type === 'sqlite') {
      if (!this.runtime.supportsSQLite) {
        throw new Error('SQLite is not supported in this environment. Use Cloudflare D1 instead.');
      }
      
      try {
        const Database = await import('better-sqlite3');
        this.db = new Database.default(this.config.connection as string);
        this.db.pragma('journal_mode = WAL');
        return this.db;
      } catch (error) {
        throw new Error('better-sqlite3 not available. Make sure it is installed: npm install better-sqlite3');
      }
    }
    
    this.db = this.config.connection as D1Database;
    return this.db;
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const db = await this.getDatabase();
    const stmt = db.prepare(sql);
    
    if (this.config.type === 'sqlite') {
      return stmt.all(params);
    }
    
    // D1 database
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    const db = await this.getDatabase();
    const stmt = db.prepare(sql);
    
    if (this.config.type === 'sqlite') {
      return stmt.get(params);
    }
    
    // D1 database
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const db = await this.getDatabase();
    const stmt = db.prepare(sql);
    
    if (this.config.type === 'sqlite') {
      const result = stmt.run(params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
      };
    }
    
    // D1 database
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id
    };
  }

  close(): void {
    if (this.config.type === 'sqlite' && this.db) {
      if ("close" in this.db) this.db.close();
      this.db = null; // Clear the cached instance
    }
    // D1 doesn't need to be closed, but clear the reference
    if (this.config.type === 'd1') {
      this.db = null;
    }
  }

  getType(): string {
    return this.config.type;
  }
}
