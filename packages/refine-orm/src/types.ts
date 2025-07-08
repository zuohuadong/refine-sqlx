import type { BaseRecord } from "@refinedev/core";

// 通用数据库连接类型
export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: any }>;
  close?(): Promise<void> | void;
}

// Drizzle ORM 支持的数据库类型
export type SupportedDatabase = 
  | "postgresql" 
  | "mysql" 
  | "sqlite" 
  | "turso"
  | "bun-sqlite"
  | "node-sqlite";

// 运行时类型
export type RuntimeType = 'drizzle' | 'bun-sqlite' | 'node-sqlite';

// ORM 配置选项
export interface OrmConfig {
  database: SupportedDatabase;
  connection?: DatabaseConnection;  // 可选，当使用 bun-sqlite 或 node-sqlite 时
  databasePath?: string;           // 可选，用于 SQLite 文件路径
  schema?: Record<string, any>;
  logger?: boolean;
}

// 事务接口
export interface Transaction {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: any }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ORM 适配器接口
export interface OrmAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: any }>;
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
