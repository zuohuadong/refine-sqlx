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
import { DatabaseAdapter, TransactionAdapter } from "./database";
import { D1Database } from "./types";
import type { 
    EnhancedAdapter, 
    EnhancedConfig, 
    QueryCallback, 
    TransactionCallback, 
    CustomQueryParams,
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

export const dataProvider = (dbInput: D1Database | string, config?: EnhancedConfig) => {
    const createAdapter = () => new DatabaseAdapter(dbInput);
    
    // 创建增强适配器
    const createEnhancedAdapter = (): EnhancedAdapter => {
        const adapter = createAdapter();
        return {
            query: adapter.query.bind(adapter),
            execute: adapter.execute.bind(adapter),
            transaction: adapter.transaction.bind(adapter),
            close: adapter.close.bind(adapter)
        };
    };
    
    return {
        getList: async ({ resource, pagination, filters, sorters }: GetListParams) => {
            const db = createAdapter();
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
            const db = createAdapter();
            const placeholders = ids.map(() => '?').join(', ');
            const data = await db.query(`SELECT * FROM ${resource} WHERE id IN (${placeholders})`, ids) as Array<BaseRecord>;
            return { data };
        },

        create: async ({ resource, variables }: CreateParams) => {
            const db = createAdapter();
            const keys = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const placeholders = keys.map(() => '?').join(', ');

            const result = await db.execute(`INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`, values);
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [result.lastInsertRowid]) as BaseRecord;
            return { data };
        },

        update: async ({ resource, id, variables }: UpdateParams) => {
            const db = createAdapter();
            const keys = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const updateQuery = keys.map(k => `${k} = ?`).join(', ');

            await db.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            return { data };
        },

        getOne: async ({ resource, id }: GetOneParams) => {
            const db = createAdapter();
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            return { data };
        },

        deleteOne: async ({ resource, id }: DeleteOneParams) => {
            const db = createAdapter();
            const recordToDelete = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]);
            await db.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);
            return { data: recordToDelete };
        },

        createMany: async ({ resource, variables }: CreateManyParams) => {
            const db = createAdapter();
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
            const db = createAdapter();
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
            const db = createAdapter();
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
            const db = createAdapter();
            
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

        // === 增强功能 ===
        
        // 增强的查询方法，支持类型安全的查询
        queryWithEnhancement: async <T = BaseRecord>(callback: QueryCallback<T>): Promise<{ data: T[] }> => {
            const adapter = createEnhancedAdapter();
            try {
                const data = await callback(adapter);
                return { data };
            } finally {
                if (config?.enableTypeSafety !== false) {
                    // 类型安全检查可以在这里添加
                }
            }
        },
        
        // 事务支持
        transaction: async <T>(callback: TransactionCallback<T>): Promise<T> => {
            const adapter = createEnhancedAdapter();
            return await adapter.transaction(callback);
        },
        
        // 自定义查询，支持原始 SQL 和回调函数
        customEnhanced: async (params: CustomQueryParams) => {
            const adapter = createAdapter();
            
            if (typeof params.query === "string") {
                const data = await adapter.query(params.query, params.params);
                return { data };
            } else {
                const enhancedAdapter: EnhancedAdapter = {
                    query: adapter.query.bind(adapter),
                    execute: adapter.execute.bind(adapter),
                    transaction: adapter.transaction.bind(adapter),
                    close: adapter.close.bind(adapter)
                };
                const data = await params.query(enhancedAdapter);
                return { data };
            }
        },
        
        // 灵活的自定义查询（类似 refine-orm 的 customOrm）
        customFlexible: async ({ query, params }: FlexibleQueryParams) => {
            const adapter = createEnhancedAdapter();
            
            if (typeof query === "string") {
                const data = await adapter.query(query, params);
                return { data };
            } else {
                const data = await query(adapter);
                return { data };
            }
        },
        
        // 批量操作支持
        batch: async (operations: Array<{ sql: string; params?: unknown[] }>) => {
            const db = createAdapter();
            const result = await db.batch(operations);
            return { data: result };
        },
        
        // 获取底层增强适配器
        getEnhancedAdapter: () => createEnhancedAdapter(),
        
        // 关闭连接
        close: () => {
            const adapter = createAdapter();
            adapter.close();
        }
    };
};
