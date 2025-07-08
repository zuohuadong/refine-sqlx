import { D1Database } from './types';

type DatabaseInput = D1Database | string;
type RuntimeType = 'd1' | 'node-sqlite' | 'bun-sqlite';

export class DatabaseAdapter {
  private db: any;
  private runtime: RuntimeType;
  private initPromise?: Promise<void>;

  constructor(dbInput: DatabaseInput) {
    if (!dbInput) {
      throw new Error('Database instance or path is required');
    }

    if (typeof dbInput === 'string') {
      this.runtime = this.detectRuntime();
      this.initPromise = this.initNativeDb(dbInput);
    } else {
      this.runtime = 'd1';
      this.db = dbInput;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = undefined;
    }
  }

  private detectRuntime(): 'node-sqlite' | 'bun-sqlite' {
    // Check for Bun environment
    if (typeof globalThis !== 'undefined' && 'Bun' in globalThis && (globalThis as any).Bun) {
      const bunVersion = (globalThis as any).Bun.version;
      if (this.compareVersions(bunVersion, '1.2.0') < 0) {
        throw new Error('Bun version 1.2.0 or higher is required for built-in SQLite support');
      }
      return 'bun-sqlite';
    }
    
    // Check for Node.js environment
    if (typeof globalThis !== 'undefined' && 'process' in globalThis && (globalThis as any).process) {
      const nodeVersion = (globalThis as any).process.versions?.node;
      if (nodeVersion && this.compareVersions(nodeVersion, '22.5.0') < 0) {
        throw new Error('Node.js version 22.5.0 or higher is required for built-in SQLite support');
      }
      return 'node-sqlite';
    }
    
    throw new Error('SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments');
  }

  private compareVersions(version1: string, version2: string): number {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const a = v1[i] || 0;
      const b = v2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  private async initNativeDb(path: string) {
    if (this.runtime === 'bun-sqlite') {
      // Bun's built-in SQLite is available globally
      this.db = new ((globalThis as any).Bun).sqlite(path);
    } else {
      // Node.js 22.5+ built-in SQLite - use dynamic import to avoid bundling
      try {
        const moduleName = 'node:sqlite';
        const sqlite = await import(moduleName);
        this.db = new (sqlite as any).DatabaseSync(path);
      } catch (error) {
        throw new Error(`Failed to initialize Node.js SQLite: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all();
      return result.results || [];
    }
    
    // Both Node.js and Bun use similar API
    return this.db.prepare(sql).all(...params);
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      return await boundStmt.first();
    }
    
    return this.db.prepare(sql).get(...params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await boundStmt.run();
      return {
        changes: result.meta.changes,
        lastInsertRowid: result.meta.last_row_id
      };
    }
    
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: result.changes || 0,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<any[]> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const preparedStatements = statements.map(({ sql, params = [] }) => {
        const stmt = this.db.prepare(sql);
        return params.length > 0 ? stmt.bind(...params) : stmt;
      });
      
      const results = await this.db.batch(preparedStatements);
      return results.map((result: any) => result.results || []);
    }
    
    // For Node.js and Bun, execute statements sequentially
    return statements.map(({ sql, params = [] }) => {
      return this.db.prepare(sql).run(...params);
    });
  }

  close(): void {
    if (this.runtime !== 'd1' && this.db?.close) {
      this.db.close();
    }
    this.db = null;
  }

  getType(): string {
    return this.runtime;
  }
}
