/**
 * refine-sql/core - 核心功能模块 (最小包体积)
 * 只包含基础 CRUD 操作和简单查询功能
 */

// 核心类型
export type { BaseRecord } from '@refinedev/core';
export type { SqlClient, SqlQuery, SqlResult } from '../client';
export type { TableSchema } from '../typed-methods';

// 核心数据提供器 (简化版)
export { createCoreProvider as createProvider } from './provider';

// 基础链式查询 (简化版)
export { CoreChainQuery as ChainQuery } from './chain-query';

// 核心工具
export { deserializeSqlResult } from '../utils';