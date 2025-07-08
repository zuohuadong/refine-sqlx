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
      // For Bun, test the constructor to fail fast
      if (this.runtime === 'bun-sqlite') {
        try {
          this.db = new ((globalThis as any).Bun.sqlite)(dbInput);
        } catch (error) {
          throw new Error(`Failed to initialize Bun SQLite: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        this.initPromise = this.initNativeDb(dbInput);
      }
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
    // Check for Bun
    if (typeof globalThis !== 'undefined' && 'Bun' in globalThis && (globalThis as any).Bun) {
      return 'bun-sqlite';
    }
    
    // Check for Node.js
    if (typeof globalThis !== 'undefined' && 'process' in globalThis && (globalThis as any).process) {
      return 'node-sqlite';
    }
    
    throw new Error('SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments');
  }

  private async initNativeDb(path: string) {
    // Only handle Node.js here since Bun is handled synchronously in constructor
    try {
      const sqlite = await import('node:sqlite' as any);
      this.db = new (sqlite as any).DatabaseSync(path);
    } catch (error) {
      throw new Error(`Failed to initialize Node.js SQLite: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all();
      return result.results || [];
    }
    
    return this.db.prepare(sql).all(...params);
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length ? stmt.bind(...params) : stmt;
      return await boundStmt.first();
    }
    
    return this.db.prepare(sql).get(...params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    await this.ensureInitialized();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length ? stmt.bind(...params) : stmt;
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
        return params.length ? stmt.bind(...params) : stmt;
      });
      
      const results = await this.db.batch(preparedStatements);
      return results ? results.map((result: any) => result.results || []) : [];
    }
    
    return statements.map(({ sql, params = [] }) => {
      return this.db.prepare(sql).run(...params);
    });
  }

  close(): void {
    if (this.runtime !== 'd1' && this.db?.close) {
      this.db.close();
    }
  }

  getType(): string {
    return this.runtime;
  }
}
