import type {
  BaseSchema,
  UnifiedMorphConfig,
  UnifiedMorphQuery,
  UnifiedFilterOperator,
  InferRecord,
} from './enhanced-types.js';

/**
 * Abstract base class for unified polymorphic queries
 * Can be extended by both SQL and ORM implementations
 */
export abstract class BaseUnifiedMorphQuery<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> implements UnifiedMorphQuery<TSchema, TTable>
{
  protected filters: Array<{
    column: string;
    operator: UnifiedFilterOperator;
    value: any;
  }> = [];

  protected typeFilters: string[] = [];
  protected orderByClause: Array<{
    column: string;
    direction: 'asc' | 'desc';
  }> = [];
  protected limitValue?: number;
  protected offsetValue?: number;

  constructor(
    protected resource: TTable,
    protected morphConfig: UnifiedMorphConfig<TSchema>
  ) {}

  /**
   * Add a WHERE condition to the query
   */
  where<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    operator: UnifiedFilterOperator,
    value: any
  ): this {
    this.filters.push({ column: column as string, operator, value });
    return this;
  }

  /**
   * Filter by polymorphic type
   */
  whereType(typeName: string): this {
    if (!this.morphConfig.types[typeName]) {
      throw new Error(`Unknown polymorphic type: ${typeName}`);
    }
    this.typeFilters = [typeName];
    return this;
  }

  /**
   * Filter by multiple polymorphic types
   */
  whereTypeIn(typeNames: string[]): this {
    const invalidTypes = typeNames.filter(
      type => !this.morphConfig.types[type]
    );
    if (invalidTypes.length > 0) {
      throw new Error(`Unknown polymorphic types: ${invalidTypes.join(', ')}`);
    }
    this.typeFilters = typeNames;
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    this.orderByClause.push({ column: column as string, direction });
    return this;
  }

  /**
   * Set LIMIT clause
   */
  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  /**
   * Set OFFSET clause
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
   * Execute the query and return all results
   * Must be implemented by concrete classes
   */
  abstract get(): Promise<
    Array<InferRecord<TSchema, TTable> & { [relationName: string]: any }>
  >;

  /**
   * Execute the query and return the first result
   */
  async first(): Promise<
    (InferRecord<TSchema, TTable> & { [relationName: string]: any }) | null
  > {
    const originalLimit = this.limitValue;
    this.limit(1);

    const results = await this.get();

    // Restore original limit
    this.limitValue = originalLimit;

    return results[0] ?? null;
  }

  /**
   * Get count of matching records
   * Must be implemented by concrete classes
   */
  abstract count(): Promise<number>;

  /**
   * Get the effective type filter for queries
   */
  protected getEffectiveTypeFilter(): string[] {
    return this.typeFilters.length > 0 ?
        this.typeFilters
      : Object.keys(this.morphConfig.types);
  }

  /**
   * Build base query conditions that can be used by implementations
   */
  protected buildBaseConditions(): {
    filters: Array<{
      column: string;
      operator: UnifiedFilterOperator;
      value: any;
    }>;
    typeFilter: string[];
    orderBy: Array<{ column: string; direction: 'asc' | 'desc' }>;
    limit?: number;
    offset?: number;
  } {
    return {
      filters: [...this.filters],
      typeFilter: this.getEffectiveTypeFilter(),
      orderBy: [...this.orderByClause],
      limit: this.limitValue,
      offset: this.offsetValue,
    };
  }
}

/**
 * Utility functions for polymorphic relationships
 */
export class MorphUtils {
  /**
   * Validate polymorphic configuration
   */
  static validateMorphConfig<TSchema extends BaseSchema>(
    config: UnifiedMorphConfig<TSchema>,
    availableTables: (keyof TSchema)[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!config.typeField) {
      errors.push('typeField is required');
    }

    if (!config.idField) {
      errors.push('idField is required');
    }

    if (!config.relationName) {
      errors.push('relationName is required');
    }

    // Check types mapping
    if (!config.types || Object.keys(config.types).length === 0) {
      errors.push('types mapping is required and cannot be empty');
    } else {
      for (const [typeName, tableName] of Object.entries(config.types)) {
        if (!availableTables.includes(tableName)) {
          errors.push(
            `Type '${typeName}' references unknown table '${tableName}'`
          );
        }
      }
    }

    // Check pivot table if specified
    if (config.pivotTable && !availableTables.includes(config.pivotTable)) {
      errors.push(`Pivot table '${config.pivotTable}' does not exist`);
    }

    // Check nested relations
    if (config.nested && config.nestedRelations) {
      for (const [relationName, nestedConfig] of Object.entries(
        config.nestedRelations
      )) {
        const nestedValidation = this.validateMorphConfig(
          nestedConfig,
          availableTables
        );
        if (!nestedValidation.valid) {
          errors.push(
            `Nested relation '${relationName}': ${nestedValidation.errors.join(', ')}`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create a cache key for polymorphic queries
   */
  static createCacheKey<TSchema extends BaseSchema>(
    resource: keyof TSchema,
    config: UnifiedMorphConfig<TSchema>,
    conditions: any
  ): string {
    if (config.cacheKey) {
      return config.cacheKey;
    }

    const parts = [
      'morph',
      resource as string,
      config.relationName,
      JSON.stringify(config.types),
      JSON.stringify(conditions),
    ];

    return parts.join(':');
  }

  /**
   * Determine loading strategy
   */
  static getLoadingStrategy<TSchema extends BaseSchema>(
    config: UnifiedMorphConfig<TSchema>,
    defaultStrategy: 'eager' | 'lazy' | 'manual' = 'eager'
  ): 'eager' | 'lazy' | 'manual' {
    return config.loadingStrategy ?? defaultStrategy;
  }

  /**
   * Check if caching is enabled and valid
   */
  static shouldCache<TSchema extends BaseSchema>(
    config: UnifiedMorphConfig<TSchema>
  ): boolean {
    return config.cache === true && (config.cacheTTL ?? 0) > 0;
  }

  /**
   * Extract polymorphic type from a record
   */
  static extractPolymorphicType<TSchema extends BaseSchema>(
    record: any,
    config: UnifiedMorphConfig<TSchema>
  ): string | null {
    return record[config.typeField] ?? null;
  }

  /**
   * Extract polymorphic ID from a record
   */
  static extractPolymorphicId<TSchema extends BaseSchema>(
    record: any,
    config: UnifiedMorphConfig<TSchema>
  ): any {
    return record[config.idField];
  }

  /**
   * Get target table for a polymorphic type
   */
  static getTargetTable<TSchema extends BaseSchema>(
    typeName: string,
    config: UnifiedMorphConfig<TSchema>
  ): keyof TSchema | null {
    return config.types[typeName] ?? null;
  }

  /**
   * Group records by polymorphic type
   */
  static groupRecordsByType<TSchema extends BaseSchema>(
    records: any[],
    config: UnifiedMorphConfig<TSchema>
  ): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    for (const record of records) {
      const type = this.extractPolymorphicType(record, config);
      if (type) {
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(record);
      }
    }

    return groups;
  }

  /**
   * Create polymorphic relation data structure
   */
  static createPolymorphicRelation<TSchema extends BaseSchema>(
    baseRecord: any,
    relatedRecord: any,
    config: UnifiedMorphConfig<TSchema>
  ): any {
    return { ...baseRecord, [config.relationName]: relatedRecord };
  }

  /**
   * Merge polymorphic relations into base records
   */
  static mergePolymorphicRelations<TSchema extends BaseSchema>(
    baseRecords: any[],
    relationData: Record<string, Record<any, any>>,
    config: UnifiedMorphConfig<TSchema>
  ): any[] {
    return baseRecords.map(record => {
      const type = this.extractPolymorphicType(record, config);
      const id = this.extractPolymorphicId(record, config);

      if (type && id && relationData[type]?.[id]) {
        return this.createPolymorphicRelation(
          record,
          relationData[type][id],
          config
        );
      }

      return { ...record, [config.relationName]: null };
    });
  }

  /**
   * Convert unified filter operator to implementation-specific operator
   */
  static mapFilterOperator(
    operator: UnifiedFilterOperator,
    targetFormat: 'refine' | 'sql' | 'drizzle'
  ): string {
    const operatorMaps = {
      refine: {
        eq: 'eq',
        ne: 'ne',
        gt: 'gt',
        gte: 'gte',
        lt: 'lt',
        lte: 'lte',
        in: 'in',
        notIn: 'nin',
        like: 'contains',
        ilike: 'containss',
        notLike: 'ncontains',
        isNull: 'null',
        isNotNull: 'nnull',
        between: 'between',
        notBetween: 'nbetween',
        contains: 'contains',
        ncontains: 'ncontains',
        containss: 'containss',
        ncontainss: 'ncontainss',
        startswith: 'startswith',
        nstartswith: 'nstartswith',
        startswiths: 'startswiths',
        nstartswiths: 'nstartswiths',
        endswith: 'endswith',
        nendswith: 'nendswith',
        endswiths: 'endswiths',
        nendswiths: 'nendswiths',
        null: 'null',
        nnull: 'nnull',
        ina: 'ina',
        nina: 'nina',
      },
      sql: {
        eq: '=',
        ne: '!=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        in: 'IN',
        notIn: 'NOT IN',
        like: 'LIKE',
        ilike: 'ILIKE',
        notLike: 'NOT LIKE',
        isNull: 'IS NULL',
        isNotNull: 'IS NOT NULL',
        between: 'BETWEEN',
        notBetween: 'NOT BETWEEN',
        contains: 'LIKE',
        ncontains: 'NOT LIKE',
        containss: 'ILIKE',
        ncontainss: 'NOT ILIKE',
        startswith: 'LIKE',
        nstartswith: 'NOT LIKE',
        startswiths: 'ILIKE',
        nstartswiths: 'NOT ILIKE',
        endswith: 'LIKE',
        nendswith: 'NOT LIKE',
        endswiths: 'ILIKE',
        nendswiths: 'NOT ILIKE',
        null: 'IS NULL',
        nnull: 'IS NOT NULL',
        ina: 'IN',
        nina: 'NOT IN',
      },
      drizzle: {
        eq: 'eq',
        ne: 'ne',
        gt: 'gt',
        gte: 'gte',
        lt: 'lt',
        lte: 'lte',
        in: 'inArray',
        notIn: 'notInArray',
        like: 'like',
        ilike: 'ilike',
        notLike: 'notLike',
        isNull: 'isNull',
        isNotNull: 'isNotNull',
        between: 'between',
        notBetween: 'notBetween',
        contains: 'like',
        ncontains: 'notLike',
        containss: 'ilike',
        ncontainss: 'notIlike',
        startswith: 'like',
        nstartswith: 'notLike',
        startswiths: 'ilike',
        nstartswiths: 'notIlike',
        endswith: 'like',
        nendswith: 'notLike',
        endswiths: 'ilike',
        nendswiths: 'notIlike',
        null: 'isNull',
        nnull: 'isNotNull',
        ina: 'inArray',
        nina: 'notInArray',
      },
    };

    const map = operatorMaps[targetFormat];
    return map[operator] ?? operator;
  }
}

/**
 * Factory function to create morph configurations
 */
export function createMorphConfig<TSchema extends BaseSchema>(
  config: Omit<UnifiedMorphConfig<TSchema>, 'relationName'> & {
    relationName?: string;
  }
): UnifiedMorphConfig<TSchema> {
  return {
    relationName: 'morphable',
    loadingStrategy: 'eager',
    cache: false,
    ...config,
  };
}

/**
 * Helper to create simple polymorphic configurations
 */
export function createSimpleMorphConfig<TSchema extends BaseSchema>(
  typeField: string,
  idField: string,
  types: Record<string, keyof TSchema & string>,
  relationName: string = 'morphable'
): UnifiedMorphConfig<TSchema> {
  return createMorphConfig({ typeField, idField, types, relationName });
}

/**
 * Helper to create many-to-many polymorphic configurations
 */
export function createManyToManyMorphConfig<TSchema extends BaseSchema>(
  typeField: string,
  idField: string,
  types: Record<string, keyof TSchema & string>,
  pivotTable: keyof TSchema & string,
  relationName: string = 'morphable',
  options?: {
    pivotLocalKey?: string;
    pivotForeignKey?: string;
    cache?: boolean;
    cacheTTL?: number;
  }
): UnifiedMorphConfig<TSchema> {
  return createMorphConfig({
    typeField,
    idField,
    types,
    relationName,
    pivotTable,
    pivotLocalKey: options?.pivotLocalKey,
    pivotForeignKey: options?.pivotForeignKey,
    cache: options?.cache,
    cacheTTL: options?.cacheTTL,
  });
}
