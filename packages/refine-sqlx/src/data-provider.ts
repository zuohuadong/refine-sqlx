import type {
  BaseRecord,
  CreateManyParams,
  CreateManyResponse,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteManyParams,
  DeleteManyResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateManyParams,
  UpdateManyResponse,
  UpdateParams,
  UpdateResponse,
} from '@refinedev/core';
import type { SqlClient, SqlClientFactory } from './client';
import {
  createCrudFilters,
  createCrudSorting,
  createPagination,
  deserializeSqlResult,
} from './utils';
import { resolve } from 'dns';

export default (client: SqlClient | SqlClientFactory): DataProvider => {
  return {
    getList,
    getMany,
    getOne,
    create,
    createMany,
    update,
    updateMany,
    deleteOne,
    deleteMany,
  } as DataProvider;

  async function resolveClient() {
    if ('query' in client && 'execute') {
      return client;
    } else if ('connect' in client) {
      return (client = await client.connect());
    }

    throw new Error(
      'Invalid client, Please provide SqlClient or SqlClientFactory',
    );
  }

  async function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<T>> {
    const client = await resolveClient();
    const sqlParts: string[] = ['SELECT * FROM', params.resource];
    const sqlValues: unknown[] = [];

    const where = createCrudFilters(params.filters);
    if (where?.sql) {
      sqlParts.push('WHERE', where.sql);
      sqlValues.push(...where.values);
    }

    const sort = createCrudSorting(params.sorters);
    if (sort) sqlParts.push('ORDER BY', sort);

    const pagination = createPagination(params.pagination);
    if (pagination?.sql) {
      sqlParts.push(pagination.sql);
      sqlValues.push(...pagination.values);
    }

    const result = await client.query({
      sql: sqlParts.join(' '),
      args: sqlValues,
    });
    const data = deserializeSqlResult(result);

    const {
      rows: [[count]],
    } = await client.query({
      sql: `SELECT COUNT(*) FROM ${params.resource}`,
      args: [],
    });

    return { total: count as number, data: data as T[] };
  }

  async function getMany<T extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<T>> {
    const client = await resolveClient();
    const placeholder = params.ids.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${params.resource} WHERE id IN (${placeholder})`;
    const result = await client.query({ sql, args: params.ids });

    return { data: deserializeSqlResult(result) as T[] };
  }

  function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    throw new Error('Unimplemented');
  }

  function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>,
  ): Promise<CreateResponse<T>> {
    throw new Error('Unimplemented');
  }

  function createMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateManyParams<Variables>,
  ): Promise<CreateManyResponse<T>> {
    throw new Error('Unimplemented');
  }

  function update<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateParams<Variables>,
  ): Promise<UpdateResponse<T>> {
    throw new Error('Unimplemented');
  }

  function updateMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateManyParams<Variables>,
  ): Promise<UpdateManyResponse<T>> {
    throw new Error('Unimplemented');
  }

  function deleteOne<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteOneParams<Variables>,
  ): Promise<DeleteOneResponse<T>> {
    throw new Error('Unimplemented');
  }

  function deleteMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteManyParams<Variables>,
  ): Promise<DeleteManyResponse<T>> {
    throw new Error('Unimplemented');
  }
};
