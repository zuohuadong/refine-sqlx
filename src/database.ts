import { D1Database } from './types';

type DatabaseInput = D1Database | string;
type RuntimeType = 'd1' | 'node-sqlite' | 'bun-sqlite';

export class DatabaseAdapter {
  private db: any;
  private runtime: RuntimeType;
  private initPromise?: Promise<void>;
  private isInitialized: boolean = false;

  constructor(dbInput: DatabaseInput) {
    if (!dbInput) throw new Error('Database instance or path is required');

    if (typeof dbInput === 'string') {
      this.runtime = this._detectRuntime();
      if (this.runtime === 'bun-sqlite') {
        try {
          this.db = new ((globalThis as any).Bun.sqlite)(dbInput);
          this.isInitialized = true;
        } catch (error) {
          throw new Error(`Failed to initialize Bun SQLite: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        this.initPromise = this._initNativeDb(dbInput);
      }
    } else {
      this.runtime = 'd1';
      this.db = dbInput;
      this.isInitialized = true;
    }
  }

  private async _ensureInit(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = undefined;
      this.isInitialized = true;
    }
    
    if (!this.db) {
      throw new Error('Database not properly initialized');
    }
  }

  private _detectRuntime(): 'node-sqlite' | 'bun-sqlite' {
    if (typeof globalThis !== 'undefined' && 'Bun' in globalThis && (globalThis as any).Bun) return 'bun-sqlite';
    if (typeof globalThis !== 'undefined' && 'process' in globalThis && (globalThis as any).process) return 'node-sqlite';
    throw new Error('SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments');
  }

  private async _initNativeDb(path: string): Promise<void> {
    try {
      // 在CI环境中，如果强制使用模拟，则抛出错误让调用者处理
      if (typeof process !== 'undefined' && process.env && process.env.FORCE_MOCK_SQLITE === 'true') {
        throw new Error('Using mock SQLite in CI environment');
      }
      
      const sqlite = await import('node:sqlite' as any);
      this.db = new (sqlite as any).DatabaseSync(path);
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown';
      
      // 在CI环境中，如果SQLite初始化失败，提供更友好的错误信息
      if (typeof process !== 'undefined' && process.env && 
          (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true')) {
        throw new Error(`Failed to initialize Node.js SQLite in CI environment: ${errorMessage}. Consider using mock SQLite for testing.`);
      }
      
      throw new Error(`Failed to initialize Node.js SQLite: ${errorMessage}`);
    }
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    await this._ensureInit();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all();
      return result.results || [];
    }
    
    return this.db.prepare(sql).all(...params);
  }

  async queryFirst(sql: string, params: unknown[] = []): Promise<any> {
    await this._ensureInit();
    
    if (this.runtime === 'd1') {
      const stmt = this.db.prepare(sql);
      const boundStmt = params.length ? stmt.bind(...params) : stmt;
      return await boundStmt.first();
    }
    
    return this.db.prepare(sql).get(...params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    await this._ensureInit();
    
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
    await this._ensureInit();
    
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

  async transaction<T>(callback: (tx: TransactionAdapter) => Promise<T>): Promise<T> {
    await this._ensureInit();
    
    if (this.runtime === 'd1') {
      const operations: Array<{ sql: string; params: unknown[] }> = [];
      const txAdapter: TransactionAdapter = {
        query: (sql: string, params: unknown[] = []) => this.query(sql, params),
        execute: async (sql: string, params: unknown[] = []) => {
          operations.push({ sql, params });
          return { changes: 0, lastInsertRowid: undefined };
        }
      };
      
      try {
        const result = await callback(txAdapter);
        if (operations.length > 0) {
          await this.batch(operations);
        }
        return result;
      } catch (error) {
        throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      const txAdapter: TransactionAdapter = {
        query: (sql: string, params: unknown[] = []) => Promise.resolve(this.db.prepare(sql).all(...params)),
        execute: async (sql: string, params: unknown[] = []) => {
          const result = this.db.prepare(sql).run(...params);
          return { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid };
        }
      };
      
      const execSql = (sql: string) => {
        if (this.db.exec) this.db.exec(sql);
        else this.db.prepare(sql).run();
      };
      
      try {
        execSql('BEGIN TRANSACTION');
        const result = await callback(txAdapter);
        execSql('COMMIT');
        return result;
      } catch (error) {
        execSql('ROLLBACK');
        throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
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

// 事务适配器接口
export interface TransactionAdapter {
  query(sql: string, params?: unknown[]): Promise<any[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
}
