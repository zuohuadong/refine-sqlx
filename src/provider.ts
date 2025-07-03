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
    dbOrPath: string | D1Database
) => ({
    getList: async ({ resource, pagination, filters, sorters }: GetListParams) => {
        const db = new DatabaseAdapter(dbOrPath);

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
        if (pagination) sql += ` LIMIT ${query._start}, ${query._end}`;

        try {
            const data = await db.query(sql) as Array<BaseRecord>;

            return {
                data,
                total: data.length,
            };
        } catch (error) {
            console.error("Error in getList()", error);
            return {
                data: [],
                total: 0,
            }
        } finally {
            db.close();
        }
    },

    getMany: async ({ resource, ids }: GetManyParams) => {
        const db = new DatabaseAdapter(dbOrPath);
        const placeholders = ids.map(() => '?').join(', ');

        try {
            const data = await db.query(`SELECT * FROM ${resource} WHERE id IN (${placeholders})`, ids) as Array<BaseRecord>;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in getMany()", error);
            return {
                data: [],
            }
        } finally {
            db.close()
        }
    },

    create: async ({ resource, variables }: CreateParams) => {
        const db = new DatabaseAdapter(dbOrPath);

        const columns = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const placeholders = columns.map(() => '?').join(', ');

        try {
            const result = await db.execute(`INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders})`, values);
            const lastInsertRowid = result.lastInsertRowid;

            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [lastInsertRowid]) as BaseRecord;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in create()", error);
            return {
                data: {}
            }
        } finally {
            db.close()
        }
    },

    update: async ({ resource, id, variables }: UpdateParams) => {
        const db = new DatabaseAdapter(dbOrPath);
        
        const columns = Object.keys(variables || {});
        const values = Object.values(variables || {});
        const updateQuery = columns.map(column => `${column} = ?`).join(', ');

        try {
            await db.execute(`UPDATE ${resource} SET ${updateQuery} WHERE id = ?`, [...values, id]);

            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;

            return {
                data,
            }
        } catch (error) {
            console.error("Error in update()", error);
            return {
                data: {}
            }
        } finally {
            db.close()
        }
    },

    getOne: async ({ resource, id }: GetOneParams) => {
        const db = new DatabaseAdapter(dbOrPath);
        try {
            const data = await db.queryFirst(`SELECT * FROM ${resource} WHERE id = ?`, [id]) as BaseRecord;

            return {
                data,
            };
        } catch (error) {
            console.error("Error in getOne()", error);
            return {
                data: {}
            }
        } finally {
            db.close()
        }
    },

    deleteOne: async ({ resource, id }: DeleteOneParams) => {
        const db = new DatabaseAdapter(dbOrPath);

        try {
            const result = await db.execute(`DELETE FROM ${resource} WHERE id = ?`, [id]);

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
        } finally {
            db.close();
        }
    }
});
