import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type {
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  GetManyParams,
  GetManyResponse,
  CreateParams,
  CreateResponse,
  UpdateParams,
  UpdateResponse,
  DeleteOneParams,
  DeleteOneResponse,
  CreateManyParams,
  CreateManyResponse,
  UpdateManyParams,
  UpdateManyResponse,
  DeleteManyParams,
  DeleteManyResponse,
} from '@refinedev/core';

import type { RefineOrmDataProvider } from '../types/client.js';
import type { RefineOrmOptions } from '../types/config.js';
import { BaseDatabaseAdapter } from '../adapters/base.js';
import { RefineQueryBuilder } from './query-builder.js';
import { ChainQuery } from './chain-query-builder.js';
import { MorphQueryBuilder } from './morph-query.js';
import {
  RelationshipQueryBuilder,
  type RelationshipConfig,
} from './relationship-query-builder.js';
import { createPerformanceMonitor } from './performance-monitor.js';
import {
  SelectChain,
  InsertChain,
  UpdateChain,
  DeleteChain,
  createSelectChain,
  createInsertChain,
  createUpdateChain,
  createDeleteChain,
} from './native-query-builders.js';
import { QueryError } from '../types/errors.js';

/**
 * Build default relationship configurations based on relation names
 */
function buildDefaultRelationshipConfigs<TSchema extends Record<string, Table>>(
  resource: keyof TSchema,
  relations: (keyof TSchema)[],
  schema: TSchema
): Record<string, RelationshipConfig<TSchema>> {
  const configs: Record<string, RelationshipConfig<TSchema>> = {};

  for (const relation of relations) {
    // Try to infer relationship type based on naming conventions
    const relationStr = String(relation);
    const resourceStr = String(resource);

    if (relationStr.endsWith('s') && relationStr !== resourceStr) {
      // Likely hasMany relationship (plural form)
      configs[relationStr] = {
        type: 'hasMany',
        relatedTable: relation,
        localKey: 'id',
        relatedKey: `${resourceStr.slice(0, -1)}_id`,
      };
    } else if (relationStr.endsWith('_id')) {
      // Likely belongsTo relationship (foreign key)
      const relatedTableName = relationStr.replace('_id', 's') as keyof TSchema;
      if (schema[relatedTableName]) {
        configs[relationStr.replace('_id', '')] = {
          type: 'belongsTo',
          relatedTable: relatedTableName,
          foreignKey: relationStr,
          relatedKey: 'id',
        };
      }
    } else {
      // Default to hasOne relationship
      configs[relationStr] = {
        type: 'hasOne',
        relatedTable: relation,
        localKey: 'id',
        relatedKey: `${resourceStr.slice(0, -1)}_id`,
      };
    }
  }

  return configs;
}

/**
 * Create RefineORM data provider from a database adapter
 */
export function createProvider<TSchema extends Record<string, Table>>(
  adapter: BaseDatabaseAdapter<TSchema>,
  options?: RefineOrmOptions & { enablePerformanceMonitoring?: boolean }
): RefineOrmDataProvider<TSchema> {
  console.log(
    'createProvider called with adapter:',
    typeof adapter,
    Object.getOwnPropertyNames(adapter)
  );
  const queryBuilder = new RefineQueryBuilder<TSchema>();

  // Initialize performance monitoring if enabled
  const performanceMonitor =
    options?.enablePerformanceMonitoring ?
      createPerformanceMonitor({
        databaseType: adapter.getAdapterInfo().type as
          | 'postgresql'
          | 'mysql'
          | 'sqlite',
        enabled: true,
        batchSize: options?.pool?.max ? Math.floor(options.pool.max * 0.8) : 80,
      })
    : null;

  return {
    // Get the drizzle client and schema
    get client() {
      return adapter.getClient();
    },

    get schema() {
      return adapter.getClient().schema;
    },

    // Expose adapter for testing purposes
    get adapter() {
      return adapter;
    },

    // Get list of records with filtering, sorting, and pagination
    async getList<TTable extends keyof TSchema & string>(
      params: GetListParams & { resource: TTable }
    ): Promise<GetListResponse<InferSelectModel<TSchema[TTable]>>> {
      const startTime = Date.now();

      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        // Build the query using query builder
        const query = queryBuilder.buildListQuery(client, table, params);
        const countQuery = queryBuilder.buildCountQuery(
          client,
          table,
          params.filters
        );

        // Execute queries
        const [data, totalResult] = await Promise.all([
          query.execute ? query.execute() : query,
          countQuery.execute ? countQuery.execute() : countQuery,
        ]);

        // Track performance if monitoring is enabled
        if (performanceMonitor) {
          const executionTime = Date.now() - startTime;
          performanceMonitor.trackQuery(
            params.resource,
            'select',
            params.filters || [],
            params.sorters || [],
            executionTime,
            `SELECT FROM ${params.resource} with filters and pagination`
          );
        }

        return {
          data: data as InferSelectModel<TSchema[TTable]>[],
          total: totalResult[0]?.count || 0,
        };
      } catch (error) {
        throw new QueryError(
          `Failed to get list for resource '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Get single record by ID
    async getOne<TTable extends keyof TSchema & string>(
      params: GetOneParams & { resource: TTable }
    ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildGetOneQuery(client, table, params.id);
        const result = await (query.execute ? query.execute() : query);

        if (!result || result.length === 0) {
          throw new QueryError(
            `Record with id '${params.id}' not found in '${params.resource}'`
          );
        }

        return { data: result[0] as InferSelectModel<TSchema[TTable]> };
      } catch (error) {
        throw new QueryError(
          `Failed to get record from '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Get multiple records by IDs
    async getMany<TTable extends keyof TSchema & string>(
      params: GetManyParams & { resource: TTable }
    ): Promise<GetManyResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildGetManyQuery(client, table, params.ids);
        const result = await (query.execute ? query.execute() : query);

        return { data: result as InferSelectModel<TSchema[TTable]>[] };
      } catch (error) {
        throw new QueryError(
          `Failed to get records from '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Create single record
    async create<TTable extends keyof TSchema & string>(
      params: CreateParams & {
        resource: TTable;
        variables: InferInsertModel<TSchema[TTable]>;
      }
    ): Promise<CreateResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema. Available tables: ${client.schema ? Object.keys(client.schema).join(', ') : 'none'}`
          );
        }

        const query = queryBuilder.buildCreateQuery(
          client,
          table,
          params.variables
        );
        const result = await (query.execute ? query.execute() : query);

        if (!result || result.length === 0) {
          throw new QueryError(
            `Failed to create record in '${params.resource}'`
          );
        }

        return { data: result[0] as InferSelectModel<TSchema[TTable]> };
      } catch (error) {
        throw new QueryError(
          `Failed to create record in '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Update single record
    async update<TTable extends keyof TSchema & string>(
      params: UpdateParams & {
        resource: TTable;
        variables: Partial<InferInsertModel<TSchema[TTable]>>;
      }
    ): Promise<UpdateResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildUpdateQuery(
          client,
          table,
          params.id,
          params.variables
        );
        const result = await (query.execute ? query.execute() : query);

        if (!result || result.length === 0) {
          throw new QueryError(
            `Record with id '${params.id}' not found in '${params.resource}'`
          );
        }

        return { data: result[0] as InferSelectModel<TSchema[TTable]> };
      } catch (error) {
        throw new QueryError(
          `Failed to update record in '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Delete single record
    async deleteOne<TTable extends keyof TSchema & string>(
      params: DeleteOneParams & { resource: TTable }
    ): Promise<DeleteOneResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildDeleteQuery(client, table, params.id);
        const result = await (query.execute ? query.execute() : query);

        if (!result || result.length === 0) {
          throw new QueryError(
            `Record with id '${params.id}' not found in '${params.resource}'`
          );
        }

        return { data: result[0] as InferSelectModel<TSchema[TTable]> };
      } catch (error) {
        throw new QueryError(
          `Failed to delete record from '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Create multiple records with batch optimization
    async createMany<TTable extends keyof TSchema & string>(
      params: CreateManyParams & {
        resource: TTable;
        variables: InferInsertModel<TSchema[TTable]>[];
      }
    ): Promise<CreateManyResponse<InferSelectModel<TSchema[TTable]>>> {
      const startTime = Date.now();

      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        // Use batch optimization for large datasets
        const batchSize = 100; // Optimal batch size for most databases
        const results: InferSelectModel<TSchema[TTable]>[] = [];

        if (params.variables.length > batchSize) {
          // Process in batches for better performance
          for (let i = 0; i < params.variables.length; i += batchSize) {
            const batch = params.variables.slice(i, i + batchSize);
            const query = queryBuilder.buildCreateManyQuery(
              client,
              table,
              batch
            );
            const batchResult = await (query.execute ? query.execute() : query);
            results.push(
              ...(batchResult as InferSelectModel<TSchema[TTable]>[])
            );
          }
        } else {
          const query = queryBuilder.buildCreateManyQuery(
            client,
            table,
            params.variables
          );
          const result = await (query.execute ? query.execute() : query);
          results.push(...(result as InferSelectModel<TSchema[TTable]>[]));
        }

        // Track performance if monitoring is enabled
        if (performanceMonitor) {
          const executionTime = Date.now() - startTime;
          performanceMonitor.trackQuery(
            params.resource,
            'insert',
            [],
            [],
            executionTime,
            `INSERT INTO ${params.resource} (batch of ${params.variables.length})`
          );
        }

        return { data: results };
      } catch (error) {
        throw new QueryError(
          `Failed to create records in '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Update multiple records with batch optimization
    async updateMany<TTable extends keyof TSchema & string>(
      params: UpdateManyParams & {
        resource: TTable;
        variables: Partial<InferInsertModel<TSchema[TTable]>>;
      }
    ): Promise<UpdateManyResponse<InferSelectModel<TSchema[TTable]>>> {
      const startTime = Date.now();

      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        // Use batch optimization for large ID lists
        const batchSize = 50; // Smaller batch size for updates to avoid lock contention
        const results: InferSelectModel<TSchema[TTable]>[] = [];

        if (params.ids.length > batchSize) {
          // Process in batches for better performance and reduced lock contention
          for (let i = 0; i < params.ids.length; i += batchSize) {
            const batchIds = params.ids.slice(i, i + batchSize);
            const query = queryBuilder.buildUpdateManyQuery(
              client,
              table,
              batchIds,
              params.variables
            );
            const batchResult = await (query.execute ? query.execute() : query);
            results.push(
              ...(batchResult as InferSelectModel<TSchema[TTable]>[])
            );
          }
        } else {
          const query = queryBuilder.buildUpdateManyQuery(
            client,
            table,
            params.ids,
            params.variables
          );
          const result = await (query.execute ? query.execute() : query);
          results.push(...(result as InferSelectModel<TSchema[TTable]>[]));
        }

        // Track performance if monitoring is enabled
        if (performanceMonitor) {
          const executionTime = Date.now() - startTime;
          performanceMonitor.trackQuery(
            params.resource,
            'update',
            [],
            [],
            executionTime,
            `UPDATE ${params.resource} (batch of ${params.ids.length})`
          );
        }

        return { data: results };
      } catch (error) {
        throw new QueryError(
          `Failed to update records in '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Delete multiple records with batch optimization
    async deleteMany<TTable extends keyof TSchema & string>(
      params: DeleteManyParams & { resource: TTable }
    ): Promise<DeleteManyResponse<InferSelectModel<TSchema[TTable]>>> {
      const startTime = Date.now();

      try {
        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new QueryError(
            `Table '${params.resource}' not found in schema`
          );
        }

        // Use batch optimization for large ID lists
        const batchSize = 50; // Smaller batch size for deletes to avoid lock contention
        const results: InferSelectModel<TSchema[TTable]>[] = [];

        if (params.ids.length > batchSize) {
          // Process in batches for better performance and reduced lock contention
          for (let i = 0; i < params.ids.length; i += batchSize) {
            const batchIds = params.ids.slice(i, i + batchSize);
            const query = queryBuilder.buildDeleteManyQuery(
              client,
              table,
              batchIds
            );
            const batchResult = await (query.execute ? query.execute() : query);
            results.push(
              ...(batchResult as InferSelectModel<TSchema[TTable]>[])
            );
          }
        } else {
          const query = queryBuilder.buildDeleteManyQuery(
            client,
            table,
            params.ids
          );
          const result = await (query.execute ? query.execute() : query);
          results.push(...(result as InferSelectModel<TSchema[TTable]>[]));
        }

        // Track performance if monitoring is enabled
        if (performanceMonitor) {
          const executionTime = Date.now() - startTime;
          performanceMonitor.trackQuery(
            params.resource,
            'delete',
            [],
            [],
            executionTime,
            `DELETE FROM ${params.resource} (batch of ${params.ids.length})`
          );
        }

        return { data: results };
      } catch (error) {
        throw new QueryError(
          `Failed to delete records from '${params.resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Chain query API
    from<TTable extends keyof TSchema & string>(
      resource: TTable
    ): ChainQuery<TSchema, TTable> {
      const client = adapter.getClient();
      const table = client.schema[resource];

      if (!table) {
        throw new QueryError(`Table '${resource}' not found in schema`);
      }

      return new ChainQuery(client, table, client.schema, resource);
    },

    // Polymorphic relationship queries
    morphTo<TTable extends keyof TSchema & string>(
      resource: TTable,
      morphConfig: import('../types/client.js').MorphConfig<TSchema>
    ): import('../types/client.js').MorphQuery<TSchema, TTable> {
      const client = adapter.getClient();
      const table = client.schema[resource];

      if (!table) {
        throw new QueryError(`Table '${resource}' not found in schema`);
      }

      return new MorphQueryBuilder(
        client,
        resource,
        morphConfig,
        client.schema
      );
    },

    // Native query builder
    query: {
      select<TTable extends keyof TSchema & string>(
        resource: TTable
      ): import('../types/client.js').SelectChain<TSchema, TTable> {
        const client = adapter.getClient();
        const table = client.schema[resource];

        if (!table) {
          throw new QueryError(`Table '${resource}' not found in schema`);
        }

        return createSelectChain(client, table, client.schema, resource) as any;
      },

      insert<TTable extends keyof TSchema & string>(
        resource: TTable
      ): InsertChain<TSchema, TTable> {
        const client = adapter.getClient();
        const table = client.schema[resource];

        if (!table) {
          throw new QueryError(`Table '${resource}' not found in schema`);
        }

        return createInsertChain(client, table, client.schema, resource);
      },

      update<TTable extends keyof TSchema & string>(
        resource: TTable
      ): UpdateChain<TSchema, TTable> {
        const client = adapter.getClient();
        const table = client.schema[resource];

        if (!table) {
          throw new QueryError(`Table '${resource}' not found in schema`);
        }

        return createUpdateChain(client, table, client.schema, resource);
      },

      delete<TTable extends keyof TSchema & string>(
        resource: TTable
      ): DeleteChain<TSchema, TTable> {
        const client = adapter.getClient();
        const table = client.schema[resource];

        if (!table) {
          throw new QueryError(`Table '${resource}' not found in schema`);
        }

        return createDeleteChain(client, table, client.schema, resource);
      },
    },

    // Relationship queries
    async getWithRelations<TTable extends keyof TSchema & string>(
      resource: TTable,
      id: any,
      relations?: (keyof TSchema & string)[],
      relationshipConfigs?: Record<string, RelationshipConfig<TSchema>>
    ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>> {
      try {
        const client = adapter.getClient();
        const table = client.schema[resource];

        if (!table) {
          throw new QueryError(`Table '${resource}' not found in schema`);
        }

        // First get the base record
        const query = queryBuilder.buildGetOneQuery(client, table, id);
        const result = await (query.execute ? query.execute() : query);

        if (!result || result.length === 0) {
          throw new QueryError(
            `Record with id '${id}' not found in '${resource}'`
          );
        }

        const baseRecord = result[0] as InferSelectModel<TSchema[TTable]>;

        // If no relations specified, return base record
        if (!relations || relations.length === 0) {
          return { data: baseRecord };
        }

        // Load relationships
        const relationshipBuilder = new RelationshipQueryBuilder(
          client,
          client.schema
        );

        // Build relationship configs if not provided
        const configs =
          relationshipConfigs ||
          buildDefaultRelationshipConfigs(resource, relations, client.schema);

        const recordWithRelations =
          await relationshipBuilder.loadRelationshipsForRecord(
            resource,
            baseRecord,
            configs
          );

        return { data: recordWithRelations };
      } catch (error) {
        throw new QueryError(
          `Failed to get record with relations from '${resource}': ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Raw query support
    async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
      console.log(
        'executeRaw called with adapter:',
        typeof adapter,
        Object.getOwnPropertyNames(adapter)
      );
      if (typeof adapter.executeRaw !== 'function') {
        throw new Error(
          `Adapter does not have executeRaw method. Adapter type: ${typeof adapter}, properties: ${Object.getOwnPropertyNames(adapter).join(', ')}`
        );
      }
      return await adapter.executeRaw<T>(sql, params);
    },

    // Transaction support (placeholder for now)
    async transaction<T>(
      _fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
    ): Promise<T> {
      throw new QueryError('Transaction support not implemented yet');
    },

    // Additional DataProvider methods
    getApiUrl: () => '',
    custom: async () => ({ data: {} as any }),
  };
}
