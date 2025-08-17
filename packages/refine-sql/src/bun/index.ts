/**
 * refine-sql/bun - Bun SQLite 专用版本
 * 只包含 Bun SQLite 适配器，最小包体积
 */

import type { Database as BunDatabase } from 'bun:sqlite';
import type { BaseRecord } from '@refinedev/core';
import { createCoreProvider, type CoreDataProvider } from '../core/provider';
import type { TableSchema } from '../typed-methods';

/**
 * Bun 专用数据提供器
 */
export interface BunDataProvider<TSchema extends TableSchema = TableSchema>
  extends CoreDataProvider<TSchema> {}

/**
 * 创建 Bun SQLite 专用提供器
 */
export function createBunProvider<TSchema extends TableSchema = TableSchema>(
  database: string | BunDatabase,
  options?: {
    debug?: boolean;
  }
): BunDataProvider<TSchema> {
  if (options?.debug) {
    console.log('[refine-sql/bun] Creating Bun SQLite provider');
  }

  return createCoreProvider<TSchema>(database as any) as BunDataProvider<TSchema>;
}

// 重新导出核心类型
export type { BaseRecord, TableSchema };
export type { SqlClient, SqlQuery, SqlResult } from '../client';
export { CoreChainQuery as ChainQuery } from '../core/chain-query';