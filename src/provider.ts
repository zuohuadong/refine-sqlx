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
    CustomParams
} from "@refinedev/core";
import { generateSort, generateFilter } from "./utils";
import { DatabaseAdapter } from "./database";
import { D1Database } from "./types";

export const dataProvider = (
    db: D1Database
) => ({
    getList: async ({ resource, pagination, filters, sorters }: GetListParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        const {
            current = 1,
            pageSize = 10,
        } = pagination ?? {};

        const queryFilters = generateFilter(filters);

        const query: {
            _start?: number;
            _end?: number;
            _sortString?: string;
        } = {};

        query._start = (current - 1) * pageSize;
        query._end = current * pageSize;

        const generatedSort = generateSort(sorters);
        if (generatedSort) {
            query._sortString = generatedSort;
        }

        let sql = `SELECT * FROM ${resource}`;

        if (queryFilters) sql += ` WHERE ${queryFilters}`;
        if (generatedSort) sql += ` ORDER BY ${query._sortString}`;
        if (pagination) sql += ` LIMIT ${pageSize} OFFSET ${query._start}`;

        try {
            const data = await dbAdapter.query(sql) as Array<BaseRecord>;

            // Get total count
            let countSql = `SELECT COUNT(*) as count FROM ${resource}`;
            if (queryFilters) countSql += ` WHERE ${queryFilters}`;
            
            const countResult = await dbAdapter.queryFirst(countSql) as { count: number };
            const total = countResult?.count || 0;

            return {
                data,
                total,
            };
        } catch (error) {
            console.error("Error in getList()", error);
            return {
                data: [],
                total: 0,
            }
        }
    },

    getMany: async ({ resource, ids }: GetManyParams) => {
        const dbAdapter = new DatabaseAdapter(db);
        const placeholders = ids.map(() => '?').join(', ');

        try {
            const data = await dbAdapter.query(`SELECT * FROM ${resource} WHERE id IN (${placeholders})`, ids) as Array<BaseRecord>;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in getMany()", error);
            return {
                data: [],
            }
        }
    },

    create: async ({ resource, variables }: CreateParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        const columns = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const placeholders = columns.map(() => '?').join(', ');

        try {
            const result = await dbAdapter.execute(`INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`, values);
            const lastInsertRowid = result.lastInsertRowid;

            const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [lastInsertRowid]) as BaseRecord;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in create()", error);
            return {
                data: {}
            }
        }
    },

    update: async ({ resource, id, variables }: UpdateParams) => {
        const dbAdapter = new DatabaseAdapter(db);
        
        const columns = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const updateQuery = columns.map(column => `${column} = ?`).join(', ');

        try {
            await dbAdapter.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);

            const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;

            return {
                data,
            }
        } catch (error) {
            console.error("Error in update()", error);
            return {
                data: {}
            }
        }
    },

    getOne: async ({ resource, id }: GetOneParams) => {
        const dbAdapter = new DatabaseAdapter(db);
        try {
            const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in getOne()", error);
            return {
                data: {}
            }
        }
    },

    deleteOne: async ({ resource, id }: DeleteOneParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        try {
            const result = await dbAdapter.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);

            if (result.changes !== 1) {
                throw new Error(`Failed to delete ${resource} with id ${id}`);
            }

            return {
                data: null
            }
        } catch (error) {
            console.log("Error in deleteOne()", error);
            return {
                data: null
            }
        }
    },

    createMany: async ({ resource, variables }: CreateManyParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        if (!variables || variables.length === 0) {
            return { data: [] };
        }

        try {
            const results = [];
            for (const item of variables) {
                const columns = Object.keys(item);
                const values = Object.values(item);
                const placeholders = columns.map(() => '?').join(', ');

                const result = await dbAdapter.execute(
                    `INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`,
                    values
                );
                
                const insertedData = await dbAdapter.queryFirst(
                    `SELECT * FROM ${resource} WHERE id = ?`,
                    [result.lastInsertRowid]
                ) as BaseRecord;
                
                results.push(insertedData);
            }

            return { data: results };
        } catch (error) {
            console.error("Error in createMany()", error);
            return { data: [] };
        }
    },

    updateMany: async ({ resource, ids, variables }: UpdateManyParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        if (!ids || ids.length === 0) {
            return { data: [] };
        }

        try {
            const results = [];
            const columns = Object.keys(variables || {});
            const values = Object.values(variables || {});
            const updateQuery = columns.map(column => `${column} = ?`).join(', ');

            for (const id of ids) {
                await dbAdapter.execute(
                    `UPDATE ${resource} SET ${updateQuery} WHERE id = ?`,
                    [...values, id]
                );

                const updatedData = await dbAdapter.queryFirst(
                    `SELECT * FROM ${resource} WHERE id = ?`,
                    [id]
                ) as BaseRecord;

                if (updatedData) {
                    results.push(updatedData);
                }
            }

            return { data: results };
        } catch (error) {
            console.error("Error in updateMany()", error);
            return { data: [] };
        }
    },

    deleteMany: async ({ resource, ids }: DeleteManyParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        if (!ids || ids.length === 0) {
            return { data: [] };
        }

        try {
            const results = [];
            for (const id of ids) {
                // Get the record before deletion
                const recordToDelete = await dbAdapter.queryFirst(
                    `SELECT * FROM ${resource} WHERE id = ?`,
                    [id]
                ) as BaseRecord;

                if (recordToDelete) {
                    const result = await dbAdapter.execute(
                        `DELETE FROM ${resource} WHERE id = ?`,
                        [id]
                    );

                    if (result.changes === 1) {
                        results.push(recordToDelete);
                    }
                }
            }

            return { data: results };
        } catch (error) {
            console.error("Error in deleteMany()", error);
            return { data: [] };
        }
    },

    getApiUrl: () => {
        // For D1, we don't have a traditional API URL, but we can return a base URL
        // This is mainly used for relative URL construction in some scenarios
        return "/api";
    },

    custom: async ({ url, method, payload, query, headers }: CustomParams) => {
        const dbAdapter = new DatabaseAdapter(db);

        try {
            // For D1, custom method can be used for raw SQL queries
            // The URL can contain the SQL query, or payload can contain it
            let sql = "";
            let params: any[] = [];

            if (payload && typeof payload === 'object' && 'sql' in payload) {
                sql = (payload as any).sql;
                params = (payload as any).params || [];
            } else if (url.includes('sql=')) {
                // Extract SQL from URL query parameter
                const urlObj = new URL(url, 'http://localhost');
                sql = urlObj.searchParams.get('sql') || '';
            }

            if (!sql) {
                throw new Error('No SQL query provided for custom method');
            }

            let result;
            if (method === 'get') {
                result = await dbAdapter.query(sql, params);
            } else {
                result = await dbAdapter.execute(sql, params);
            }

            return {
                data: result
            };
        } catch (error) {
            console.error("Error in custom()", error);
            throw error;
        }
    }
});
