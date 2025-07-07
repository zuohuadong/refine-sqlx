import {
    BaseRecord,
    CreateParams,
    DeleteOneParams,
    GetListParams,
    GetManyParams,
    GetOneParams,
    UpdateParams
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
    }
});
