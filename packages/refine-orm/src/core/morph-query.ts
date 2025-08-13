import type { Table, InferSelectModel } from 'drizzle-orm';
import {
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  inArray,
  sql,
} from 'drizzle-orm';
import type {
  DrizzleClient,
  MorphConfig,
  MorphResult,
  MorphQuery,
  FilterOperator,
} from '../types/client.js';
import { QueryError, ValidationError } from '../types/errors.js';

/**
 * Polymorphic relationship query builder
 * Handles one-to-many and many-to-many polymorphic relationships
 */
export class MorphQueryBuilder<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> implements MorphQuery<TSchema, TTable>
{
  private whereConditions: any[] = [];
  private orderByConditions: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(
    protected client: DrizzleClient<TSchema>,
    protected resource: TTable,
    private morphConfig: MorphConfig<TSchema>,
    protected schema: TSchema
  ) {
    this.validateMorphConfig();
  }

  /**
   * Validate the morph configuration
   */
  private validateMorphConfig(): void {
    const { typeField, idField, relationName, types } = this.morphConfig;

    if (!typeField || !idField || !relationName) {
      throw new ValidationError(
        'MorphConfig must include typeField, idField, and relationName'
      );
    }

    if (!types || Object.keys(types).length === 0) {
      throw new ValidationError(
        'MorphConfig must include at least one type mapping'
      );
    }

    // Validate that all referenced tables exist in schema
    for (const [typeName, tableName] of Object.entries(types)) {
      if (!this.schema[tableName]) {
        throw new ValidationError(
          `Table '${String(tableName)}' referenced in morph type '${typeName}' does not exist in schema`
        );
      }
    }
  }

  /**
   * Add WHERE condition for filtering polymorphic results
   */
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this {
    const table = this.schema[this.resource];
    if (!table) {
      throw new QueryError(`Table '${String(this.resource)}' not found in schema`);
    }
    const tableColumn = this.getTableColumn(table, column as string);

    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table '${String(this.resource)}'`
      );
    }

    const condition = this.buildFieldCondition(tableColumn, operator, value);
    if (condition) {
      this.whereConditions.push(condition);
    }

    return this;
  }

  /**
   * Add WHERE condition for specific morph type
   */
  whereType(typeName: string): this {
    if (!this.morphConfig.types[typeName]) {
      throw new ValidationError(
        `Morph type '${typeName}' is not defined in configuration`
      );
    }

    return this.where(this.morphConfig.typeField as any, 'eq', typeName);
  }

  /**
   * Add WHERE condition for multiple morph types
   */
  whereTypeIn(typeNames: string[]): this {
    const invalidTypes = typeNames.filter(
      type => !this.morphConfig.types[type]
    );
    if (invalidTypes.length > 0) {
      throw new ValidationError(
        `Invalid morph types: ${invalidTypes.join(', ')}`
      );
    }

    return this.where(this.morphConfig.typeField as any, 'in', typeNames);
  }

  /**
   * Add ORDER BY condition
   */
  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    const table = this.schema[this.resource];
    if (!table) {
      throw new QueryError(`Table '${String(this.resource)}' not found in schema`);
    }
    const tableColumn = this.getTableColumn(table, column as string);

    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table '${String(this.resource)}' for ordering`
      );
    }

    // Import asc/desc dynamically to avoid circular imports
    const { asc, desc } = require('drizzle-orm');
    const orderCondition =
      direction === 'desc' ? desc(tableColumn) : asc(tableColumn);
    this.orderByConditions.push(orderCondition);

    return this;
  }

  /**
   * Set LIMIT
   */
  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  /**
   * Set pagination
   */
  paginate(page: number, pageSize: number = 10): this {
    this.limitValue = pageSize;
    this.offsetValue = (page - 1) * pageSize;
    return this;
  }

  /**
   * Execute query and return results with loaded polymorphic relationships
   */
  async get(): Promise<MorphResult<TSchema, TTable>[]> {
    try {
      // Build and execute base query
      const baseResults = await this.executeBaseQuery();

      if (baseResults.length === 0) {
        return [];
      }

      // Load polymorphic relationships
      const resultsWithRelations =
        await this.loadPolymorphicRelations(baseResults);

      return resultsWithRelations;
    } catch (error) {
      throw new QueryError(
        `Failed to execute polymorphic query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the first result with polymorphic relationships
   */
  async first(): Promise<MorphResult<TSchema, TTable> | null> {
    const results = await this.limit(1).get();
    return results.length > 0 ? (results[0] ?? null) : null;
  }

  /**
   * Get count of results
   */
  async count(): Promise<number> {
    try {
      const table = this.schema[this.resource];
      let query = this.client
        .select({ count: sql<number>`count(*)` })
        .from(table);

      if (this.whereConditions.length > 0) {
        query = query.where(and(...this.whereConditions));
      }

      const result = await (query.execute ? query.execute() : query);
      return Number(result[0]?.count) || 0;
    } catch (error) {
      throw new QueryError(
        `Failed to count polymorphic query results: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute the base query without loading relationships
   */
  protected async executeBaseQuery(): Promise<
    InferSelectModel<TSchema[TTable]>[]
  > {
    const table = this.schema[this.resource];
    let query = this.client.select().from(table);

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    // Apply ORDER BY
    if (this.orderByConditions.length > 0) {
      query = query.orderBy(...this.orderByConditions);
    }

    // Apply LIMIT
    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue);
    }

    // Apply OFFSET
    if (this.offsetValue !== undefined) {
      query = query.offset(this.offsetValue);
    }

    return await (query.execute ? query.execute() : query);
  }

  /**
   * Load polymorphic relationships for the given results
   */
  private async loadPolymorphicRelations(
    baseResults: InferSelectModel<TSchema[TTable]>[]
  ): Promise<MorphResult<TSchema, TTable>[]> {
    const { typeField, idField, relationName, types } = this.morphConfig;

    // Group results by morph type
    const resultsByType = this.groupResultsByType(baseResults, typeField);

    // Load related data for each type
    const relationDataByType = await this.loadRelationDataByType(
      resultsByType,
      idField,
      types
    );

    // Merge base results with relation data
    return this.mergeResultsWithRelations(
      baseResults,
      relationDataByType,
      typeField,
      idField,
      relationName
    );
  }

  /**
   * Group base results by morph type
   */
  private groupResultsByType(
    results: InferSelectModel<TSchema[TTable]>[],
    typeField: string
  ): Record<string, InferSelectModel<TSchema[TTable]>[]> {
    const grouped: Record<string, InferSelectModel<TSchema[TTable]>[]> = {};

    for (const result of results) {
      const morphType = (result as any)[typeField];
      if (morphType) {
        if (!grouped[morphType]) {
          grouped[morphType] = [];
        }
        grouped[morphType].push(result);
      }
    }

    return grouped;
  }

  /**
   * Load relation data for each morph type
   */
  private async loadRelationDataByType(
    resultsByType: Record<string, InferSelectModel<TSchema[TTable]>[]>,
    idField: string,
    types: Record<string, keyof TSchema>
  ): Promise<Record<string, Record<string, any>>> {
    const relationDataByType: Record<string, Record<string, any>> = {};

    for (const [morphType, results] of Object.entries(resultsByType)) {
      const tableName = types[morphType];
      if (!tableName) continue;

      const table = this.schema[tableName];
      if (!table) continue;

      // Extract IDs for this morph type
      const ids = results
        .map(result => (result as any)[idField])
        .filter(id => id != null);

      if (ids.length === 0) continue;

      try {
        // Load related records
        const idColumn = this.getIdColumn(table);
        if (!idColumn) {
          console.warn(`No ID column found for table '${String(tableName)}'`);
          continue;
        }

        const relatedQuery = this.client
          .select()
          .from(table)
          .where(inArray(idColumn, ids));
        const relatedRecords = await (relatedQuery.execute ?
          relatedQuery.execute()
        : relatedQuery);

        // Index by ID for quick lookup
        const indexedRecords: Record<string, any> = {};
        for (const record of relatedRecords) {
          const recordId = (record as any)[this.getIdColumnName(table)];
          if (recordId != null) {
            indexedRecords[recordId] = record;
          }
        }

        relationDataByType[morphType] = indexedRecords;
      } catch (error) {
        console.warn(
          `Failed to load relations for morph type '${morphType}':`,
          error
        );
        relationDataByType[morphType] = {};
      }
    }

    return relationDataByType;
  }

  /**
   * Merge base results with loaded relation data
   */
  private mergeResultsWithRelations(
    baseResults: InferSelectModel<TSchema[TTable]>[],
    relationDataByType: Record<string, Record<string, any>>,
    typeField: string,
    idField: string,
    relationName: string
  ): MorphResult<TSchema, TTable>[] {
    return baseResults.map(result => {
      const morphType = (result as any)[typeField];
      const morphId = (result as any)[idField];

      let relationData = null;
      if (morphType && morphId && relationDataByType[morphType]) {
        relationData = relationDataByType[morphType][morphId] || null;
      }

      return { ...result, [relationName]: relationData } as MorphResult<
        TSchema,
        TTable
      >;
    });
  }

  /**
   * Build field condition based on operator
   */
  private buildFieldCondition(
    column: any,
    operator: FilterOperator,
    value: any
  ): any {
    switch (operator) {
      case 'eq':
        return eq(column, value);
      case 'ne':
        return require('drizzle-orm').ne(column, value);
      case 'gt':
        return require('drizzle-orm').gt(column, value);
      case 'gte':
        return require('drizzle-orm').gte(column, value);
      case 'lt':
        return require('drizzle-orm').lt(column, value);
      case 'lte':
        return require('drizzle-orm').lte(column, value);
      case 'like':
        return require('drizzle-orm').like(column, `%${value}%`);
      case 'ilike':
        return require('drizzle-orm').ilike(column, `%${value}%`);
      case 'notLike':
        return and(ne(column, null), like(column, `%${value}%`));
      case 'isNull':
        return require('drizzle-orm').isNull(column);
      case 'isNotNull':
        return require('drizzle-orm').isNotNull(column);
      case 'in':
        return Array.isArray(value) ?
            inArray(column, value)
          : eq(column, value);
      case 'notIn':
        return Array.isArray(value) ?
            require('drizzle-orm').notInArray(column, value)
          : require('drizzle-orm').ne(column, value);
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return and(gte(column, value[0]), lte(column, value[1]));
        }
        throw new ValidationError(
          'Between operator requires array with exactly 2 values'
        );
      case 'notBetween':
        if (Array.isArray(value) && value.length === 2) {
          return or(lt(column, value[0]), gt(column, value[1]));
        }
        throw new ValidationError(
          'Not between operator requires array with exactly 2 values'
        );
      default:
        throw new QueryError(`Unsupported filter operator: ${operator}`);
    }
  }

  /**
   * Get column from table by field name
   */
  protected getTableColumn(table: Table, fieldName: string): any {
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

  /**
   * Get ID column from table (assumes 'id' field or first primary key)
   */
  protected getIdColumn(table: Table): any {
    try {
      const tableAny = table as any;

      // Try to find 'id' column first
      if (tableAny.id) {
        return tableAny.id;
      }

      // Try to find primary key columns
      if (tableAny._.columns) {
        const columns = tableAny._.columns;
        for (const [, column] of Object.entries(columns)) {
          const columnAny = column as any;
          if (columnAny.primary || columnAny.primaryKey) {
            return columnAny;
          }
        }

        // Fallback to first column if no primary key found
        const firstColumn = Object.values(columns)[0];
        if (firstColumn) {
          return firstColumn;
        }
      }

      return undefined;
    } catch (error) {
      console.warn('Failed to find ID column:', error);
      return undefined;
    }
  }

  /**
   * Get ID column name from table
   */
  protected getIdColumnName(table: Table): string {
    try {
      const tableAny = table as any;

      // Try to find 'id' column first
      if (tableAny.id) {
        return 'id';
      }

      // Try to find primary key columns
      if (tableAny._.columns) {
        const columns = tableAny._.columns;
        for (const [name, column] of Object.entries(columns)) {
          const columnAny = column as any;
          if (columnAny.primary || columnAny.primaryKey) {
            return name;
          }
        }

        // Fallback to first column if no primary key found
        const firstColumnName = Object.keys(columns)[0];
        if (firstColumnName) {
          return firstColumnName;
        }
      }

      return 'id'; // Default fallback
    } catch (error) {
      console.warn('Failed to find ID column name:', error);
      return 'id';
    }
  }
}

/**
 * Factory function to create a MorphQuery instance
 */
export function createMorphQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
>(
  client: DrizzleClient<TSchema>,
  resource: TTable,
  morphConfig: MorphConfig<TSchema>,
  schema: TSchema
): MorphQueryBuilder<TSchema, TTable> {
  return new MorphQueryBuilder(client, resource, morphConfig, schema);
}

/**
 * Enhanced MorphConfig with additional options for complex polymorphic relationships
 */
export interface EnhancedMorphConfig<TSchema extends Record<string, Table>>
  extends MorphConfig<TSchema> {
  // Support for many-to-many polymorphic relationships
  pivotTable?: keyof TSchema;
  pivotLocalKey?: string;
  pivotForeignKey?: string;

  // Support for nested polymorphic relationships
  nested?: boolean;
  nestedRelations?: Record<string, MorphConfig<TSchema>>;

  // Caching options
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;

  // Loading strategy
  loadingStrategy?: 'eager' | 'lazy' | 'manual';

  // Custom loading function
  customLoader?: (
    client: DrizzleClient<TSchema>,
    baseResults: any[],
    config: MorphConfig<TSchema>
  ) => Promise<Record<string, any>>;
}

/**
 * Enhanced MorphQuery builder with support for complex polymorphic relationships
 */
export class EnhancedMorphQueryBuilder<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends MorphQueryBuilder<TSchema, TTable> {
  constructor(
    client: DrizzleClient<TSchema>,
    resource: TTable,
    private enhancedConfig: EnhancedMorphConfig<TSchema>,
    schema: TSchema
  ) {
    super(client, resource, enhancedConfig, schema);
  }

  /**
   * Load many-to-many polymorphic relationships
   */
  async getManyToMany(): Promise<MorphResult<TSchema, TTable>[]> {
    if (!this.enhancedConfig.pivotTable) {
      throw new ValidationError(
        'Many-to-many polymorphic relationships require pivotTable configuration'
      );
    }

    try {
      // Get base results first
      const baseResults = await this.executeBaseQuery();

      if (baseResults.length === 0) {
        return [];
      }

      // Load many-to-many relationships through pivot table
      const resultsWithManyToMany =
        await this.loadManyToManyRelations(baseResults);

      return resultsWithManyToMany;
    } catch (error) {
      throw new QueryError(
        `Failed to execute many-to-many polymorphic query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load nested polymorphic relationships
   */
  async getWithNested(): Promise<MorphResult<TSchema, TTable>[]> {
    if (!this.enhancedConfig.nested || !this.enhancedConfig.nestedRelations) {
      return this.get();
    }

    try {
      // Get base results with primary polymorphic relationships
      const baseResults = await this.get();

      if (baseResults.length === 0) {
        return [];
      }

      // Load nested relationships for each polymorphic type
      const resultsWithNested = await this.loadNestedRelations(baseResults);

      return resultsWithNested;
    } catch (error) {
      throw new QueryError(
        `Failed to execute nested polymorphic query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Use custom loader if provided
   */
  async getWithCustomLoader(): Promise<MorphResult<TSchema, TTable>[]> {
    if (!this.enhancedConfig.customLoader) {
      return this.get();
    }

    try {
      // Get base results first
      const baseResults = await this.executeBaseQuery();

      if (baseResults.length === 0) {
        return [];
      }

      // Use custom loader to load relationships
      const relationData = await this.enhancedConfig.customLoader(
        this.client,
        baseResults,
        this.enhancedConfig
      );

      // Merge base results with custom loaded data
      return this.mergeResultsWithCustomData(baseResults, relationData);
    } catch (error) {
      throw new QueryError(
        `Failed to execute custom loader polymorphic query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load many-to-many relationships through pivot table
   */
  private async loadManyToManyRelations(
    baseResults: InferSelectModel<TSchema[TTable]>[]
  ): Promise<MorphResult<TSchema, TTable>[]> {
    const {
      pivotTable,
      pivotLocalKey = 'id',
      typeField,
      idField,
      relationName,
      types,
    } = this.enhancedConfig;

    if (!pivotTable) {
      throw new ValidationError(
        'Pivot table is required for many-to-many relationships'
      );
    }

    const pivot = this.schema[pivotTable];
    if (!pivot) {
      throw new ValidationError(
        `Pivot table '${String(pivotTable)}' not found in schema`
      );
    }

    // Extract base record IDs
    const baseIds = baseResults
      .map(result => (result as any)[pivotLocalKey])
      .filter(id => id != null);

    if (baseIds.length === 0) {
      return baseResults.map(result => ({ ...result, [relationName]: [] }));
    }

    try {
      // Get pivot relationships
      const pivotLocalColumn = this.getTableColumn(pivot, pivotLocalKey);
      if (!pivotLocalColumn) {
        throw new QueryError(
          `Column '${pivotLocalKey}' not found in pivot table`
        );
      }

      const pivotQuery = this.client
        .select()
        .from(pivot)
        .where(inArray(pivotLocalColumn, baseIds));
      const pivotResults = await (pivotQuery.execute ?
        pivotQuery.execute()
      : pivotQuery);

      // Group pivot results by base ID and morph type
      const pivotByBaseId: Record<string, Record<string, any[]>> = {};

      for (const pivotResult of pivotResults) {
        const baseId = (pivotResult as any)[pivotLocalKey];
        const morphType = (pivotResult as any)[typeField];
        const morphId = (pivotResult as any)[idField];

        if (!pivotByBaseId[baseId]) {
          pivotByBaseId[baseId] = {};
        }
        if (!pivotByBaseId[baseId][morphType]) {
          pivotByBaseId[baseId][morphType] = [];
        }

        pivotByBaseId[baseId][morphType].push({ ...pivotResult, morphId });
      }

      // Load related data for each morph type
      const relationDataByType = await this.loadRelationDataForManyToMany(
        pivotByBaseId,
        types
      );

      // Merge results
      return baseResults.map(result => {
        const baseId = (result as any)[pivotLocalKey];
        const relations: any[] = [];

        if (pivotByBaseId[baseId]) {
          for (const [morphType, pivotRecords] of Object.entries(
            pivotByBaseId[baseId]
          )) {
            const relatedData = relationDataByType[morphType] || {};

            for (const pivotRecord of pivotRecords) {
              const relatedRecord = relatedData[pivotRecord.morphId];
              if (relatedRecord) {
                relations.push({ ...relatedRecord, _pivot: pivotRecord });
              }
            }
          }
        }

        return { ...result, [relationName]: relations } as MorphResult<
          TSchema,
          TTable
        >;
      });
    } catch (error) {
      console.warn('Failed to load many-to-many relationships:', error);
      return baseResults.map(result => ({ ...result, [relationName]: [] }));
    }
  }

  /**
   * Load relation data for many-to-many relationships
   */
  private async loadRelationDataForManyToMany(
    pivotByBaseId: Record<string, Record<string, any[]>>,
    types: Record<string, keyof TSchema>
  ): Promise<Record<string, Record<string, any>>> {
    const relationDataByType: Record<string, Record<string, any>> = {};

    // Collect all morph IDs by type
    const morphIdsByType: Record<string, Set<any>> = {};

    for (const pivotsByType of Object.values(pivotByBaseId)) {
      for (const [morphType, pivotRecords] of Object.entries(pivotsByType)) {
        if (!morphIdsByType[morphType]) {
          morphIdsByType[morphType] = new Set();
        }

        for (const pivotRecord of pivotRecords) {
          morphIdsByType[morphType].add(pivotRecord.morphId);
        }
      }
    }

    // Load data for each morph type
    for (const [morphType, morphIds] of Object.entries(morphIdsByType)) {
      const tableName = types[morphType];
      if (!tableName) continue;

      const table = this.schema[tableName];
      if (!table) continue;

      const idsArray = Array.from(morphIds).filter(id => id != null);
      if (idsArray.length === 0) continue;

      try {
        const idColumn = this.getIdColumn(table);
        if (!idColumn) continue;

        const relatedQuery = this.client
          .select()
          .from(table)
          .where(inArray(idColumn, idsArray));
        const relatedRecords = await (relatedQuery.execute ?
          relatedQuery.execute()
        : relatedQuery);

        // Index by ID
        const indexedRecords: Record<string, any> = {};
        for (const record of relatedRecords) {
          const recordId = (record as any)[this.getIdColumnName(table)];
          if (recordId != null) {
            indexedRecords[recordId] = record;
          }
        }

        relationDataByType[morphType] = indexedRecords;
      } catch (error) {
        console.warn(
          `Failed to load many-to-many relations for morph type '${morphType}':`,
          error
        );
        relationDataByType[morphType] = {};
      }
    }

    return relationDataByType;
  }

  /**
   * Load nested polymorphic relationships
   */
  private async loadNestedRelations(
    baseResults: MorphResult<TSchema, TTable>[]
  ): Promise<MorphResult<TSchema, TTable>[]> {
    const { nestedRelations, relationName } = this.enhancedConfig;

    if (!nestedRelations) {
      return baseResults;
    }

    try {
      // Process each nested relation configuration
      for (const [nestedRelationName, nestedConfig] of Object.entries(
        nestedRelations
      )) {
        // Load nested relationships for each base result
        for (const baseResult of baseResults) {
          const primaryRelation = (baseResult as any)[relationName];

          if (primaryRelation && typeof primaryRelation === 'object') {
            // Create nested morph query
            const nestedMorphQuery = new MorphQueryBuilder(
              this.client,
              nestedConfig.types[Object.keys(nestedConfig.types)[0]!] as TTable, // Use first type as base
              nestedConfig,
              this.schema
            );

            // Load nested relationships
            const nestedResults = await nestedMorphQuery.get();

            // Attach nested results to primary relation
            (primaryRelation as any)[nestedRelationName] = nestedResults;
          }
        }
      }

      return baseResults;
    } catch (error) {
      console.warn('Failed to load nested relationships:', error);
      return baseResults;
    }
  }

  /**
   * Merge base results with custom loaded data
   */
  private mergeResultsWithCustomData(
    baseResults: InferSelectModel<TSchema[TTable]>[],
    relationData: Record<string, any>
  ): MorphResult<TSchema, TTable>[] {
    const { relationName } = this.enhancedConfig;

    return baseResults.map((result, index) => {
      const customData =
        relationData[index] || relationData[String(index)] || null;

      return { ...result, [relationName]: customData } as MorphResult<
        TSchema,
        TTable
      >;
    });
  }
}
