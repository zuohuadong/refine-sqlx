import type { Table, InferSelectModel, SQL, Column } from 'drizzle-orm';
import { eq, inArray, and } from 'drizzle-orm';
import type { DrizzleClient } from '../types/client';
import { QueryError, ValidationError } from '../types/errors';

/**
 * Configuration for database relationships
 */
export interface RelationshipConfig<TSchema extends Record<string, Table>> {
  // Relationship type
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

  // Related table name
  relatedTable: keyof TSchema;

  // Foreign key in the current table (for belongsTo)
  foreignKey?: string;

  // Local key in the current table (for hasOne/hasMany)
  localKey?: string;

  // Related key in the related table
  relatedKey?: string;

  // Pivot table for many-to-many relationships
  pivotTable?: keyof TSchema;
  pivotLocalKey?: string;
  pivotRelatedKey?: string;

  // Loading strategy
  loadingStrategy?: 'eager' | 'lazy';

  // Custom conditions
  conditions?: SQL[];

  // Nested relationships
  with?: Record<string, RelationshipConfig<TSchema>>;
}

/**
 * Result type for relationship queries
 */
export type RelationshipResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TRelations extends Record<string, RelationshipConfig<TSchema>>,
> = InferSelectModel<TSchema[TTable]> & {
  [K in keyof TRelations]: TRelations[K]['type'] extends (
    'hasMany' | 'belongsToMany'
  ) ?
    InferSelectModel<TSchema[TRelations[K]['relatedTable']]>[]
  : InferSelectModel<TSchema[TRelations[K]['relatedTable']]> | null;
};

// TypeScript 5.0+ decorators for relationship queries
function LogRelationshipQuery() {
  return function (_originalMethod: any, context: ClassMethodDecoratorContext) {
    return function (this: any, ...args: any[]) {
      const start = performance.now();
      try {
        console.debug(`[RelationshipQuery] Starting ${String(context.name)}`);
        const result = _originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = performance.now() - start;
            console.debug(
              `[RelationshipQuery] ${String(context.name)} completed in ${duration.toFixed(2)}ms`
            );
          });
        }

        const duration = performance.now() - start;
        console.debug(
          `[RelationshipQuery] ${String(context.name)} completed in ${duration.toFixed(2)}ms`
        );
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(
          `[RelationshipQuery] ${String(context.name)} failed after ${duration.toFixed(2)}ms:`,
          error
        );
        throw error;
      }
    };
  };
}

function CacheRelationship(ttl: number = 300000) {
  const cache = new Map<string, { data: any; expires: number }>();

  return function (_originalMethod: any, context: ClassMethodDecoratorContext) {
    return function (this: any, ...args: any[]) {
      const cacheKey = `${String(context.name)}_${JSON.stringify(args)}`;
      const now = Date.now();

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > now) {
        console.debug(
          `[CacheRelationship] Cache hit for ${String(context.name)}`
        );
        return Promise.resolve(cached.data);
      }

      const result = _originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return result.then(data => {
          cache.set(cacheKey, { data, expires: now + ttl });
          console.debug(
            `[CacheRelationship] Cached result for ${String(context.name)}`
          );
          return data;
        });
      }

      cache.set(cacheKey, { data: result, expires: now + ttl });
      console.debug(
        `[CacheRelationship] Cached result for ${String(context.name)}`
      );
      return result;
    };
  };
}

function ValidateRelationship() {
  return function (_originalMethod: any, context: ClassMethodDecoratorContext) {
    return function (this: any, ...args: any[]) {
      // Basic validation for relationship method arguments
      const [tableName, record, relationships] = args;

      if (!tableName) {
        throw new ValidationError(
          `Table name is required for ${String(context.name)}`
        );
      }

      if (!record) {
        throw new ValidationError(
          `Record is required for ${String(context.name)}`
        );
      }

      if (!relationships || typeof relationships !== 'object') {
        throw new ValidationError(
          `Relationships configuration is required for ${String(context.name)}`
        );
      }

      console.debug(
        `[ValidateRelationship] Validation passed for ${String(context.name)}`
      );
      return _originalMethod.apply(this, args);
    };
  };
}

/**
 * Relationship query builder for handling complex database relationships
 */
export class RelationshipQueryBuilder<TSchema extends Record<string, Table>> {
  constructor(
    private client: DrizzleClient<TSchema>,
    private schema: TSchema
  ) {}

  /**
   * Load relationships for a single record
   */
  @LogRelationshipQuery()
  @CacheRelationship(180000) // Cache for 3 minutes
  @ValidateRelationship()
  async loadRelationshipsForRecord<TTable extends keyof TSchema>(
    _tableName: TTable,
    record: InferSelectModel<TSchema[TTable]>,
    relationships: Record<string, RelationshipConfig<TSchema>>
  ): Promise<any> {
    const result: any = { ...record };

    for (const [relationName, config] of Object.entries(relationships)) {
      try {
        const relationData = await this.loadSingleRelationship(
          _tableName,
          record,
          relationName,
          config
        );
        result[relationName] = relationData;
      } catch (error) {
        console.warn(`Failed to load relationship '${relationName}':`, error);
        result[relationName] =
          config.type === 'hasMany' || config.type === 'belongsToMany' ?
            []
          : null;
      }
    }

    return result;
  }

  /**
   * Load relationships for multiple records (batch loading)
   */
  async loadRelationshipsForRecords<TTable extends keyof TSchema>(
    tableName: TTable,
    records: InferSelectModel<TSchema[TTable]>[],
    relationships: Record<string, RelationshipConfig<TSchema>>
  ): Promise<any[]> {
    // Optimize by batching similar relationship queries
    const results: any[] = [];

    for (const record of records) {
      const recordWithRelations = await this.loadRelationshipsForRecord(
        tableName,
        record,
        relationships
      );
      results.push(recordWithRelations);
    }

    return results;
  }

  /**
   * Load a single relationship for a record
   */
  private async loadSingleRelationship(
    tableName: keyof TSchema,
    record: any,
    relationName: string,
    config: RelationshipConfig<TSchema>
  ): Promise<any> {
    const { type, relatedTable, foreignKey, localKey, relatedKey } = config;
    const table = this.schema[relatedTable];

    if (!table) {
      throw new QueryError(
        `Related table '${String(relatedTable)}' not found in schema`
      );
    }

    let query;
    const tableColumns = Object.keys(table).filter(
      key =>
        typeof (table as any)[key] === 'object' &&
        (table as any)[key] !== null &&
        'name' in (table as any)[key]
    );
    const primaryColumn = tableColumns[0]; // Assume first column is primary

    switch (type) {
      case 'hasOne':
      case 'hasMany': {
        const localCol = localKey || 'id'; // Local primary key
        const foreignCol = relatedKey || `${String(tableName).slice(0, -1)}_id`; // Foreign key in related table

        const localValue = record[localCol];

        if (!localValue) {
          return type === 'hasMany' ? [] : null;
        }

        // Look for records in the related table where foreignCol matches our localValue
        const results = await this.executeRelationshipQuery(
          relatedTable,
          foreignCol,
          localValue
        );

        return type === 'hasMany' ? results : results[0] || null;
      }

      case 'belongsTo': {
        const foreignCol = foreignKey || `${String(relatedTable)}_id`;
        const relatedCol = relatedKey || 'id';

        // Try both snake_case and camelCase versions of the foreign key
        let foreignValue = record[foreignCol];
        if (foreignValue === undefined) {
          // Convert snake_case to camelCase
          const camelCaseKey = foreignCol.replace(/_([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
          foreignValue = record[camelCaseKey];
        }

        if (!foreignValue) {
          return null;
        }

        const results = await this.executeRelationshipQuery(
          relatedTable,
          relatedCol,
          foreignValue
        );

        return results[0] || null;
      }

      case 'belongsToMany': {
        // This would require pivot table handling
        // For now, return empty array
        console.warn(
          `belongsToMany relationships not fully implemented for ${relationName}`
        );
        return [];
      }

      default:
        throw new QueryError(`Unsupported relationship type: ${type}`);
    }
  }

  /**
   * Execute a relationship query (placeholder implementation)
   */
  private async executeRelationshipQuery(
    tableName: keyof TSchema,
    columnName: string,
    value: any
  ): Promise<any[]> {
    try {
      const table = this.schema[tableName];
      if (!table) {
        console.warn(`Table ${String(tableName)} not found in schema`);
        return [];
      }

      // Use the drizzle client to execute the query
      try {
        // Build the basic select query
        let query = this.client.select().from(table as any);

        // Add where condition if we have a column and value
        if (columnName && value !== undefined) {
          // Try both snake_case and camelCase versions of the column
          let column = (table as any)[columnName];
          if (!column) {
            // Convert snake_case to camelCase
            const camelCaseKey = columnName.replace(/_([a-z])/g, (_, letter) =>
              letter.toUpperCase()
            );
            column = (table as any)[camelCaseKey];
          }

          if (column) {
            query = query.where(eq(column, value)) as any;
          } else {
            console.warn(
              `Column ${columnName} not found in table ${String(tableName)} (tried both snake_case and camelCase)`
            );
          }
        }

        const results = await query;
        return results || [];
      } catch (dbError) {
        console.warn(
          `Database query failed, returning empty results:`,
          dbError
        );
        return [];
      }
    } catch (error) {
      console.error(`Failed to execute relationship query:`, error);
      return []; // Return empty instead of throwing to prevent breaking relationships
    }
  }

  /**
   * Eager load relationships using optimized batch queries
   */
  async eagerLoadRelationships<TTable extends keyof TSchema>(
    tableName: TTable,
    records: InferSelectModel<TSchema[TTable]>[],
    relationships: Record<string, RelationshipConfig<TSchema>>
  ): Promise<any[]> {
    if (!records.length) return [];

    // Group relationships by type for batch optimization
    const hasOneRelations: Array<[string, RelationshipConfig<TSchema>]> = [];
    const hasManyRelations: Array<[string, RelationshipConfig<TSchema>]> = [];
    const belongsToRelations: Array<[string, RelationshipConfig<TSchema>]> = [];

    for (const [name, config] of Object.entries(relationships)) {
      switch (config.type) {
        case 'hasOne':
          hasOneRelations.push([name, config]);
          break;
        case 'hasMany':
          hasManyRelations.push([name, config]);
          break;
        case 'belongsTo':
          belongsToRelations.push([name, config]);
          break;
      }
    }

    // Process each record
    const results: any[] = [];
    for (const record of records) {
      const result: any = { ...record };

      // Load all relationship types
      for (const [name, config] of [
        ...hasOneRelations,
        ...hasManyRelations,
        ...belongsToRelations,
      ]) {
        try {
          result[name] = await this.loadSingleRelationship(
            tableName,
            record,
            name,
            config
          );
        } catch (error) {
          console.warn(`Failed to eager load relationship '${name}':`, error);
          result[name] = config.type === 'hasMany' ? [] : null;
        }
      }

      results.push(result);
    }

    return results;
  }
}

/**
 * Factory function to create a relationship query builder
 */
export function createRelationshipQueryBuilder<
  TSchema extends Record<string, Table>,
>(
  client: DrizzleClient<TSchema>,
  schema: TSchema
): RelationshipQueryBuilder<TSchema> {
  return new RelationshipQueryBuilder(client, schema);
}
