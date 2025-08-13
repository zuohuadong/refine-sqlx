import type {
  GetOneParams,
  GetListParams,
  DeleteOneParams,
  GetManyParams,
} from '@refinedev/core';
import type { SqlClient } from './client';
import { SqlTransformer } from '@refine-orm/core-utils';
import { deserializeSqlResult } from './utils';

// Type definitions
export type TableSchema = Record<string, any>;
export type InferRecord<TSchema, TTable extends keyof TSchema> = TSchema[TTable];

export type TypedCreateParams<T> = {
  variables: Partial<T>;
};

export type TypedUpdateParams<T> = {
  id: any;
  variables: Partial<T>;
  meta?: any;
};

export type TypedGetOneResponse<T> = {
  data: T;
};

export type TypedGetListResponse<T> = {
  data: T[];
  total: number;
};

export type TypedGetManyResponse<T> = {
  data: T[];
};

export type TypedCreateResponse<T> = {
  data: T;
};

export type TypedUpdateResponse<T> = {
  data: T;
};

export type TypedDeleteOneResponse<T> = {
  data: T;
};

// Type-safe methods class
export class SqlxTypedMethods<TSchema extends TableSchema = TableSchema> {
  private transformer: SqlTransformer;

  constructor(private client: SqlClient) {
    this.transformer = new SqlTransformer();
  }

  /**
   * Type-safe getOne operation
   */
  async getTyped<TTable extends keyof TSchema & string>(
    params: GetOneParams & { resource: TTable }
  ): Promise<TypedGetOneResponse<InferRecord<TSchema, TTable>>> {
    const query = this.transformer.buildSelectQuery(params.resource as string, {
      filters: [
        {
          field: params.meta?.['idColumnName'] ?? 'id',
          operator: 'eq',
          value: params.id,
        },
      ],
    });

    const result = await this.client.query(query);
    const [data] = deserializeSqlResult(result);

    return { data: data as InferRecord<TSchema, TTable> };
  }

  /**
   * Type-safe getList operation
   */
  async getListTyped<TTable extends keyof TSchema & string>(
    params: GetListParams & { resource: TTable }
  ): Promise<TypedGetListResponse<InferRecord<TSchema, TTable>>> {
    const query = this.transformer.buildSelectQuery(params.resource as string, {
      filters: params.filters,
      sorting: params.sorters,
      pagination: params.pagination,
    });

    const result = await this.client.query(query);
    const data = deserializeSqlResult(result);

    // Build count query
    const countQuery = this.transformer.buildCountQuery(
      params.resource as string,
      params.filters
    );
    const {
      rows: [[count]],
    } = await this.client.query(countQuery);

    return {
      total: count as number,
      data: data as InferRecord<TSchema, TTable>[],
    };
  }

  /**
   * Type-safe getMany operation
   */
  async getManyTyped<TTable extends keyof TSchema & string>(
    params: GetManyParams & { resource: TTable }
  ): Promise<TypedGetManyResponse<InferRecord<TSchema, TTable>>> {
    if (!params.ids.length) return { data: [] };

    const query = this.transformer.buildSelectQuery(params.resource as string, {
      filters: [
        {
          field: params.meta?.['idColumnName'] ?? 'id',
          operator: 'in',
          value: params.ids,
        },
      ],
    });

    const result = await this.client.query(query);
    const data = deserializeSqlResult(result);

    return { data: data as InferRecord<TSchema, TTable>[] };
  }

  /**
   * Type-safe create operation
   */
  async createTyped<TTable extends keyof TSchema & string>(
    params: TypedCreateParams<InferRecord<TSchema, TTable>> & {
      resource: TTable;
    }
  ): Promise<TypedCreateResponse<InferRecord<TSchema, TTable>>> {
    const query = this.transformer.buildInsertQuery(
      params.resource as string,
      params.variables as any
    );
    const { lastInsertId } = await this.client.execute(query);

    if (!lastInsertId) {
      throw new Error('Create operation failed');
    }

    return this.getTyped({ resource: params.resource, id: lastInsertId });
  }

  /**
   * Type-safe update operation
   */
  async updateTyped<TTable extends keyof TSchema & string>(
    params: TypedUpdateParams<InferRecord<TSchema, TTable>> & {
      resource: TTable;
    }
  ): Promise<TypedUpdateResponse<InferRecord<TSchema, TTable>>> {
    const query = this.transformer.buildUpdateQuery(
      params.resource as string,
      params.variables as any,
      { field: 'id', value: params.id }
    );

    await this.client.execute(query);
    return this.getTyped(params);
  }

  /**
   * Type-safe delete operation
   */
  async deleteTyped<TTable extends keyof TSchema & string>(
    params: DeleteOneParams & { resource: TTable }
  ): Promise<TypedDeleteOneResponse<InferRecord<TSchema, TTable>>> {
    const result = await this.getTyped<TTable>(params);

    const query = this.transformer.buildDeleteQuery(params.resource as string, {
      field: params.meta?.['idColumnName'] ?? 'id',
      value: params.id,
    });

    await this.client.execute(query);
    return result;
  }

  /**
   * Type-safe batch create operations
   */
  async createManyTyped<TTable extends keyof TSchema & string>(params: {
    resource: TTable;
    variables: Array<Partial<InferRecord<TSchema, TTable>>>;
  }): Promise<{ data: InferRecord<TSchema, TTable>[] }> {
    if (!params.variables.length) return { data: [] };

    // Use individual creates for batch operations
    const results = await Promise.all(
      params.variables.map(variables =>
        this.createTyped({ resource: params.resource, variables })
      )
    );
    return { data: results.map(result => result.data) };
  }

  async updateManyTyped<TTable extends keyof TSchema & string>(params: {
    resource: TTable;
    ids: any[];
    variables: Partial<InferRecord<TSchema, TTable>>;
  }): Promise<{ data: InferRecord<TSchema, TTable>[] }> {
    if (!params.ids.length) return { data: [] };

    const query = this.transformer.buildUpdateQuery(
      params.resource as string,
      params.variables as any,
      { field: 'id', value: params.ids }
    );

    await this.client.execute(query);
    return this.getManyTyped({ resource: params.resource, ids: params.ids });
  }

  async deleteManyTyped<TTable extends keyof TSchema & string>(params: {
    resource: TTable;
    ids: any[];
  }): Promise<{ data: InferRecord<TSchema, TTable>[] }> {
    if (!params.ids.length) return { data: [] };

    const result = await this.getManyTyped<TTable>(params);
    const query = this.transformer.buildDeleteQuery(params.resource as string, {
      field: 'id',
      value: params.ids,
    });

    await this.client.execute(query);
    return result;
  }

  /**
   * Execute a raw SQL query with complex type safety
   */
  async queryTyped<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    const result = await this.client.query({ sql, args });
    return deserializeSqlResult(result) as T[];
  }

  /**
   * Execute a raw SQL statement with complex type safety
   */
  async executeTyped(
    sql: string,
    args: any[] = []
  ): Promise<{ changes?: number; lastInsertId?: number | string }> {
    return await this.client.execute({ sql, args });
  }

  /**
   * Check if a record exists with complex type constraints
   */
  async existsTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>
  ): Promise<boolean> {
    const filters = Object.entries(conditions).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const query = this.transformer.buildCountQuery(resource as string, filters);
    const result = await this.client.query(query);
    const [[count]] = result.rows;
    return (count as number) > 0;
  }

  /**
   * Find a single record by conditions with complex type constraints
   */
  async findTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>
  ): Promise<InferRecord<TSchema, TTable> | null> {
    const filters = Object.entries(conditions).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const query = this.transformer.buildSelectQuery(resource as string, {
      filters,
      pagination: { current: 1, pageSize: 1, mode: 'server' as const },
    });

    const result = await this.client.query(query);
    const data = deserializeSqlResult(result);
    return (data[0] as InferRecord<TSchema, TTable>) || null;
  }

  /**
   * Find multiple records by conditions with complex type constraints
   */
  async findManyTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        field: keyof InferRecord<TSchema, TTable>;
        order: 'asc' | 'desc';
      }[];
    }
  ): Promise<InferRecord<TSchema, TTable>[]> {
    const filters = Object.entries(conditions).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    }));

    const sorting = options?.orderBy?.map(({ field, order }) => ({
      field: field as string,
      order,
    }));

    const pagination =
      options?.limit ?
        {
          current:
            options.offset ? Math.floor(options.offset / options.limit) + 1 : 1,
          pageSize: options.limit,
          mode: 'server' as const,
        }
      : undefined;

    const query = this.transformer.buildSelectQuery(resource as string, {
      filters,
      sorting,
      pagination,
    });

    const result = await this.client.query(query);
    return deserializeSqlResult(result) as InferRecord<TSchema, TTable>[];
  }
}