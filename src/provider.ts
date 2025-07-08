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
    dbInput: D1Database | string
) => ({
    getList: async ({ resource, pagination, filters, sorters }: GetListParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const { current = 1, pageSize = 10 } = pagination ?? {};
        
        const queryFilters = generateFilter(filters);
        const generatedSort = generateSort(sorters);
        
        let sql = `SELECT * FROM ${resource}`;
        if (queryFilters) sql += ` WHERE ${queryFilters}`;
        if (generatedSort) sql += ` ORDER BY ${generatedSort}`;
        if (pagination) sql += ` LIMIT ${pageSize} OFFSET ${(current - 1) * pageSize}`;

        const data = await dbAdapter.query(sql) as Array<BaseRecord>;
        
        // Get total
        let countSql = `SELECT COUNT(*) as count FROM ${resource}`;
        if (queryFilters) countSql += ` WHERE ${queryFilters}`;
        const countResult = await dbAdapter.queryFirst(countSql) as { count: number };

        return {
            data,
            total: countResult?.count || 0,
        };
    },

    getMany: async ({ resource, ids }: GetManyParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const placeholders = ids.map(() => '?').join(', ');
        const data = await dbAdapter.query(`SELECT * FROM ${resource} WHERE id IN (${placeholders})`, ids) as Array<BaseRecord>;
        return { data };
    },

    create: async ({ resource, variables }: CreateParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const keys = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const placeholders = keys.map(() => '?').join(', ');

        const result = await dbAdapter.execute(`INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [result.lastInsertRowid]) as BaseRecord;
        return { data };
    },

    update: async ({ resource, id, variables }: UpdateParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const keys = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const updateQuery = keys.map(k => `${k} = ?`).join(', ');

        await dbAdapter.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);
        const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
        return { data };
    },

    getOne: async ({ resource, id }: GetOneParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const data = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
        return { data };
    },

    deleteOne: async ({ resource, id }: DeleteOneParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        const recordToDelete = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]);
        await dbAdapter.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);
        return { data: recordToDelete };
    },

    createMany: async ({ resource, variables }: CreateManyParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        if (!variables?.length) return { data: [] };

        const results = [];
        for (const item of variables) {
            const keys = Object.keys(item);
            const values = Object.values(item);
            const placeholders = keys.map(() => '?').join(', ');

            const result = await dbAdapter.execute(`INSERT INTO ${resource} (${keys.join(', ')}) VALUES (${placeholders})`, values);
            const insertedData = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [result.lastInsertRowid]) as BaseRecord;
            results.push(insertedData);
        }
        return { data: results };
    },

    updateMany: async ({ resource, ids, variables }: UpdateManyParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        if (!ids?.length) return { data: [] };

        const results = [];
        const keys = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const updateQuery = keys.map(k => `${k} = ?`).join(', ');

        for (const id of ids) {
            await dbAdapter.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);
            const updatedData = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            if (updatedData) results.push(updatedData);
        }
        return { data: results };
    },

    deleteMany: async ({ resource, ids }: DeleteManyParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        if (!ids?.length) return { data: [] };

        const results = [];
        for (const id of ids) {
            const recordToDelete = await dbAdapter.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;
            if (recordToDelete) {
                await dbAdapter.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);
                results.push(recordToDelete);
            }
        }
        return { data: results };
    },

    getApiUrl: () => "/api",

    custom: async ({ url, method, payload }: CustomParams) => {
        const dbAdapter = new DatabaseAdapter(dbInput);
        
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
            ? await dbAdapter.query(sql, params)
            : await dbAdapter.execute(sql, params);

        return { data: result };
    }
});
