/**
 * refine-sql/node - Node.js 专用版本
 * 只包含 better-sqlite3 和 node:sqlite 适配器
 */

import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';
import type { BaseRecord } from '@refinedev/core';
import { createCoreProvider, type CoreDataProvider } from '../core/provider';
import type { TableSchema } from '../typed-methods';

/**
 * Node.js 专用数据提供器
 */
export interface NodeDataProvider<TSchema extends TableSchema = TableSchema>
  extends CoreDataProvider<TSchema> {}

/**
 * 创建 Node.js SQLite 专用提供器
 */
export function createNodeProvider<TSchema extends TableSchema = TableSchema>(
  database: string | NodeDatabase | BetterSqlite3.Database,
  options?: {
    debug?: boolean;
    driver?: 'better-sqlite3' | 'node:sqlite' | 'auto';
  }
): NodeDataProvider<TSchema> {
  if (options?.debug) {
    console.log(`[refine-sql/node] Creating Node.js SQLite provider with ${options.driver || 'auto'} driver`);
  }

  return createCoreProvider<TSchema>(database as any) as NodeDataProvider<TSchema>;
}

// 重新导出核心类型
export type { BaseRecord, TableSchema };
export type { SqlClient, SqlQuery, SqlResult } from '../client';
export { CoreChainQuery as ChainQuery } from '../core/chain-query';