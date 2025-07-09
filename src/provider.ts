import {
    BaseRecord,
    CreateParams,
    CreateManyParams,
    DeleteOneParams,
    DeleteManyParams,
    GetListParams,
    GetManyParams,
    GetOneParams,
    UpdateParams,
    UpdateManyParams,
    CustomParams,
    CrudFilters,
    CrudSorting,
    CrudOperators
} from "@refinedev/core";
import { DatabaseAdapter } from "./database";
import { D1Database } from "./types";
import type { 
    EnhancedAdapter, 
    EnhancedConfig, 
    TransactionCallback, 
    FlexibleQueryParams
} from "./enhanced-types";

// 内联工具函数以减少包体积
const mapOperator = (operator: CrudOperators): string => {
    const ops: Partial<Record<CrudOperators, string>> = {
        ne: "IS NOT", gte: ">=", lte: "<=", contains: "LIKE",
        eq: "IS", gt: ">", lt: "<"
    };
    return ops[operator] || "=";
};

const generateFilter = (filters?: CrudFilters) => {
    if (!filters?.length) return "";
    const conditions = filters
        .filter(filter => "field" in filter)
        .map(filter => {
            const { field, operator, value } = filter as any;
            if (operator === 'or' || operator === 'and') {
                throw new Error(`Operator '${operator}' not supported`);
            }
            
            // 处理 contains 操作符，需要添加通配符
            if (operator === 'contains') {
                return `${field} LIKE '%${value}%'`;
            }
            
            return `${field} ${mapOperator(operator)} '${value}'`;
        });
    return conditions.join(" AND ");
};

const generateSort = (sorters?: CrudSorting) => {
    if (!sorters?.length) return;
    return sorters.map(item => `${item.field} ${item.order}`).join(', ');
};

export const dataProvider = (dbInput: D1Database | string | DatabaseAdapter, config?: EnhancedConfig) => {
    const db = dbInput instanceof DatabaseAdapter ? dbInput : new DatabaseAdapter(dbInput);
    
    return {
        getList: async ({ resource, pagination, filters, sorters }: GetListParams) => {
            const { current = 1, pageSize = 10 } = pagination ?? {};
            
            const queryFilters = generateFilter(filters);
            const generatedSort = generateSort(sorters);
            
            let sql = `SELECT * FROM ${resource}`;
            if (queryFilters) sql += ` WHERE ${queryFilters}`;
            if (generatedSort) sql += ` ORDER BY ${generatedSort}`;
            if (pagination) sql += ` LIMIT ${pageSize} OFFSET ${(current - 1) * pageSize}`;

            const data = await db.query(sql) as Array<BaseRecord>;
            
            let countSql = `SELECT COUNT(*) as count FROM ${resource}`;
            if (queryFilters) countSql += ` WHERE ${queryFilters}`;
            const countResult = await db.queryFirst(countSql) as { count: number };

            return { data, total: countResult?.count || 0 };
        },

        getMany: async ({ resource, ids }: GetManyParams) => {
            const placeholders = ids.map(() => '?').join(', ');
            const data = await db.query(`SELECT * FROM ${resource} WHERE id IN (${placeholders})`, ids) as Array<BaseRecord>;
            return { data };
        },

        create: async ({ resource, variables }: CreateParams) => {
            const keys = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const placeholders = keys.map(() => '?').join(', ');

            const result = await db.execute(`INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`, values);
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [result.lastInsertRowid]) as BaseRecord;
            return { data };
        },

        update: async ({ resource, id, variables }: UpdateParams) => {
            const keys = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const updateQuery = keys.map(k => `${k} = ?`).join(', ');

            await db.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            return { data };
        },

        getOne: async ({ resource, id }: GetOneParams) => {
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            return { data };
        },

        deleteOne: async ({ resource, id }: DeleteOneParams) => {
            const recordToDelete = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]);
            await db.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);
            return { data: recordToDelete };
        },

        createMany: async ({ resource, variables }: CreateManyParams) => {
            if (!variables?.length) return { data: [] };

            const results = [];
            for (const item of variables) {
                const keys = Object.keys(item);
                const values = Object.values(item);
                const placeholders = keys.map(() => '?').join(', ');

                const result = await db.execute(`INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`, values);
                const insertedData = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [result.lastInsertRowid]) as BaseRecord;
                results.push(insertedData);
            }
            return { data: results };
        },

        updateMany: async ({ resource, ids, variables }: UpdateManyParams) => {
            if (!ids?.length) return { data: [] };

            const results = [];
            const keys = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const updateQuery = keys.map(k => `${k} = ?`).join(', ');

            for (const id of ids) {
                await db.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);
                const updatedData = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
                if (updatedData) results.push(updatedData);
            }
            return { data: results };
        },

        deleteMany: async ({ resource, ids }: DeleteManyParams) => {
            if (!ids?.length) return { data: [] };

            const results = [];
            for (const id of ids) {
                const recordToDelete = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
                if (recordToDelete) {
                    await db.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);
                    results.push(recordToDelete);
                }
            }
            return { data: results };
        },

        getApiUrl: () => "/api",

        custom: async ({ url, method, payload }: CustomParams) => {
            let sql = "";
            let params: any[] = [];

            if (payload && typeof payload === 'object' && 'sql' in payload) {
                sql = (payload as any).sql;
                params = (payload as any).params || [];
            } else if (url.includes('sql=')) {
                const urlObj = new URL(url, 'http://localhost');
                sql = urlObj.searchParams.get('sql') || '';
            }

            if (!sql) throw new Error('No SQL provided');

            const result = method === 'get' 
                ? await db.query(sql, params)
                : await db.execute(sql, params);

            return { data: result };
        },

        // Enhanced Methods
        transaction: async <T>(callback: TransactionCallback<T>): Promise<T> => {
            return db.transaction(callback);
        },

        customFlexible: async (params: FlexibleQueryParams): Promise<any> => {
            if (typeof params.query === 'string') {
                // 智能判断SQL类型：SELECT用query，其他用execute
                const sqlUpper = params.query.trim().toUpperCase();
                const isSelectQuery = sqlUpper.startsWith('SELECT') || 
                                     sqlUpper.startsWith('WITH') || 
                                     sqlUpper.startsWith('EXPLAIN') ||
                                     sqlUpper.startsWith('PRAGMA');
                
                if (isSelectQuery) {
                    const result = await db.query(params.query, params.params);
                    return { data: result };
                } else {
                    // INSERT, UPDATE, DELETE, CREATE, DROP等操作
                    const result = await db.execute(params.query, params.params);
                    return { data: result };
                }
            }
            if (typeof params.query === 'function') {
                const result = await params.query(db as EnhancedAdapter);
                return { data: result };
            }
            throw new Error('Invalid query type provided to customFlexible');
        },

        // customEnhanced - 兼容别名，指向 customFlexible
        customEnhanced: async (params: FlexibleQueryParams): Promise<any> => {
            if (typeof params.query === 'string') {
                // 智能判断SQL类型：SELECT用query，其他用execute
                const sqlUpper = params.query.trim().toUpperCase();
                const isSelectQuery = sqlUpper.startsWith('SELECT') || 
                                     sqlUpper.startsWith('WITH') || 
                                     sqlUpper.startsWith('EXPLAIN') ||
                                     sqlUpper.startsWith('PRAGMA');
                
                if (isSelectQuery) {
                    const result = await db.query(params.query, params.params);
                    return { data: result };
                } else {
                    // INSERT, UPDATE, DELETE, CREATE, DROP等操作
                    const result = await db.execute(params.query, params.params);
                    return { data: result };
                }
            }
            if (typeof params.query === 'function') {
                const result = await params.query(db as EnhancedAdapter);
                return { data: result };
            }
            throw new Error('Invalid query type provided to customEnhanced');
        },

        // queryWithEnhancement - 类型安全查询方法
        queryWithEnhancement: async <T>(callback: (adapter: EnhancedAdapter) => Promise<T>): Promise<{ data: T }> => {
            const result = await callback(db as EnhancedAdapter);
            return { data: result };
        },

        // batch - 批量操作方法
        batch: async (operations: Array<{ sql: string; params?: any[] }>): Promise<{ data: any[] }> => {
            const results = [];
            for (const op of operations) {
                const result = await db.execute(op.sql, op.params || []);
                results.push(result);
            }
            return { data: results };
        },
        
        getEnhancedAdapter: (): EnhancedAdapter => db as EnhancedAdapter,
    };
};
