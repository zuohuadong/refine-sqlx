import { D1Database, DatabaseConfig, RuntimeEnvironment } from './types';

// Import better-sqlite3 for Node.js environments
let Database: any = null;
try {
  // Try to import better-sqlite3
  Database = require('better-sqlite3');
} catch (error) {
  // better-sqlite3 not available in this environment
}

// Runtime detection utilities
export function detectRuntime(): RuntimeEnvironment {
  const isCloudflareWorker = typeof globalThis !== 'undefined' && 
    'caches' in globalThis && 
    'Request' in globalThis &&
    'Response' in globalThis &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers';

  // Use try-catch to safely check for Node.js environment
  let isNode = false;
  try {
    isNode = typeof (globalThis as any).process !== 'undefined' && 
      (globalThis as any).process.versions && 
      (globalThis as any).process.versions.node;
  } catch {
    isNode = false;
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

  constructor(dbOrPath: string | D1Database) {
    this.runtime = detectRuntime();
    
    if (typeof dbOrPath === 'string') {
      this.config = {
        type: 'sqlite',
        connection: dbOrPath
      };
      return;
    }
    
    this.config = {
      type: 'd1',
      connection: dbOrPath
    };
  }

  private getDatabase() {
    if (this.config.type === 'sqlite') {
      if (!this.runtime.supportsSQLite) {
        throw new Error('SQLite is not supported in this environment. Use Cloudflare D1 instead.');
      }
      
      // Use pre-loaded Database constructor
      if (!Database) {
        throw new Error('better-sqlite3 not available. Make sure it is installed.');
      }
      const db = new Database(this.config.connection as string);
      db.pragma('journal_mode = WAL');
      return db;
    }
    
    return this.config.connection as D1Database;
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const db = this.getDatabase();
    
    if (this.config.type === 'sqlite') {
      const stmt = db.prepare(sql);
      return stmt.all(params);
    }
    
    // D1 database
    const stmt = db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.all();
    return result.results || [];
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    const db = this.getDatabase();
    
    if (this.config.type === 'sqlite') {
      const stmt = db.prepare(sql);
      return stmt.get(params);
    }
    
    // D1 database
    const stmt = db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    return await boundStmt.first();
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const db = this.getDatabase();
    
    if (this.config.type === 'sqlite') {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
      };
    }
    
    // D1 database
    const stmt = db.prepare(sql);
    const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await boundStmt.run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id
    };
  }

  close(): void {
    if (this.config.type === 'sqlite') {
      const db = this.getDatabase();
      if (db && typeof db.close === 'function') {
        db.close();
      }
    }
    // D1 doesn't need to be closed
  }

  getType(): string {
    return this.config.type;
  }
}
