import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
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

import type { RefineOrmDataProvider } from '../types/client';
import type { RefineOrmOptions } from '../types/config';
import { BaseDatabaseAdapter } from '../adapters/base';
import { RefineQueryBuilder } from './query-builder';
import { ChainQuery } from './chain-query-builder';
import { MorphQueryBuilder } from './morph-query';
import {
  RelationshipQueryBuilder,
  type RelationshipConfig,
} from './relationship-query-builder';
import { createPerformanceMonitor } from './performance-monitor';
import {
  SelectChain,
  InsertChain,
  UpdateChain,
  DeleteChain,
  createSelectChain,
  createInsertChain,
  createUpdateChain,
  createDeleteChain,
} from './native-query-builders';
import {
  QueryError,
  ValidationError,
  ConfigurationError,
} from '../types/errors';

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
      // Check if it's a singular relation name that maps to a plural table
      const pluralTableName = `${relationStr}s` as keyof TSchema;
      if (schema[pluralTableName]) {
        // belongsTo relationship - singular relation name, plural table
        configs[relationStr] = {
          type: 'belongsTo',
          relatedTable: pluralTableName,
          foreignKey: `${relationStr}_id`,
          relatedKey: 'id',
        };
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
        // Normalize pagination parameters gracefully
        let normalizedParams = { ...params };
        if (params.pagination) {
          const { currentPage, pageSize } = params.pagination;
          const current = currentPage;

          // Only throw ValidationError for truly invalid page size (0 or negative)
          if (pageSize !== undefined && pageSize < 1) {
            throw new ValidationError('Page size must be greater than 0');
          }

          // For invalid page numbers, normalize to page 1 instead of throwing error
          if (current !== undefined && current < 1) {
            normalizedParams = {
              ...params,
              pagination: { ...params.pagination, currentPage: 1 },
            };
          }
        }

        const client = adapter.getClient();
        const table = client.schema[params.resource];

        if (!table) {
          throw new ValidationError(
            `Table '${params.resource}' not found in schema`
          );
        }

        // Validate field names early - before query building
        if (
          normalizedParams.sorters &&
          Array.isArray(normalizedParams.sorters)
        ) {
          for (const sort of normalizedParams.sorters) {
            if (sort && sort.field) {
              const column = queryBuilder.getTableColumn(table, sort.field);
              if (!column) {
                throw new ValidationError(
                  `Invalid sort field: column '${sort.field}' not found in table '${normalizedParams.resource}'`
                );
              }
            }
          }
        }

        if (
          normalizedParams.filters &&
          Array.isArray(normalizedParams.filters)
        ) {
          // Check for circular references in filters
          const visited = new WeakSet();
          const checkCircularReference = (obj: any): void => {
            if (obj !== null && typeof obj === 'object') {
              if (visited.has(obj)) {
                throw new ValidationError(
                  'Circular reference detected in filters'
                );
              }
              visited.add(obj);

              if (Array.isArray(obj)) {
                obj.forEach(checkCircularReference);
              } else {
                Object.values(obj).forEach(checkCircularReference);
              }
            }
          };

          try {
            checkCircularReference(normalizedParams.filters);
          } catch (error) {
            if (error instanceof ValidationError) {
              throw error;
            }
            // If checking for circular references fails for other reasons, also treat as validation error
            throw new ValidationError('Invalid filter structure detected');
          }

          const validateFilterField = (filter: any) => {
            if (
              filter &&
              typeof filter === 'object' &&
              'field' in filter &&
              filter.field &&
              typeof filter.field === 'string'
            ) {
              const column = queryBuilder.getTableColumn(table, filter.field);
              if (!column) {
                throw new ValidationError(
                  `Invalid filter field: column '${filter.field}' not found in table '${normalizedParams.resource}'`
                );
              }
            } else if (
              filter &&
              typeof filter === 'object' &&
              'value' in filter &&
              Array.isArray(filter.value)
            ) {
              // Recursively validate nested logical filters
              for (const subFilter of filter.value) {
                validateFilterField(subFilter);
              }
            }
          };

          for (const filter of normalizedParams.filters) {
            validateFilterField(filter);
          }
        }

        // Validate sorting parameters
        if (
          normalizedParams.sorters &&
          Array.isArray(normalizedParams.sorters)
        ) {
          for (const sort of normalizedParams.sorters) {
            if (!sort || typeof sort !== 'object' || !sort.field) {
              throw new ValidationError(
                'Invalid sort configuration: missing field'
              );
            }
            if (
              !sort.order ||
              (sort.order !== 'asc' && sort.order !== 'desc')
            ) {
              throw new ValidationError(
                'Invalid sort order: must be "asc" or "desc"'
              );
            }
          }
        }

        // Legacy sorting validation (using sorters instead of deprecated sorting)
        if (
          normalizedParams.sorters &&
          Array.isArray(normalizedParams.sorters)
        ) {
          // Additional validation for edge cases
          for (const sort of normalizedParams.sorters) {
            if (!sort || typeof sort !== 'object' || !sort.field) {
              throw new ValidationError(
                'Invalid sort configuration: missing field'
              );
            }
          }
        }

        // Handle raw query meta option
        if (normalizedParams.meta?.rawQuery) {
          const rawResults = await adapter.executeRaw<
            InferSelectModel<TSchema[TTable]>
          >(`SELECT * FROM ${normalizedParams.resource}`, []);
          return { data: rawResults, total: rawResults.length };
        }

        // Check for empty array filters that should return no results
        if (
          normalizedParams.filters &&
          Array.isArray(normalizedParams.filters)
        ) {
          // First, check for circular references in all filters before processing
          const checkCircularReference = (
            obj: any,
            visited = new WeakSet()
          ): boolean => {
            if (obj === null || typeof obj !== 'object') {
              return false;
            }

            if (visited.has(obj)) {
              return true; // Circular reference found
            }

            visited.add(obj);

            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                if (checkCircularReference(obj[key], visited)) {
                  return true;
                }
              }
            }

            visited.delete(obj);
            return false;
          };

          for (const filter of normalizedParams.filters) {
            if (filter && typeof filter === 'object') {
              if (checkCircularReference(filter)) {
                throw new ValidationError(
                  'Circular references detected in filter configuration'
                );
              }
            }
          }

          // Check for empty arrays in 'in' operator
          const hasEmptyArrayFilter = normalizedParams.filters.some(
            filter =>
              filter &&
              typeof filter === 'object' &&
              'operator' in filter &&
              filter.operator === 'in' &&
              Array.isArray(filter.value) &&
              filter.value.length === 0
          );

          if (hasEmptyArrayFilter) {
            return { data: [], total: 0 };
          }

          // Validate filter values for complex types
          for (const filter of normalizedParams.filters) {
            // Basic filter structure validation
            if (filter === null || filter === undefined) {
              throw new ValidationError('Filter cannot be null or undefined');
            }

            if (typeof filter !== 'object') {
              throw new ValidationError('Filter must be an object');
            }

            // Check for required filter properties - logical operators don't need 'field'
            if (!('operator' in filter) || !('value' in filter)) {
              throw new ValidationError(
                'Filter must have operator and value properties'
              );
            }

            // Regular filters need 'field', logical operators don't
            if (
              filter.operator !== 'or' &&
              filter.operator !== 'and' &&
              !('field' in filter)
            ) {
              throw new ValidationError(
                'Regular filters must have field property'
              );
            }

            if (filter && typeof filter === 'object' && 'value' in filter) {
              // Check for nested arrays
              if (Array.isArray(filter.value)) {
                const hasNestedArray = filter.value.some(item =>
                  Array.isArray(item)
                );
                if (hasNestedArray) {
                  throw new ValidationError(
                    'Nested arrays are not supported in filter values'
                  );
                }
              }

              // Validate between operator
              if ('operator' in filter && filter.operator === 'between') {
                if (!Array.isArray(filter.value)) {
                  throw new ValidationError(
                    'Between operator requires array value'
                  );
                }
                if (filter.value.length !== 2) {
                  throw new ValidationError(
                    'Between operator requires exactly 2 values'
                  );
                }
                if (filter.value[0] > filter.value[1]) {
                  throw new ValidationError(
                    'Between operator requires values in ascending order'
                  );
                }
              }

              // Check for circular references (more thorough check)
              if (filter.value && typeof filter.value === 'object') {
                try {
                  JSON.stringify(filter.value);
                } catch (error) {
                  throw new ValidationError(
                    'Circular references detected in filter value'
                  );
                }
              }
            }

            // Also check the filter itself for circular references
            if (filter && typeof filter === 'object') {
              try {
                JSON.stringify(filter);
              } catch (error) {
                throw new ValidationError(
                  'Circular references detected in filter configuration'
                );
              }
            }
          }
        }

        // Build the query using query builder
        const query = queryBuilder.buildListQuery(
          client,
          table,
          normalizedParams
        );
        const countQuery = queryBuilder.buildCountQuery(
          client,
          table,
          normalizedParams.filters
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
        // Re-throw ValidationError directly without wrapping
        if (error instanceof ValidationError) {
          throw error;
        }
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
          throw new ValidationError(
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
          throw new ValidationError(
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
          params.variables,
          adapter.getDatabaseType()
        );

        let result;
        if (adapter.getDatabaseType() === 'mysql') {
          // MySQL doesn't support RETURNING, so we need to handle it differently
          const insertResult = await query.execute();
          if (!insertResult || !insertResult.insertId) {
            throw new QueryError(
              `Failed to create record in '${params.resource}' - no insertId returned`
            );
          }

          // Fetch the inserted record by ID
          const idColumn = queryBuilder.validateAndGetIdColumn(table);
          result = await client
            .select()
            .from(table)
            .where(eq(idColumn, insertResult.insertId))
            .execute();
        } else {
          result = await (query.execute ? query.execute() : query);
        }

        if (!result || result.length === 0) {
          throw new QueryError(
            `Failed to create record in '${params.resource}'`
          );
        }

        return { data: result[0] as InferSelectModel<TSchema[TTable]> };
      } catch (error) {
        // Re-throw ValidationError directly without wrapping
        if (error instanceof ValidationError) {
          throw error;
        }
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
          throw new ValidationError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildUpdateQuery(
          client,
          table,
          params.id,
          params.variables,
          adapter.getDatabaseType()
        );

        let result;
        if (adapter.getDatabaseType() === 'mysql') {
          // MySQL doesn't support RETURNING, so we need to handle it differently
          const updateResult = await query.execute();
          if (!updateResult || updateResult.affectedRows === 0) {
            throw new QueryError(
              `Record with id '${params.id}' not found in '${params.resource}'`
            );
          }

          // Fetch the updated record by ID
          const idColumn = queryBuilder.validateAndGetIdColumn(table);
          result = await client
            .select()
            .from(table)
            .where(eq(idColumn, params.id))
            .execute();
        } else {
          result = await (query.execute ? query.execute() : query);
        }

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
          throw new ValidationError(
            `Table '${params.resource}' not found in schema`
          );
        }

        const query = queryBuilder.buildDeleteQuery(
          client,
          table,
          params.id,
          adapter.getDatabaseType()
        );

        let result;
        if (adapter.getDatabaseType() === 'mysql') {
          // MySQL doesn't support RETURNING, so we need to fetch the record first
          const idColumn = queryBuilder.validateAndGetIdColumn(table);
          result = await client
            .select()
            .from(table)
            .where(eq(idColumn, params.id))
            .execute();

          if (!result || result.length === 0) {
            throw new QueryError(
              `Record with id '${params.id}' not found in '${params.resource}'`
            );
          }

          // Now delete the record
          const deleteResult = await query.execute();
          if (!deleteResult || deleteResult.affectedRows === 0) {
            throw new QueryError(
              `Failed to delete record with id '${params.id}' in '${params.resource}'`
            );
          }
        } else {
          result = await (query.execute ? query.execute() : query);
        }

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
          throw new ValidationError(
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
              batch,
              adapter.getDatabaseType()
            );

            if (adapter.getDatabaseType() === 'mysql') {
              // MySQL doesn't support RETURNING, handle it differently
              const insertResult = await query.execute();
              if (!insertResult || !insertResult.insertId) {
                throw new QueryError(
                  `Failed to create batch records in '${params.resource}' - no insertId returned`
                );
              }

              // For MySQL, we need to fetch the inserted records
              const idColumn = queryBuilder.validateAndGetIdColumn(table);
              const startId = insertResult.insertId;
              const endId = startId + batch.length - 1;

              const batchResult = await client
                .select()
                .from(table)
                .where(and(gte(idColumn, startId), lte(idColumn, endId)))
                .execute();

              results.push(
                ...(batchResult as InferSelectModel<TSchema[TTable]>[])
              );
            } else {
              const batchResult = await (query.execute ?
                query.execute()
              : query);
              results.push(
                ...(batchResult as InferSelectModel<TSchema[TTable]>[])
              );
            }
          }
        } else {
          const query = queryBuilder.buildCreateManyQuery(
            client,
            table,
            params.variables,
            adapter.getDatabaseType()
          );

          if (adapter.getDatabaseType() === 'mysql') {
            // MySQL doesn't support RETURNING, handle it differently
            const insertResult = await query.execute();
            if (!insertResult || !insertResult.insertId) {
              throw new QueryError(
                `Failed to create records in '${params.resource}' - no insertId returned`
              );
            }

            // For MySQL, we need to fetch the inserted records
            const idColumn = queryBuilder.validateAndGetIdColumn(table);
            const startId = insertResult.insertId;
            const endId = startId + params.variables.length - 1;

            const queryResult = await client
              .select()
              .from(table)
              .where(and(gte(idColumn, startId), lte(idColumn, endId)))
              .execute();

            results.push(
              ...(queryResult as InferSelectModel<TSchema[TTable]>[])
            );
          } else {
            const queryResult = await (query.execute ? query.execute() : query);
            results.push(
              ...(queryResult as InferSelectModel<TSchema[TTable]>[])
            );
          }
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
          throw new ValidationError(
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
          throw new ValidationError(
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
        throw new ConfigurationError(
          `Adapter does not have executeRaw method. Adapter type: ${typeof adapter}, properties: ${Object.getOwnPropertyNames(adapter).join(', ')}`
        );
      }
      return await adapter.executeRaw<T>(sql, params);
    },

    // Transaction support
    async transaction<T>(
      fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
    ): Promise<T> {
      try {
        // Begin transaction
        await adapter.beginTransaction();

        // Create a transaction-aware data provider
        const txDataProvider = createProvider(adapter, options);

        try {
          // Execute the transaction function
          const result = await fn(txDataProvider);

          // Commit the transaction
          await adapter.commitTransaction();

          return result;
        } catch (error) {
          // Rollback the transaction on error
          await adapter.rollbackTransaction();
          throw error;
        }
      } catch (error) {
        throw new QueryError(
          `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          [],
          error instanceof Error ? error : undefined
        );
      }
    },

    // Additional DataProvider methods
    getApiUrl: () => '',
    custom: async () => ({ data: {} as any }),
  };
}
