/**
 * refine-sql/d1 - Cloudflare D1 专用版本
 * 只包含 D1 适配器，最小包体积
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { BaseRecord } from '@refinedev/core';
import { createCoreProvider, type CoreDataProvider } from '../core/provider';
import type { TableSchema } from '../typed-methods';

/**
 * D1 专用数据提供器
 */
export interface D1DataProvider<TSchema extends TableSchema = TableSchema>
  extends CoreDataProvider<TSchema> {}

/**
 * 创建 D1 专用提供器
 */
export function createD1Provider<TSchema extends TableSchema = TableSchema>(
  database: D1Database,
  options?: {
    debug?: boolean;
  }
): D1DataProvider<TSchema> {
  if (options?.debug) {
    console.log('[refine-sql/d1] Creating D1 provider for Cloudflare Workers');
  }

  return createCoreProvider<TSchema>(database) as D1DataProvider<TSchema>;
}

// 重新导出核心类型
export type { BaseRecord, TableSchema };
export type { SqlClient, SqlQuery, SqlResult } from '../client';
export { CoreChainQuery as ChainQuery } from '../core/chain-query';