import type { Table, SQL, Column, InferSelectModel } from 'drizzle-orm';
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
  ilike,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  asc,
  desc,
  count,
  sum,
  avg,
  sql,
} from 'drizzle-orm';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type {
  DrizzleClient,
  FilterOperator,
  RelationshipConfig,
} from '../types/client';
import { QueryError, ValidationError } from '../types/errors';

/**
 * Chainable query builder for more fluent API
 */
export class ChainQueryBuilder<
  TSchema extends Record<string, Table> = Record<string, Table>,
  TTable extends Table = Table,
> {
  private whereConditions: SQL[] = [];
  private orderByConditions: SQL[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectFields?: Record<string, Column | SQL>;
  private relationshipConfigs?: Record<string, RelationshipConfig<TSchema>>;

  constructor(
    private client: DrizzleClient<TSchema>,
    private table: TTable,
    private schema: TSchema,
    private tableName: keyof TSchema
  ) {}

  /**
   * Add WHERE condition with column, operator, and value
   */
  where<TColumn extends keyof InferSelectModel<TSchema[keyof TSchema]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(`Column '${String(column)}' not found in table`);
    }

    const condition = this.buildFieldCondition(tableColumn, operator, value);
    if (condition) {
      this.whereConditions.push(condition);
    }

    return this;
  }

  /**
   * Add WHERE condition with raw SQL
   */
  whereRaw(condition: SQL): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * Add WHERE condition with field, operator, and value (compatibility method)
   */
  whereField(field: string, operator: string, value: any): this {
    const column = this.getTableColumn(field);
    if (!column) {
      throw new QueryError(`Column '${field}' not found in table`);
    }

    const condition = this.buildFieldCondition(column, operator, value);
    if (condition) {
      this.whereConditions.push(condition);
    }

    return this;
  }

  /**
   * Add WHERE condition for equality
   */
  whereEq(field: string, value: any): this {
    return this.whereField(field, 'eq', value);
  }

  /**
   * Add WHERE condition for inequality
   */
  whereNe(field: string, value: any): this {
    return this.whereField(field, 'ne', value);
  }

  /**
   * Add WHERE condition for greater than
   */
  whereGt(field: string, value: any): this {
    return this.whereField(field, 'gt', value);
  }

  /**
   * Add WHERE condition for greater than or equal
   */
  whereGte(field: string, value: any): this {
    return this.whereField(field, 'gte', value);
  }

  /**
   * Add WHERE condition for less than
   */
  whereLt(field: string, value: any): this {
    return this.whereField(field, 'lt', value);
  }

  /**
   * Add WHERE condition for less than or equal
   */
  whereLte(field: string, value: any): this {
    return this.whereField(field, 'lte', value);
  }

  /**
   * Add WHERE condition for LIKE
   */
  whereLike(field: string, value: string): this {
    return this.whereField(field, 'contains', value);
  }

  /**
   * Add WHERE condition for IN
   */
  whereIn(field: string, values: any[]): this {
    return this.whereField(field, 'in', values);
  }

  /**
   * Add WHERE condition for NOT IN
   */
  whereNotIn(field: string, values: any[]): this {
    return this.whereField(field, 'nin', values);
  }

  /**
   * Add WHERE condition for NULL
   */
  whereNull(field: string): this {
    return this.whereField(field, 'null', null);
  }

  /**
   * Add WHERE condition for NOT NULL
   */
  whereNotNull(field: string): this {
    return this.whereField(field, 'nnull', null);
  }

  /**
   * Add ORDER BY condition
   */
  orderBy<TColumn extends keyof InferSelectModel<TSchema[keyof TSchema]>>(
    column: TColumn,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for ordering`
      );
    }

    const orderCondition =
      direction === 'desc' ? desc(tableColumn) : asc(tableColumn);
    this.orderByConditions.push(orderCondition);

    return this;
  }

  /**
   * Add ORDER BY condition (convenience method)
   */
  orderByField(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    const column = this.getTableColumn(field);
    if (!column) {
      throw new QueryError(`Column '${field}' not found in table for ordering`);
    }

    const orderCondition = direction === 'desc' ? desc(column) : asc(column);
    this.orderByConditions.push(orderCondition);

    return this;
  }

  /**
   * Add ORDER BY ASC
   */
  orderByAsc(field: string): this {
    return this.orderByField(field, 'asc');
  }

  /**
   * Add ORDER BY DESC
   */
  orderByDesc(field: string): this {
    return this.orderByField(field, 'desc');
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
    if (page < 1) {
      throw new Error('Page number must be greater than 0');
    }
    if (pageSize < 1) {
      throw new Error('Page size must be greater than 0');
    }
    this.limitValue = pageSize;
    this.offsetValue = (page - 1) * pageSize;
    return this;
  }

  /**
   * Select specific fields
   */
  select(
    fields: Record<string, string | Column | SQL>
  ): ChainQueryBuilder<TSchema, TTable> {
    this.selectFields = {};

    for (const [alias, field] of Object.entries(fields)) {
      if (typeof field === 'string') {
        const column = this.getTableColumn(field);
        if (column) {
          this.selectFields[alias] = column;
        }
      } else {
        this.selectFields[alias] = field;
      }
    }

    return this;
  }

  /**
   * Apply Refine filters
   */
  applyFilters(filters?: CrudFilters): this {
    if (!filters || filters.length === 0) {
      return this;
    }

    const conditions = this.buildRefineFilters(filters);
    if (conditions.length > 0) {
      this.whereConditions.push(...conditions);
    }

    return this;
  }

  /**
   * Apply Refine sorting
   */
  applySorting(sorters?: CrudSorting): this {
    if (!sorters || sorters.length === 0) {
      return this;
    }

    for (const sorter of sorters) {
      this.orderBy(sorter.field, sorter.order);
    }

    return this;
  }

  /**
   * Apply Refine pagination
   */
  applyPagination(pagination?: Pagination): this {
    if (!pagination || pagination.mode === 'off') {
      return this;
    }

    const { current = 1, pageSize = 10 } = pagination;
    return this.paginate(current, pageSize);
  }

  /**
   * Add relationship loading to the query
   */
  with<TRelation extends keyof TSchema>(
    relation: TRelation,
    callback?: (
      query: ChainQuery<TSchema, TRelation>
    ) => ChainQuery<TSchema, TRelation>
  ): this {
    // Store relationship configuration for later loading
    if (!(this as any).relationshipConfigs) {
      (this as any).relationshipConfigs = {};
    }

    // Build default relationship config using the same inference logic as buildDefaultRelationshipConfigs
    const relationStr = String(relation);
    const resourceStr = String(this.tableName);
    let relationConfig: any;

    if (relationStr.endsWith('s') && relationStr !== resourceStr) {
      // Likely hasMany relationship (plural form)
      relationConfig = {
        type: 'hasMany',
        relatedTable: relation,
        localKey: 'id',
        relatedKey: `${resourceStr.slice(0, -1)}_id`,
      };
    } else if (relationStr.endsWith('_id')) {
      // Likely belongsTo relationship (foreign key)
      const relatedTableName = relationStr.replace('_id', 's') as keyof TSchema;
      if (this.schema[relatedTableName]) {
        relationConfig = {
          type: 'belongsTo',
          relatedTable: relatedTableName,
          foreignKey: relationStr,
          relatedKey: 'id',
        };
      } else {
        // Fallback to hasMany if no plural table found
        relationConfig = {
          type: 'hasMany',
          relatedTable: relation,
          localKey: 'id',
          relatedKey: `${resourceStr.slice(0, -1)}_id`,
        };
      }
    } else {
      // Check if it's a singular relation name that maps to a plural table
      const pluralTableName = `${relationStr}s` as keyof TSchema;
      if (this.schema[pluralTableName]) {
        // belongsTo relationship - singular relation name, plural table
        relationConfig = {
          type: 'belongsTo',
          relatedTable: pluralTableName,
          foreignKey: `${relationStr}_id`,
          relatedKey: 'id',
        };
      } else {
        // Default to hasOne relationship
        relationConfig = {
          type: 'hasOne',
          relatedTable: relation,
          localKey: 'id',
          relatedKey: `${resourceStr.slice(0, -1)}_id`,
        };
      }
    }

    // If callback provided, we could potentially modify the config
    // For now, just store the relation name
    (this as any).relationshipConfigs[String(relation)] = relationConfig;

    return this;
  }

  /**
   * Configure a specific relationship
   */
  withRelation<TRelation extends keyof TSchema>(
    relationName: string,
    config: RelationshipConfig<TSchema>
  ): this {
    if (!this.relationshipConfigs) {
      this.relationshipConfigs = {};
    }

    this.relationshipConfigs[relationName] = config;
    return this;
  }

  /**
   * Configure hasOne relationship
   */
  withHasOne<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return this.withRelation(relationName, {
      type: 'hasOne',
      relatedTable,
      localKey,
      relatedKey: relatedKey || `${String(this.tableName).slice(0, -1)}_id`,
    });
  }

  /**
   * Configure hasMany relationship
   */
  withHasMany<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return this.withRelation(relationName, {
      type: 'hasMany',
      relatedTable,
      localKey,
      relatedKey: relatedKey || `${String(this.tableName).slice(0, -1)}_id`,
    });
  }

  /**
   * Configure belongsTo relationship
   */
  withBelongsTo<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    foreignKey?: string,
    relatedKey: string = 'id'
  ): this {
    return this.withRelation(relationName, {
      type: 'belongsTo',
      relatedTable,
      foreignKey: foreignKey || `${String(relatedTable).slice(0, -1)}_id`,
      relatedKey,
    });
  }

  /**
   * Configure belongsToMany relationship
   */
  withBelongsToMany<
    TRelation extends keyof TSchema,
    TPivot extends keyof TSchema,
  >(
    relationName: string,
    relatedTable: TRelation,
    pivotTable: TPivot,
    localKey: string = 'id',
    relatedKey: string = 'id',
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this {
    return this.withRelation(relationName, {
      type: 'belongsToMany',
      relatedTable,
      pivotTable,
      localKey,
      relatedKey,
      pivotLocalKey:
        pivotLocalKey || `${String(this.tableName).slice(0, -1)}_id`,
      pivotRelatedKey:
        pivotRelatedKey || `${String(relatedTable).slice(0, -1)}_id`,
    });
  }

  /**
   * Add polymorphic relationship conditions
   */
  morphTo(morphField: string, morphTypes: Record<string, keyof TSchema>): this {
    // Add conditions to filter by morph type
    if (morphTypes && Object.keys(morphTypes).length > 0) {
      const typeValues = Object.keys(morphTypes);
      this.where(morphField as any, 'in', typeValues);
    }
    return this;
  }

  /**
   * Build and execute the query
   */
  async get(): Promise<InferSelectModel<TSchema[keyof TSchema]>[]> {
    const query = this.buildQuery();
    const results = await (query.execute ? query.execute() : query);

    // Load relationships if configured
    if (
      this.relationshipConfigs &&
      Object.keys(this.relationshipConfigs).length > 0
    ) {
      const { RelationshipQueryBuilder } = await import(
        './relationship-query-builder.js'
      );
      const relationshipBuilder = new RelationshipQueryBuilder(
        this.client,
        this.schema
      );
      return await relationshipBuilder.loadRelationshipsForRecords(
        this.tableName,
        results,
        this.relationshipConfigs
      );
    }

    return results;
  }

  /**
   * Get the first result
   */
  async first(): Promise<InferSelectModel<TSchema[keyof TSchema]> | null> {
    // Create a copy to avoid modifying the original query
    const originalLimit = this.limitValue;
    this.limitValue = 1;

    const query = this.buildQuery();
    const results = await (query.execute ? query.execute() : query);

    // Restore original limit
    this.limitValue = originalLimit;

    if (!results || results.length === 0) {
      return null;
    }

    const firstResult = results[0];

    // Load relationships if configured
    if (
      this.relationshipConfigs &&
      Object.keys(this.relationshipConfigs).length > 0
    ) {
      const { RelationshipQueryBuilder } = await import(
        './relationship-query-builder.js'
      );
      const relationshipBuilder = new RelationshipQueryBuilder(
        this.client,
        this.schema
      );
      return await relationshipBuilder.loadRelationshipsForRecord(
        this.tableName,
        firstResult,
        this.relationshipConfigs
      );
    }

    return firstResult;
  }

  /**
   * Get count of results
   */
  async count(): Promise<number> {
    let query = this.client
      .select({ count: sql<number>`count(*)` })
      .from(this.table);

    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await query;
    return Number(result[0]?.count) || 0;
  }

  /**
   * Get sum of a column
   */
  async sum<TColumn extends keyof InferSelectModel<TSchema[keyof TSchema]>>(
    column: TColumn
  ): Promise<number> {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for sum`
      );
    }

    let query = this.client
      .select({ sum: sql<number>`sum(${tableColumn})` })
      .from(this.table);

    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await query;
    return Number(result[0]?.sum) || 0;
  }

  /**
   * Get average of a column
   */
  async avg<TColumn extends keyof InferSelectModel<TSchema[keyof TSchema]>>(
    column: TColumn
  ): Promise<number> {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for average`
      );
    }

    let query = this.client
      .select({ avg: sql<number>`avg(${tableColumn})` })
      .from(this.table);

    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await query;
    return Number(result[0]?.avg) || 0;
  }

  /**
   * Build the final query
   */
  buildQuery() {
    let query =
      this.selectFields && Object.keys(this.selectFields).length > 0 ?
        this.client.select(this.selectFields).from(this.table)
      : this.client.select().from(this.table);

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

    return query;
  }

  /**
   * Build field condition based on operator
   */
  private buildFieldCondition(
    column: Column,
    operator: FilterOperator | string,
    value: any
  ): SQL | undefined {
    switch (operator) {
      case 'eq':
        return eq(column, value);
      case 'ne':
        return ne(column, value);
      case 'gt':
        return gt(column, value);
      case 'gte':
        return gte(column, value);
      case 'lt':
        return lt(column, value);
      case 'lte':
        return lte(column, value);
      case 'like':
        return like(column, `%${value}%`);
      case 'ilike':
        return ilike(column, `%${value}%`);
      case 'notLike':
        return and(ne(column, null), ne(like(column, `%${value}%`), true));
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      case 'in':
        return Array.isArray(value) ?
            inArray(column, value)
          : eq(column, value);
      case 'notIn':
        return Array.isArray(value) ?
            notInArray(column, value)
          : ne(column, value);
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
      // Compatibility operators
      case 'contains':
        return like(column, `%${value}%`);
      case 'containss':
        return ilike(column, `%${value}%`);
      case 'startswith':
        return like(column, `${value}%`);
      case 'startswiths':
        return ilike(column, `${value}%`);
      case 'endswith':
        return like(column, `%${value}`);
      case 'endswiths':
        return ilike(column, `%${value}`);
      case 'null':
        return isNull(column);
      case 'nnull':
        return isNotNull(column);
      case 'nin':
        return Array.isArray(value) ?
            notInArray(column, value)
          : ne(column, value);
      case 'nbetween':
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
   * Build Refine filters recursively
   */
  private buildRefineFilters(filters: CrudFilters): SQL[] {
    const conditions: SQL[] = [];

    for (const filter of filters) {
      if ('field' in filter) {
        // Simple filter
        const column = this.getTableColumn(filter.field);
        if (column) {
          const condition = this.buildFieldCondition(
            column,
            filter.operator,
            filter.value
          );
          if (condition) {
            conditions.push(condition);
          }
        }
      } else if ('operator' in filter) {
        // Logical filter
        const subConditions = this.buildRefineFilters(filter.value);
        if (subConditions.length > 0) {
          const logicalCondition =
            filter.operator === 'or' ?
              or(...subConditions)
            : and(...subConditions);
          if (logicalCondition) {
            conditions.push(logicalCondition);
          }
        }
      }
    }

    return conditions;
  }

  /**
   * Get column from table by field name
   */
  private getTableColumn(fieldName: string): Column | undefined {
    try {
      const tableAny = this.table as any;

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

/**
 * Create a new chain query builder
 */
export function createChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends Table,
>(
  client: DrizzleClient<TSchema>,
  table: TTable,
  schema: TSchema,
  tableName: keyof TSchema
): ChainQueryBuilder<TSchema, TTable> {
  return new ChainQueryBuilder(client, table, schema, tableName);
}

/**
 * ChainQuery implementation that extends ChainQueryBuilder
 */
export class ChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends ChainQueryBuilder<TSchema, TSchema[TTable]> {
  constructor(
    client: DrizzleClient<TSchema>,
    table: TSchema[TTable],
    schema: TSchema,
    tableName: TTable
  ) {
    super(client, table, schema, tableName);
  }

  // Override methods to return proper types for ChainQuery interface
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this {
    return super.where(column, operator, value);
  }

  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    return super.orderBy(column, direction);
  }

  limit(count: number): this {
    return super.limit(count);
  }

  offset(count: number): this {
    return super.offset(count);
  }

  paginate(page: number, pageSize: number = 10): this {
    return super.paginate(page, pageSize);
  }

  // Execution methods with proper return types
  async get(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    return super.get();
  }

  async first(): Promise<InferSelectModel<TSchema[TTable]> | null> {
    return super.first();
  }

  async count(): Promise<number> {
    return super.count();
  }

  async sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    return super.sum(column);
  }

  async avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    return super.avg(column);
  }

  // Relationship loading method
  with<TRelation extends keyof TSchema>(
    relation: TRelation,
    callback?: (
      query: ChainQuery<TSchema, TRelation>
    ) => ChainQuery<TSchema, TRelation>
  ): this {
    return super.with(relation, callback);
  }

  // Relationship configuration methods
  withRelation<TRelation extends keyof TSchema>(
    relationName: string,
    config: import('../types/client.js').RelationshipConfig<TSchema>
  ): this {
    return super.withRelation(relationName, config);
  }

  withHasOne<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return super.withHasOne(relationName, relatedTable, localKey, relatedKey);
  }

  withHasMany<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey: string = 'id',
    relatedKey?: string
  ): this {
    return super.withHasMany(relationName, relatedTable, localKey, relatedKey);
  }

  withBelongsTo<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    foreignKey?: string,
    relatedKey: string = 'id'
  ): this {
    return super.withBelongsTo(
      relationName,
      relatedTable,
      foreignKey,
      relatedKey
    );
  }

  withBelongsToMany<
    TRelation extends keyof TSchema,
    TPivot extends keyof TSchema,
  >(
    relationName: string,
    relatedTable: TRelation,
    pivotTable: TPivot,
    localKey: string = 'id',
    relatedKey: string = 'id',
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this {
    return super.withBelongsToMany(
      relationName,
      relatedTable,
      pivotTable,
      localKey,
      relatedKey,
      pivotLocalKey,
      pivotRelatedKey
    );
  }

  morphTo(morphField: string, morphTypes: Record<string, keyof TSchema>): this {
    return super.morphTo(morphField, morphTypes);
  }
}
