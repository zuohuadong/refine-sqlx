/**
 * refine-sql/compat - refine-orm 兼容性模块
 * 提供与 refine-orm 完全兼容的 API
 */

// 重新导出核心功能
export type { BaseRecord } from '@refinedev/core';
export type { SqlClient, SqlQuery, SqlResult } from '../client';
export type { TableSchema } from '../typed-methods';

// 兼容性数据提供器
export { createSQLiteProvider } from './provider';

// 兼容性链式查询
export { CompatChainQuery as ChainQuery } from './chain-query';

// 兼容性工具
export {
  MigrationHelpers,
  CodeTransformer,
  type RefineOrmCompatibleProvider,
  type SQLiteProviderConfig,
} from '../refine-orm-compat';
