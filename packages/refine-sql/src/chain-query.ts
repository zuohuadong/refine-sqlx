import type { CrudFilters, CrudSorting, BaseRecord } from '@refinedev/core';
import type { SqlClient, SqlQuery } from './client';
import { SqlTransformer } from '@refine-orm/core-utils';
import { deserializeSqlResult, handleErrors, validateParams } from './utils';

/**
 * Filter operator types for chain queries
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'like'
  | 'ilike'
  | 'notLike'
  | 'isNull'
  | 'isNotNull'
  | 'between'
  | 'notBetween'
  | 'contains'
  | 'startswith'
  | 'endswith';

/**
 * Chain query result interface
 */
export interface ChainQueryResult<T = BaseRecord> {
  data: T[];
  total?: number;
}

/**
 * Pagination result interface
 */
export interface PaginatedResult<T = BaseRecord> extends ChainQueryResult<T> {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Chain query builder for SQLite operations
 * Provides a fluent interface for building SQL queries
 */
export class SqlxChainQuery<T extends BaseRecord = BaseRecord> {
  // Dynamically generated method type definitions
  whereEq!: (field: string, value: any) => this;
  whereNe!: (field: string, value: any) => this;
  whereGt!: (field: string, value: any) => this;
  whereGte!: (field: string, value: any) => this;
  whereLt!: (field: string, value: any) => this;
  whereLte!: (field: string, value: any) => this;
  whereLike!: (field: string, value: any) => this;
  whereIn!: (field: string, value: any) => this;
  whereNotIn!: (field: string, value: any) => this;
  whereNull!: (field: string, value: any) => this;
  whereNotNull!: (field: string, value: any) => this;
  whereILike!: (field: string, value: any) => this;
  whereNotLike!: (field: string, value: any) => this;
  whereStartsWith!: (field: string, value: any) => this;
  whereEndsWith!: (field: string, value: any) => this;
  whereContains!: (field: string, value: any) => this;
  whereBetween!: (field: string, value: any) => this;
  whereNotBetween!: (field: string, value: any) => this;
  orderByAsc!: (field: string) => this;
  orderByDesc!: (field: string) => this;
  sum!: (column: string) => Promise<number>;
  avg!: (column: string) => Promise<number>;
  min!: (column: string) => Promise<any>;
  max!: (column: string) => Promise<any>;
  count!: () => Promise<number>;
  private filters: CrudFilters = [];
  private sorters: CrudSorting = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectColumns?: string[];
  private transformer: SqlTransformer;

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {
    this.transformer = new SqlTransformer();
    this.initializeWhereMethods();
    this.initializeAggregateMethods();
  }

  /**
   * Add WHERE condition with field, operator, and value
   */
  whereField(field: string, operator: string, value: any): this {
    const refineOperator = this.mapOperatorToRefine(operator as FilterOperator);
    this.filters.push({
      field,
      operator: refineOperator,
      value,
    });
    return this;
  }

  /**
   * Add WHERE condition with raw SQL
   */
  whereRaw(condition: string): this {
    // For SQLite, we'll store raw conditions as special filters
    this.filters.push({
      field: '__raw__',
      operator: 'eq',
      value: condition,
    });
    return this;
  }

  // ===== Advanced Methods =====
  // Use generic methods to reduce code duplication

  // ===== Dynamically Generated WHERE Methods =====

  // Dynamically create all WHERE and sorting methods in constructor
  private initializeWhereMethods() {
    // WHERE method mapping
    const whereMethods = {
      whereEq: 'eq',
      whereNe: 'ne',
      whereGt: 'gt',
      whereGte: 'gte',
      whereLt: 'lt',
      whereLte: 'lte',
      whereLike: 'contains',
      whereIn: 'in',
      whereNotIn: 'nin',
      whereNull: 'null',
      whereNotNull: 'nnull',
      whereILike: 'ilike',
      whereNotLike: 'ncontains',
      whereStartsWith: 'startswith',
      whereEndsWith: 'endswith',
      whereContains: 'contains',
      whereBetween: 'between',
      whereNotBetween: 'nbetween'
    };

    // Dynamically create WHERE methods
    Object.entries(whereMethods).forEach(([methodName, operator]) => {
      (this as any)[methodName] = (field: string, value: any) => {
        return this.whereField(field, operator, value);
      };
    });

    // Dynamically create sorting convenience methods
    (this as any).orderByAsc = (field: string) => this.orderBy(field, 'asc');
    (this as any).orderByDesc = (field: string) => this.orderBy(field, 'desc');
  }

  // ===== Simplified Sorting and Pagination Methods =====



  /**
   * Add ORDER BY clause
   */
  orderBy<K extends keyof T>(
    column: K | string,
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    this.sorters.push({ field: column as string, order: direction });
    return this;
  }

  /**
   * Add multiple ORDER BY clauses
   */
  orderByMultiple(
    orders: Array<{ column: keyof T | string; direction?: 'asc' | 'desc' }>
  ): this {
    orders.forEach(({ column, direction = 'asc' }) => {
      this.orderBy(column, direction);
    });
    return this;
  }

  /**
   * Set LIMIT clause
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set OFFSET clause
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Set pagination (convenience method)
   */
  paginate(page: number, pageSize: number = 10): this {
    this.limitValue = pageSize;
    this.offsetValue = (page - 1) * pageSize;
    return this;
  }

  /**
   * Select specific columns
   */
  select<K extends keyof T>(...columns: (K | string)[]): this {
    this.selectColumns = columns as string[];
    return this;
  }

  /**
   * Execute the query and return all results
   */
  @handleErrors('Failed to execute query')
  async get(): Promise<T[]> {
    const query = this.buildSelectQuery();
    const result = await this.client.query(query);
    return deserializeSqlResult(result) as T[];
  }

  /**
   * Execute the query and return the first result
   */
  @handleErrors('Failed to get first result')
  async first(): Promise<T | null> {
    const originalLimit = this.limitValue;
    this.limit(1);

    const results = await this.get();

    // Restore original limit
    this.limitValue = originalLimit;

    return results[0] || null;
  }

  /**
   * Execute the query and return results with pagination info
   */
  @validateParams((args) => {
    const [page, pageSize] = args;
    if (page < 1) return 'Page number must be greater than 0';
    if (pageSize < 1) return 'Page size must be greater than 0';
    return true;
  })
  @handleErrors('Failed to get paginated results')
  async paginated(
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResult<T>> {
    // Get total count
    const total = await this.count();

    // Get paginated data
    this.paginate(page, pageSize);
    const data = await this.get();

    return {
      data,
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    };
  }

  /**
   * Check if any records exist matching the conditions
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  // ===== Core Query Building Methods =====

  /**
   * Build the SELECT query
   */
  private buildSelectQuery(): SqlQuery {
    return this.transformer.buildSelectQuery(this.tableName, {
      filters: this.filters.length > 0 ? this.filters : undefined,
      sorting: this.sorters.length > 0 ? this.sorters : undefined,
      pagination:
        this.limitValue || this.offsetValue ?
          {
            current:
              this.offsetValue ?
                Math.floor(this.offsetValue / (this.limitValue || 10)) + 1
                : 1,
            pageSize: this.limitValue || 10,
            mode: 'server',
          }
          : undefined,
    });
  }

  /**
   * Build the COUNT query
   */
  private buildCountQuery(): SqlQuery {
    return this.transformer.buildCountQuery(
      this.tableName,
      this.filters.length > 0 ? this.filters : undefined
    );
  }



  /**
   * Map chain query operators to Refine filter operators
   */
  private mapOperatorToRefine(
    operator: FilterOperator
  ):
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'contains'
    | 'containss'
    | 'ncontains'
    | 'null'
    | 'nnull'
    | 'between'
    | 'nbetween'
    | 'startswith'
    | 'endswith' {
    const operatorMap: Record<
      FilterOperator,
      | 'eq'
      | 'ne'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | 'in'
      | 'nin'
      | 'contains'
      | 'containss'
      | 'ncontains'
      | 'null'
      | 'nnull'
      | 'between'
      | 'nbetween'
      | 'startswith'
      | 'endswith'
    > = {
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
      startswith: 'startswith',
      endswith: 'endswith',
    };

    return operatorMap[operator];
  }

  // ===== Relationship Queries =====
  private relationshipConfigs: Record<string, any> = {};

  /**
   * Configure relationship loading
   */
  with(relationName: string): this {
    this.relationshipConfigs[relationName] = { name: relationName };
    return this;
  }

  /**
   * Simplified relationship queries - Only return basic results
   */
  @handleErrors('Failed to get relations')
  async getWithRelations(): Promise<T[]> {
    return await this.get();
  }

  // ===== Batch Operation Methods =====

  // ===== Simplified Batch Operation Methods =====

  /**
   * Simplified chunk processing - Reduce code complexity
   */
  @validateParams((args) => {
    const [size] = args;
    if (size <= 0) return 'Chunk size must be greater than 0';
    return true;
  })
  async *chunk(size: number = 100): AsyncGenerator<T[], void, unknown> {
    let offset = 0;
    while (true) {
      const results = await this.clone().offset(offset).limit(size).get();
      if (results.length === 0) break;
      yield results;
      offset += size;
      if (results.length < size) break;
    }
  }

  /**
   * Get results and map them
   */
  async map<U>(
    callback: (record: T, index: number) => U | Promise<U>
  ): Promise<U[]> {
    const results = await this.get();
    const mapped: U[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = await callback(results[i], i);
      mapped.push(result);
    }

    return mapped;
  }

  /**
   * Get results and filter them
   */
  async filter(
    callback: (record: T, index: number) => boolean | Promise<boolean>
  ): Promise<T[]> {
    const results = await this.get();
    const filtered: T[] = [];

    for (let i = 0; i < results.length; i++) {
      const shouldInclude = await callback(results[i], i);
      if (shouldInclude) {
        filtered.push(results[i]);
      }
    }

    return filtered;
  }

  // ===== Aggregate Methods =====

  /**
   * Generic aggregate method executor
   */
  @handleErrors('Failed to execute aggregate function')
  private async executeAggregate(func: string, column?: string): Promise<number | any> {
    const query = column ?
      this.buildAggregateQuery(func, column) :
      this.buildCountQuery();
    const result = await this.client.query(query);
    const [[value]] = result.rows;
    return func === 'SUM' || func === 'AVG' ? (value as number) || 0 : value;
  }

  /**
   * Build aggregate query
   */
  private buildAggregateQuery(func: string, column: string): SqlQuery {
    return {
      sql: `SELECT ${func}(${column}) FROM ${this.tableName}${this.buildWhereClause()}`,
      args: this.buildWhereArgs()
    };
  }

  /**
   * Build WHERE clause for aggregate queries
   */
  private buildWhereClause(): string {
    if (this.filters.length === 0) return '';
    // Simplified WHERE clause building
    return ' WHERE ' + this.filters.map(f => {
      if ('field' in f) {
        return `${f.field} = ?`;
      }
      return '1=1'; // fallback for conditional filters
    }).join(' AND ');
  }

  /**
   * Build WHERE arguments for aggregate queries
   */
  private buildWhereArgs(): any[] {
    return this.filters.map(f => {
      if ('field' in f) {
        return f.value;
      }
      return null; // fallback for conditional filters
    }).filter(v => v !== null);
  }

  // Dynamically generate aggregate methods with error handling
  private initializeAggregateMethods() {
    const aggregateMethods = ['sum', 'avg', 'min', 'max'];

    aggregateMethods.forEach(method => {
      (this as any)[method] = this.createAggregateMethod(method.toUpperCase());
    });

    // count method doesn't need column parameter
    (this as any).count = this.createCountMethod();
  }

  private createAggregateMethod(func: string) {
    return async (column: string) => {
      if (!column || typeof column !== 'string') {
        throw new Error(`Column name is required for ${func.toLowerCase()} operation`);
      }
      return await this.executeAggregate(func, column);
    };
  }

  private createCountMethod() {
    return async () => {
      return await this.executeAggregate('COUNT');
    };
  }

  /**
   * Clone the current query builder
   */
  clone(): SqlxChainQuery<T> {
    const cloned = new SqlxChainQuery<T>(this.client, this.tableName);
    cloned.filters = [...this.filters];
    cloned.sorters = [...this.sorters];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.selectColumns =
      this.selectColumns ? [...this.selectColumns] : undefined;
    cloned.relationshipConfigs = { ...this.relationshipConfigs };
    return cloned;
  }
}
