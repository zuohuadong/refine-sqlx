import type { DatabaseConnection, OrmConfig, RuntimeType, SupportedDatabase } from "./types";

// 运行时检测
export function detectRuntime(): RuntimeType {
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis && (globalThis as any).Bun) {
    return 'bun-sqlite';
  }
  if (typeof globalThis !== 'undefined' && 'process' in globalThis && (globalThis as any).process) {
    return 'node-sqlite';
  }
  return 'drizzle';
}

// 创建运行时特定的数据库连接
export async function createRuntimeConnection(config: OrmConfig): Promise<DatabaseConnection> {
  // 如果提供了连接，直接使用（Drizzle ORM 情况）
  if (config.connection) {
    return config.connection;
  }

  // 如果没有提供数据库路径，且不是 Drizzle，则抛出错误
  if (!config.databasePath && (config.database === 'bun-sqlite' || config.database === 'node-sqlite')) {
    throw new Error('Database path is required for SQLite runtimes');
  }

  const runtime = detectRuntime();

  switch (config.database) {
    case 'bun-sqlite':
      return createBunSqliteConnection(config.databasePath!);
    
    case 'node-sqlite':
      return await createNodeSqliteConnection(config.databasePath!);
    
    default:
      throw new Error(`Database type ${config.database} requires a connection object`);
  }
}

// Bun SQLite 连接
function createBunSqliteConnection(path: string): DatabaseConnection {
  if (typeof globalThis === 'undefined' || !('Bun' in globalThis)) {
    throw new Error('Bun runtime not detected');
  }

  try {
    const db = new ((globalThis as any).Bun.sqlite)(path);
    
    return {
      async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.all(...params);
          return Array.isArray(result) ? result : [result].filter(Boolean);
        } catch (error) {
          throw new Error(`Bun SQLite query error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      },

      async execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; insertId?: any }> {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.run(...params);
          return {
            rowsAffected: result.changes || 0,
            insertId: result.lastInsertRowid
          };
        } catch (error) {
          throw new Error(`Bun SQLite execute error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      },

      close() {
        if (db.close) {
          db.close();
        }
      }
    };
  } catch (error) {
    throw new Error(`Failed to initialize Bun SQLite: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

// Node.js SQLite 连接
async function createNodeSqliteConnection(path: string): Promise<DatabaseConnection> {
  if (typeof globalThis === 'undefined' || !('process' in globalThis)) {
    throw new Error('Node.js runtime not detected');
  }

  try {
    const sqlite = await import('node:sqlite' as any);
    const db = new (sqlite as any).DatabaseSync(path);
    
    return {
      async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.all(...params);
          return Array.isArray(result) ? result : [result].filter(Boolean);
        } catch (error) {
          throw new Error(`Node.js SQLite query error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      },

      async execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; insertId?: any }> {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.run(...params);
          return {
            rowsAffected: result.changes || 0,
            insertId: result.lastInsertRowid
          };
        } catch (error) {
          throw new Error(`Node.js SQLite execute error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      },

      close() {
        if (db.close) {
          db.close();
        }
      }
    };
  } catch (error) {
    throw new Error(`Failed to initialize Node.js SQLite: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

// 根据数据库类型生成参数占位符
export function generateParamPlaceholder(database: SupportedDatabase, paramIndex: number): string {
  switch (database) {
    case 'postgresql':
    case 'mysql':
      return `$${paramIndex}`;
    case 'sqlite':
    case 'turso':
    case 'bun-sqlite':
    case 'node-sqlite':
      return '?';
    default:
      return '?';
  }
}

// 转换 SQL 参数占位符
export function convertSqlParams(sql: string, database: SupportedDatabase): string {
  if (database === 'bun-sqlite' || database === 'node-sqlite' || database === 'sqlite') {
    // 将 PostgreSQL 风格的 $1, $2, ... 转换为 SQLite 风格的 ?
    return sql.replace(/\$\d+/g, '?');
  }
  return sql;
}
