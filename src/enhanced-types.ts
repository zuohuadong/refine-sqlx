// 增强功能的类型定义
import type { TransactionAdapter } from "./database";

// 增强的数据库适配器接口
export interface EnhancedAdapter {
  query(sql: string, params?: unknown[]): Promise<any[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction<T>(callback: (tx: TransactionAdapter) => Promise<T>): Promise<T>;
  close(): void;
}

// 增强功能配置
export interface EnhancedConfig {
  enableTypeSafety?: boolean;
  enableTransactions?: boolean;
  enableAdvancedQueries?: boolean;
}

// 事务回调函数类型
export type TransactionCallback<T> = (adapter: TransactionAdapter) => Promise<T>;

// 灵活的自定义查询参数
export interface FlexibleQueryParams {
  query: string | ((adapter: EnhancedAdapter) => Promise<any>);
  params?: any[];
}
