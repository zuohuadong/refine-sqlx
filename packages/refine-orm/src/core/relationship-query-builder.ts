import type { Table, InferSelectModel, SQL, Column } from 'drizzle-orm';
import { eq, inArray, and } from 'drizzle-orm';
import type { DrizzleClient } from '../types/client.js';
import { QueryError } from '../types/errors.js';

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

// TypeScript 5.0 Decorators for relationship queries
function CacheRelationship(ttl: number = 300000) { // 5 minutes default
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: any; timestamp: number }>();
    
    descriptor.value = async function (...args: any[]) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < ttl) {
        return cached.value;
      }
      
      const result = await originalMethod.apply(this, args);
      cache.set(key, { value: result, timestamp: now });
      
      return result;
    };
    return descriptor;
  };
}

function ValidateRelationship(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    // Validate relationship configuration
    const [, , config] = args;
    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid relationship configuration for ${propertyKey}`);
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

function LogRelationshipQuery(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      console.debug(`[RelationshipQuery] ${propertyKey} completed in ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (error) {
      console.error(`[RelationshipQuery] ${propertyKey} failed:`, error);
      throw error;
    }
  };
  return descriptor;
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
  @LogRelationshipQuery
  @CacheRelationship(180000) // Cache for 3 minutes
  @ValidateRelationship
  async loadRelationshipsForRecord<TTable extends keyof TSchema>(
    _tableName: TTable,
    record: InferSelectModel<TSchema[TTable]>,
    relationships: Record<string, RelationshipConfig<TSchema>>
  ): Promise<any> {
    const result: any = { ...record };

    for (const [relationName, config] of Object.entries(relationships)) {
      try {
        const relationData = await this.loadSingleRelationship(
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
   * Load relationships for multiple records (batch loading for performance)
   */
  async loadRelationshipsForRecords<TTable extends keyof TSchema>(
    _tableName: TTable,
    records: InferSelectModel<TSchema[TTable]>[],
    relationships: Record<string, RelationshipConfig<TSchema>>
  ): Promise<any[]> {
    if (records.length === 0) {
      return [];
    }

    const results: any[] = records.map(record => ({ ...record }));

    for (const [relationName, config] of Object.entries(relationships)) {
      try {
        const relationData = await this.loadBatchRelationship(
          records,
          relationName,
          config
        );

        // Map relation data back to records
        for (let i = 0; i < results.length; i++) {
          const recordId = this.getRecordId(results[i]);
          results[i][relationName] =
            relationData[recordId] ||
            (config.type === 'hasMany' || config.type === 'belongsToMany' ?
              []
            : null);
        }
      } catch (error) {
        console.warn(
          `Failed to load batch relationship '${relationName}':`,
          error
        );
        // Set default values for failed relationships
        for (const result of results) {
          (result as any)[relationName] =
            config.type === 'hasMany' || config.type === 'belongsToMany' ?
              []
            : null;
        }
      }
    }

    return results;
  }

  /**
   * Load a single relationship for one record
   */
  private async loadSingleRelationship(
    record: any,
    _relationName: string,
    config: RelationshipConfig<TSchema>
  ): Promise<any> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }

    switch (config.type) {
      case 'hasOne':
        return this.loadHasOneRelation(record, config);

      case 'hasMany':
        return this.loadHasManyRelation(record, config);

      case 'belongsTo':
        return this.loadBelongsToRelation(record, config);

      case 'belongsToMany':
        return this.loadBelongsToManyRelation(record, config);

      default:
        throw new QueryError(`Unsupported relationship type: ${config.type}`);
    }
  }

  /**
   * Load relationships in batch for better performance
   */
  private async loadBatchRelationship(
    records: any[],
    _relationName: string,
    config: RelationshipConfig<TSchema>
  ): Promise<Record<string, any>> {
    const recordIds = records.map(record => this.getRecordId(record));

    switch (config.type) {
      case 'hasOne':
        return this.loadBatchHasOneRelation(recordIds, config);

      case 'hasMany':
        return this.loadBatchHasManyRelation(recordIds, config);

      case 'belongsTo':
        return this.loadBatchBelongsToRelation(records, config);

      case 'belongsToMany':
        return this.loadBatchBelongsToManyRelation(recordIds, config);

      default:
        throw new QueryError(`Unsupported relationship type: ${config.type}`);
    }
  }

  /**
   * Load hasOne relationship
   */
  private async loadHasOneRelation(
    record: any,
    config: RelationshipConfig<TSchema>
  ): Promise<any> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    const localKey = config.localKey || 'id';
    const relatedKey =
      config.relatedKey || `${String(config.relatedTable).slice(0, -1)}_id`;

    let query = this.client.select().from(relatedTable);

    // Add relationship condition
    const localValue = record[localKey];
    if (localValue !== undefined && localValue !== null) {
      const relatedColumn = this.getTableColumn(relatedTable, relatedKey);
      if (relatedColumn) {
        query = query.where(eq(relatedColumn, localValue));
      }
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    const results = await query.limit(1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Load hasMany relationship
   */
  private async loadHasManyRelation(
    record: any,
    config: RelationshipConfig<TSchema>
  ): Promise<any[]> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    const localKey = config.localKey || 'id';
    const relatedKey =
      config.relatedKey || `${String(config.relatedTable).slice(0, -1)}_id`;

    let query = this.client.select().from(relatedTable);

    // Add relationship condition
    const localValue = record[localKey];
    if (localValue !== undefined && localValue !== null) {
      const relatedColumn = this.getTableColumn(relatedTable, relatedKey);
      if (relatedColumn) {
        query = query.where(eq(relatedColumn, localValue));
      }
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    return await query;
  }

  /**
   * Load belongsTo relationship
   */
  private async loadBelongsToRelation(
    record: any,
    config: RelationshipConfig<TSchema>
  ): Promise<any> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    const foreignKey =
      config.foreignKey || `${String(config.relatedTable).slice(0, -1)}_id`;
    const relatedKey = config.relatedKey || 'id';

    let query = this.client.select().from(relatedTable);

    // Add relationship condition
    const foreignValue = record[foreignKey];
    if (foreignValue !== undefined && foreignValue !== null) {
      const relatedColumn = this.getTableColumn(relatedTable, relatedKey);
      if (relatedColumn) {
        query = query.where(eq(relatedColumn, foreignValue));
      }
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    const results = await query.limit(1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Load belongsToMany relationship
   */
  private async loadBelongsToManyRelation(
    record: any,
    config: RelationshipConfig<TSchema>
  ): Promise<any[]> {
    if (!config.pivotTable) {
      throw new QueryError(
        'belongsToMany relationship requires pivotTable configuration'
      );
    }

    const relatedTable = this.schema[config.relatedTable];
    const pivotTable = this.schema[config.pivotTable!];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    if (!pivotTable) {
      throw new QueryError(
        `Pivot table '${String(config.pivotTable)}' not found in schema`
      );
    }
    const localKey = config.localKey || 'id';
    const pivotLocalKey =
      config.pivotLocalKey || `${String(config.relatedTable).slice(0, -1)}_id`;
    const pivotRelatedKey =
      config.pivotRelatedKey ||
      `${String(config.relatedTable).slice(0, -1)}_id`;
    const relatedKey = config.relatedKey || 'id';

    // First, get pivot records
    let pivotQuery = this.client.select().from(pivotTable);
    const localValue = record[localKey];

    if (localValue !== undefined && localValue !== null) {
      const pivotLocalColumn = this.getTableColumn(pivotTable, pivotLocalKey);
      if (pivotLocalColumn) {
        pivotQuery = pivotQuery.where(eq(pivotLocalColumn, localValue));
      }
    }

    const pivotRecords = await pivotQuery;

    if (pivotRecords.length === 0) {
      return [];
    }

    // Get related record IDs from pivot
    const relatedIds = pivotRecords
      .map((pivot: any) => pivot[pivotRelatedKey])
      .filter((id: any) => id != null);

    if (relatedIds.length === 0) {
      return [];
    }

    // Load related records
    let relatedQuery = this.client.select().from(relatedTable);
    const relatedColumn = this.getTableColumn(relatedTable, relatedKey);

    if (relatedColumn) {
      relatedQuery = relatedQuery.where(inArray(relatedColumn, relatedIds));
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      relatedQuery = relatedQuery.where(and(...config.conditions));
    }

    return await relatedQuery;
  }

  /**
   * Batch load hasOne relationships
   */
  private async loadBatchHasOneRelation(
    recordIds: any[],
    config: RelationshipConfig<TSchema>
  ): Promise<Record<string, any>> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    const relatedKey =
      config.relatedKey || `${String(config.relatedTable).slice(0, -1)}_id`;

    let query = this.client.select().from(relatedTable);
    const relatedColumn = this.getTableColumn(relatedTable, relatedKey);

    if (relatedColumn) {
      query = query.where(inArray(relatedColumn, recordIds));
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    const results = await query;
    const resultMap: Record<string, any> = {};

    for (const result of results) {
      const key = result[relatedKey];
      if (key && !resultMap[key]) {
        resultMap[key] = result;
      }
    }

    return resultMap;
  }

  /**
   * Batch load hasMany relationships
   */
  private async loadBatchHasManyRelation(
    recordIds: any[],
    config: RelationshipConfig<TSchema>
  ): Promise<Record<string, any[]>> {
    const relatedTable = this.schema[config.relatedTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    const relatedKey =
      config.relatedKey || `${String(config.relatedTable).slice(0, -1)}_id`;

    let query = this.client.select().from(relatedTable);
    const relatedColumn = this.getTableColumn(relatedTable, relatedKey);

    if (relatedColumn) {
      query = query.where(inArray(relatedColumn, recordIds));
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    const results = await query;
    const resultMap: Record<string, any[]> = {};

    // Initialize arrays for all record IDs
    for (const recordId of recordIds) {
      resultMap[recordId] = [];
    }

    // Group results by foreign key
    for (const result of results) {
      const key = result[relatedKey];
      if (key && resultMap[key]) {
        resultMap[key].push(result);
      }
    }

    return resultMap;
  }

  /**
   * Batch load belongsTo relationships
   */
  private async loadBatchBelongsToRelation(
    records: any[],
    config: RelationshipConfig<TSchema>
  ): Promise<Record<string, any>> {
    const relatedTable = this.schema[config.relatedTable];
    const foreignKey =
      config.foreignKey || `${String(config.relatedTable).slice(0, -1)}_id`;
    const relatedKey = config.relatedKey || 'id';

    // Get unique foreign key values
    const foreignIds = Array.from(
      new Set(
        records.map(record => record[foreignKey]).filter(id => id != null)
      )
    );

    if (foreignIds.length === 0) {
      return {};
    }

    if (!relatedTable) {
      throw new QueryError(`Related table not found in schema`);
    }
    
    let query = this.client.select().from(relatedTable);
    const relatedColumn = this.getTableColumn(relatedTable, relatedKey);

    if (relatedColumn) {
      query = query.where(inArray(relatedColumn, foreignIds));
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      query = query.where(and(...config.conditions));
    }

    const results = await query;
    const resultMap: Record<string, any> = {};

    for (const result of results) {
      const key = result[relatedKey];
      if (key) {
        resultMap[key] = result;
      }
    }

    // Map back to original record IDs
    const recordMap: Record<string, any> = {};
    for (const record of records) {
      const recordId = this.getRecordId(record);
      const foreignId = record[foreignKey];
      if (foreignId && resultMap[foreignId]) {
        recordMap[recordId] = resultMap[foreignId];
      }
    }

    return recordMap;
  }

  /**
   * Batch load belongsToMany relationships
   */
  private async loadBatchBelongsToManyRelation(
    recordIds: any[],
    config: RelationshipConfig<TSchema>
  ): Promise<Record<string, any[]>> {
    if (!config.pivotTable) {
      throw new QueryError(
        'belongsToMany relationship requires pivotTable configuration'
      );
    }

    const relatedTable = this.schema[config.relatedTable];
    const pivotTable = this.schema[config.pivotTable];
    if (!relatedTable) {
      throw new QueryError(
        `Related table '${String(config.relatedTable)}' not found in schema`
      );
    }
    if (!pivotTable) {
      throw new QueryError(
        `Pivot table '${String(config.pivotTable)}' not found in schema`
      );
    }
    const pivotLocalKey =
      config.pivotLocalKey || `${String(config.relatedTable).slice(0, -1)}_id`;
    const pivotRelatedKey =
      config.pivotRelatedKey ||
      `${String(config.relatedTable).slice(0, -1)}_id`;
    const relatedKey = config.relatedKey || 'id';

    // First, get all pivot records for these record IDs
    let pivotQuery = this.client.select().from(pivotTable);
    const pivotLocalColumn = this.getTableColumn(pivotTable, pivotLocalKey);

    if (pivotLocalColumn) {
      pivotQuery = pivotQuery.where(inArray(pivotLocalColumn, recordIds));
    }

    const pivotRecords = await pivotQuery;

    if (pivotRecords.length === 0) {
      const resultMap: Record<string, any[]> = {};
      for (const recordId of recordIds) {
        resultMap[recordId] = [];
      }
      return resultMap;
    }

    // Get unique related IDs
    const relatedIds = Array.from(
      new Set(
        pivotRecords
          .map((pivot: any) => pivot[pivotRelatedKey])
          .filter((id: any) => id != null)
      )
    );

    // Load related records
    let relatedQuery = this.client.select().from(relatedTable);
    const relatedColumn = this.getTableColumn(relatedTable, relatedKey);

    if (relatedColumn) {
      relatedQuery = relatedQuery.where(inArray(relatedColumn, relatedIds));
    }

    // Add custom conditions
    if (config.conditions && config.conditions.length > 0) {
      relatedQuery = relatedQuery.where(and(...config.conditions));
    }

    const relatedRecords = await relatedQuery;

    // Create lookup map for related records
    const relatedMap: Record<string, any> = {};
    for (const related of relatedRecords) {
      const key = related[relatedKey];
      if (key) {
        relatedMap[key] = related;
      }
    }

    // Group by local record ID
    const resultMap: Record<string, any[]> = {};
    for (const recordId of recordIds) {
      resultMap[recordId] = [];
    }

    for (const pivot of pivotRecords) {
      const localId = pivot[pivotLocalKey];
      const relatedId = pivot[pivotRelatedKey];

      if (localId && relatedId && resultMap[localId] && relatedMap[relatedId]) {
        resultMap[localId].push(relatedMap[relatedId]);
      }
    }

    return resultMap;
  }

  /**
   * Get record ID (assumes 'id' field exists)
   */
  private getRecordId(record: any): any {
    return record.id || record.Id || record.ID;
  }

  /**
   * Get column from table by field name
   */
  private getTableColumn(table: Table, fieldName: string): Column | undefined {
    try {
      const tableAny = table as any;

      // Try direct access first
      if (tableAny[fieldName]) {
        return tableAny[fieldName];
      }

      // Try through columns property
      if (tableAny._.columns && tableAny._.columns[fieldName]) {
        return tableAny._.columns[fieldName];
      }

      return undefined;
    } catch (error) {
      console.warn(`Failed to access column '${fieldName}' from table:`, error);
      return undefined;
    }
  }
}
