// ORM 增强的数据提供者 - 提供完全兼容的实现
import type { BaseRecord } from "@refinedev/core";
import { DrizzleOrmAdapter } from "./adapter";
import type { OrmConfig, OrmAdapter } from "./types";
import { generateParamPlaceholder } from "./runtime-adapter";

// ORM 增强的数据提供者 - 始终使用兼容实现
export const ormDataProvider = (config: OrmConfig) => {
  const ormAdapter = new DrizzleOrmAdapter(config);
  
  // 获取占位符生成函数
  const getPlaceholder = (index: number = 1) => {
    const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
    return isSqlite ? '?' : `$${index}`;
  };
  
  // 生成多个占位符
  const getPlaceholders = (count: number) => {
    const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
    if (isSqlite) {
      return Array(count).fill('?').join(', ');
    } else {
      return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ');
    }
  };
  
  // 提供与 refine-sql 兼容的基础实现
  const baseProvider = {
    getList: async (params: any) => {
      const { resource, pagination, filters, sorters } = params;
      const { current = 1, pageSize = 10 } = pagination ?? {};
      
      // 构建基础查询
      let sql = `SELECT * FROM ${resource}`;
      const sqlParams: any[] = [];
      
      // 添加过滤条件（简化实现）
      if (filters?.length) {
        const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
        const conditions = filters.map((filter: any) => {
          if ('field' in filter) {
            sqlParams.push(filter.value);
            const placeholder = isSqlite ? '?' : `$${sqlParams.length}`;
            return `${filter.field} = ${placeholder}`;
          }
          return '';
        }).filter(Boolean);
        
        if (conditions.length) {
          sql += ` WHERE ${conditions.join(' AND ')}`;
        }
      }
      
      // 添加排序
      if (sorters?.length) {
        const sorts = sorters.map((sort: any) => `${sort.field} ${sort.order}`);
        sql += ` ORDER BY ${sorts.join(', ')}`;
      }
      
      // 添加分页
      if (pagination) {
        sql += ` LIMIT ${pageSize} OFFSET ${(current - 1) * pageSize}`;
      }

      const data = await ormAdapter.query(sql, sqlParams);
      
      // 获取总数
      let countSql = `SELECT COUNT(*) as count FROM ${resource}`;
      const countParams: any[] = [];
      
      if (filters?.length) {
        const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
        const conditions = filters.map((filter: any) => {
          if ('field' in filter) {
            countParams.push(filter.value);
            const placeholder = isSqlite ? '?' : `$${countParams.length}`;
            return `${filter.field} = ${placeholder}`;
          }
          return '';
        }).filter(Boolean);
        
        if (conditions.length) {
          countSql += ` WHERE ${conditions.join(' AND ')}`;
        }
      }
      
      const countResult = await ormAdapter.query(countSql, countParams);
      const total = countResult[0]?.count || 0;

      return { data, total };
    },
    
    getMany: async (params: any) => {
      const { resource, ids } = params;
      const placeholders = getPlaceholders(ids.length);
      const sql = `SELECT * FROM ${resource} WHERE id IN (${placeholders})`;
      const data = await ormAdapter.query(sql, ids);
      return { data };
    },
    
    create: async (params: any) => {
      const { resource, variables } = params;
      const keys = Object.keys(variables || {});
      const values = Object.values(variables || {});
      const placeholders = getPlaceholders(keys.length);
      const fields = keys.join(', ');

      const insertSql = `INSERT INTO ${resource} (${fields}) VALUES (${placeholders}) RETURNING *`;
      const result = await ormAdapter.query(insertSql, values);
      return { data: result[0] };
    },
    
    update: async (params: any) => {
      const { resource, id, variables } = params;
      const keys = Object.keys(variables || {});
      const values = Object.values(variables || {});
      const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
      
      const updateFields = keys.map((key: string, index: number) => {
        const placeholder = isSqlite ? '?' : `$${index + 1}`;
        return `${key} = ${placeholder}`;
      }).join(', ');

      const idPlaceholder = isSqlite ? '?' : `$${keys.length + 1}`;
      const sql = `UPDATE ${resource} SET ${updateFields} WHERE id = ${idPlaceholder} RETURNING *`;
      const result = await ormAdapter.query(sql, [...values, id]);
      return { data: result[0] };
    },
    
    getOne: async (params: any) => {
      const { resource, id } = params;
      const placeholder = getPlaceholder(1);
      const sql = `SELECT * FROM ${resource} WHERE id = ${placeholder}`;
      const result = await ormAdapter.query(sql, [id]);
      return { data: result[0] };
    },
    
    deleteOne: async (params: any) => {
      const { resource, id } = params;
      const placeholder = getPlaceholder(1);
      const selectSql = `SELECT * FROM ${resource} WHERE id = ${placeholder}`;
      const data = await ormAdapter.query(selectSql, [id]);
      
      const deleteSql = `DELETE FROM ${resource} WHERE id = ${placeholder}`;
      await ormAdapter.execute(deleteSql, [id]);
      
      return { data: data[0] };
    },
    
    createMany: async (params: any) => {
      const { resource, variables } = params;
      if (!variables?.length) return { data: [] };

      const results: any[] = [];
      for (const item of variables) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = getPlaceholders(keys.length);
        const fields = keys.join(', ');

        const sql = `INSERT INTO ${resource} (${fields}) VALUES (${placeholders}) RETURNING *`;
        const result = await ormAdapter.query(sql, values);
        results.push(result[0]);
      }
      return { data: results };
    },
    
    updateMany: async (params: any) => {
      const { resource, ids, variables } = params;
      if (!ids?.length) return { data: [] };

      const results: any[] = [];
      const keys = Object.keys(variables || {});
      const values = Object.values(variables || {});
      const isSqlite = ['sqlite', 'bun-sqlite', 'node-sqlite', 'turso'].includes(ormAdapter.config.database);
      
      const updateFields = keys.map((key: string, index: number) => {
        const placeholder = isSqlite ? '?' : `$${index + 1}`;
        return `${key} = ${placeholder}`;
      }).join(', ');

      for (const id of ids) {
        const idPlaceholder = isSqlite ? '?' : `$${keys.length + 1}`;
        const sql = `UPDATE ${resource} SET ${updateFields} WHERE id = ${idPlaceholder} RETURNING *`;
        const result = await ormAdapter.query(sql, [...values, id]);
        if (result[0]) results.push(result[0]);
      }
      return { data: results };
    },
    
    deleteMany: async (params: any) => {
      const { resource, ids } = params;
      if (!ids?.length) return { data: [] };

      const results: any[] = [];
      const placeholder = getPlaceholder(1);
      
      for (const id of ids) {
        const selectSql = `SELECT * FROM ${resource} WHERE id = ${placeholder}`;
        const data = await ormAdapter.query(selectSql, [id]);
        
        if (data[0]) {
          const deleteSql = `DELETE FROM ${resource} WHERE id = ${placeholder}`;
          await ormAdapter.execute(deleteSql, [id]);
          results.push(data[0]);
        }
      }
      return { data: results };
    },
    
    getApiUrl: () => "/api",
    
    custom: async (params: any) => {
      const { url, method, payload } = params;
      let sql = "";
      let sqlParams: any[] = [];

      if (payload && typeof payload === 'object' && 'sql' in payload) {
        sql = (payload as any).sql;
        sqlParams = (payload as any).params || [];
      } else if (url.includes('sql=')) {
        const urlObj = new URL(url, 'http://localhost');
        sql = urlObj.searchParams.get('sql') || '';
      }

      if (!sql) throw new Error('No SQL provided');

      const result = method === 'get' 
        ? await ormAdapter.query(sql, sqlParams)
        : await ormAdapter.execute(sql, sqlParams);

      return { data: result };
    }
  };
  
  return {
    // 复用所有基础 CRUD 操作
    ...baseProvider,
    
    // === ORM 增强功能 ===
    
    // 增强的查询方法，支持类型安全的 ORM 查询
    queryWithOrm: async <T = BaseRecord>(callback: (adapter: OrmAdapter) => Promise<T[]>): Promise<{ data: T[] }> => {
      const data = await callback(ormAdapter);
      return { data };
    },
    
    // 事务支持
    transaction: async <T>(callback: (adapter: OrmAdapter) => Promise<T>): Promise<T> => {
      return await ormAdapter.transaction(async (tx) => {
        // 创建事务专用的适配器
        const txAdapter: OrmAdapter = {
          query: tx.query.bind(tx),
          execute: tx.execute.bind(tx),
          transaction: () => Promise.reject(new Error("Nested transactions not supported")),
          close: () => Promise.resolve()
        };
        return await callback(txAdapter);
      });
    },
    
    // 自定义查询，支持原始 SQL 和 ORM
    customOrm: async ({ query, params }: { query: string | ((adapter: OrmAdapter) => Promise<any>); params?: any[] }) => {
      if (typeof query === "string") {
        const data = await ormAdapter.query(query, params);
        return { data };
      } else {
        const data = await query(ormAdapter);
        return { data };
      }
    },
    
    // 获取底层 ORM 适配器
    getOrmAdapter: () => ormAdapter,
    
    // 关闭连接
    close: () => ormAdapter.close()
  };
};
