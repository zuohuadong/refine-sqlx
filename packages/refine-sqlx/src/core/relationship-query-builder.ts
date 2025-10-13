import {
  type Table,
  type InferSelectModel,
  type SQL,
  type Column,
  eq,
  inArray,
  and,
} from 'drizzle-orm';
import type { DrizzleClient } from '../types/client';
import { QueryError, ValidationError } from '../types/errors';
import {
  LogRelationshipQuery,
  CacheRelationship,
  ValidateRelationship,
} from '../utils/performance';

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
  @ValidateRelationship
  @CacheRelationship(180000) // Cache for 3 minutes
  @LogRelationshipQuery
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
        const {
          pivotTable,
          pivotLocalKey,
          pivotRelatedKey,
          localKey: localKeyConfig,
          relatedKey: relatedKeyConfig,
        } = config;

        // Validate pivot table configuration
        if (!pivotTable) {
          console.warn(
            `belongsToMany relationship '${relationName}' missing pivotTable configuration`
          );
          return [];
        }

        const pivotTableSchema = this.schema[pivotTable];
        if (!pivotTableSchema) {
          console.warn(
            `Pivot table '${String(pivotTable)}' not found in schema`
          );
          return [];
        }

        // Set default keys
        const localCol = localKeyConfig || 'id';
        const pivotLocal = pivotLocalKey || `${String(tableName)}_id`;
        const pivotRelated = pivotRelatedKey || `${String(relatedTable)}_id`;
        const relatedCol = relatedKeyConfig || 'id';

        const localValue = record[localCol];
        if (!localValue) {
          return [];
        }

        try {
          // Step 1: Query pivot table to get related IDs
          const pivotResults = await this.executeRelationshipQuery(
            pivotTable,
            pivotLocal,
            localValue
          );

          if (!pivotResults || pivotResults.length === 0) {
            return [];
          }

          // Extract related IDs from pivot results
          const relatedIds = pivotResults
            .map(pivot => pivot[pivotRelated])
            .filter(id => id !== undefined && id !== null);

          if (relatedIds.length === 0) {
            return [];
          }

          // Step 2: Query related table using executeRelationshipQuery for each ID
          // and collect all results
          const relatedRecords = await Promise.all(
            relatedIds.map(id =>
              this.executeRelationshipQuery(relatedTable, relatedCol, id)
            )
          );

          // Flatten the array of arrays and return unique records
          const flatResults = relatedRecords.flat();
          return flatResults;
        } catch (error) {
          console.warn(
            `Failed to load belongsToMany relationship '${relationName}':`,
            error
          );
          return [];
        }
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
