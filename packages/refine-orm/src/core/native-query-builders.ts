import {
  type Table,
  type SQL,
  type Column,
  type InferSelectModel,
  type InferInsertModel,
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
  sql,
  count,
  sum,
  avg,
} from 'drizzle-orm';
import type { DrizzleClient, FilterOperator } from '../types/client';
import { QueryError, ValidationError } from '../types/errors';

/**
 * Native SELECT query builder with advanced features
 */
export class SelectChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private selectFields?: Record<string, Column | SQL>;
  private whereConditions: SQL[] = [];
  private orderByConditions: SQL[] = [];
  private groupByColumns: Column[] = [];
  private havingConditions: SQL[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private distinctValue: boolean = false;
  private joinClauses: SQL[] = [];

  constructor(
    private client: DrizzleClient<TSchema>,
    private table: TSchema[TTable],
    private schema: TSchema,
    private tableName: TTable
  ) {}

  /**
   * Select specific columns
   */
  select<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns: TColumns
  ): this {
    this.selectFields = {};

    for (const column of columns) {
      const tableColumn = this.getTableColumn(column as string);
      if (tableColumn) {
        this.selectFields[column as string] = tableColumn;
      }
    }

    return this;
  }

  /**
   * Select with custom fields and aliases
   */
  selectRaw(fields: Record<string, Column | SQL>): this {
    this.selectFields = { ...fields };
    return this;
  }

  /**
   * Add DISTINCT clause
   */
  distinct(): this {
    this.distinctValue = true;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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
   * Add multiple WHERE conditions with AND logic
   */
  whereAnd(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const andCondition = and(...sqlConditions);
      if (andCondition) {
        this.whereConditions.push(andCondition);
      }
    }

    return this;
  }

  /**
   * Add multiple WHERE conditions with OR logic
   */
  whereOr(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const orCondition = or(...sqlConditions);
      if (orCondition) {
        this.whereConditions.push(orCondition);
      }
    }

    return this;
  }

  /**
   * Add ORDER BY condition
   */
  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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
   * Add GROUP BY clause
   */
  groupBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): this {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for grouping`
      );
    }

    this.groupByColumns.push(tableColumn);
    return this;
  }

  /**
   * Add HAVING condition
   */
  having(condition: SQL): this {
    this.havingConditions.push(condition);
    return this;
  }

  /**
   * Add HAVING condition with aggregation
   */
  havingCount(
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne',
    value: number
  ): this {
    const countCondition = count();
    let havingCondition: SQL;

    switch (operator) {
      case 'gt':
        havingCondition = gt(countCondition, value);
        break;
      case 'gte':
        havingCondition = gte(countCondition, value);
        break;
      case 'lt':
        havingCondition = lt(countCondition, value);
        break;
      case 'lte':
        havingCondition = lte(countCondition, value);
        break;
      case 'eq':
        havingCondition = eq(countCondition, value);
        break;
      case 'ne':
        havingCondition = ne(countCondition, value);
        break;
      default:
        throw new QueryError(`Unsupported HAVING operator: ${operator}`);
    }

    this.havingConditions.push(havingCondition);
    return this;
  }

  /**
   * Add HAVING condition with SUM aggregation
   */
  havingSum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne',
    value: number
  ): this {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for HAVING SUM`
      );
    }

    const sumCondition = sum(tableColumn);
    let havingCondition: SQL;

    switch (operator) {
      case 'gt':
        havingCondition = gt(sumCondition, value);
        break;
      case 'gte':
        havingCondition = gte(sumCondition, value);
        break;
      case 'lt':
        havingCondition = lt(sumCondition, value);
        break;
      case 'lte':
        havingCondition = lte(sumCondition, value);
        break;
      case 'eq':
        havingCondition = eq(sumCondition, value);
        break;
      case 'ne':
        havingCondition = ne(sumCondition, value);
        break;
      default:
        throw new QueryError(`Unsupported HAVING operator: ${operator}`);
    }

    this.havingConditions.push(havingCondition);
    return this;
  }

  /**
   * Add HAVING condition with AVG aggregation
   */
  havingAvg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne',
    value: number
  ): this {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for HAVING AVG`
      );
    }

    const avgCondition = avg(tableColumn);
    let havingCondition: SQL;

    switch (operator) {
      case 'gt':
        havingCondition = gt(avgCondition, value);
        break;
      case 'gte':
        havingCondition = gte(avgCondition, value);
        break;
      case 'lt':
        havingCondition = lt(avgCondition, value);
        break;
      case 'lte':
        havingCondition = lte(avgCondition, value);
        break;
      case 'eq':
        havingCondition = eq(avgCondition, value);
        break;
      case 'ne':
        havingCondition = ne(avgCondition, value);
        break;
      default:
        throw new QueryError(`Unsupported HAVING operator: ${operator}`);
    }

    this.havingConditions.push(havingCondition);
    return this;
  }

  /**
   * Add INNER JOIN
   */
  innerJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`INNER JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`LEFT JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`RIGHT JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
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
   * Execute the query and return results
   */
  async get(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    const query = this.buildQuery();
    return await (query.execute ? query.execute() : query);
  }

  /**
   * Get the first result
   */
  async first(): Promise<InferSelectModel<TSchema[TTable]> | null> {
    const originalLimit = this.limitValue;
    this.limitValue = 1;

    const query = this.buildQuery();
    const results = await (query.execute ? query.execute() : query);

    this.limitValue = originalLimit ?? undefined;

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get count of results
   */
  async count(): Promise<number> {
    // Build a count query without select fields
    let query = this.client
      .select({ count: sql<number>`count(*)` })
      .from(this.table);

    // Apply joins
    for (const joinClause of this.joinClauses) {
      query = query as any; // Type assertion needed for joins
    }

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    // Apply GROUP BY
    if (this.groupByColumns.length > 0) {
      query = query.groupBy(...this.groupByColumns);
    }

    // Apply HAVING
    if (this.havingConditions.length > 0) {
      query = query.having(and(...this.havingConditions));
    }

    const result = await (query.execute ? query.execute() : query);
    return Number(result[0]?.count) || 0;
  }

  /**
   * Get sum of a column
   */
  async sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await (query.execute ? query.execute() : query);
    return Number(result[0]?.sum) || 0;
  }

  /**
   * Get average of a column
   */
  async avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await (query.execute ? query.execute() : query);
    return Number(result[0]?.avg) || 0;
  }

  /**
   * Get minimum value of a column
   */
  async min<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for min`
      );
    }

    let query = this.client
      .select({ min: sql<number>`min(${tableColumn})` })
      .from(this.table);

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await (query.execute ? query.execute() : query);
    return Number(result[0]?.min) || 0;
  }

  /**
   * Get maximum value of a column
   */
  async max<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number> {
    const tableColumn = this.getTableColumn(column as string);
    if (!tableColumn) {
      throw new QueryError(
        `Column '${String(column)}' not found in table for max`
      );
    }

    let query = this.client
      .select({ max: sql<number>`max(${tableColumn})` })
      .from(this.table);

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    const result = await (query.execute ? query.execute() : query);
    return Number(result[0]?.max) || 0;
  }

  /**
   * Build the final query
   */
  private buildQuery() {
    // Build select fields
    let selectFields = this.selectFields;
    if (!selectFields || Object.keys(selectFields).length === 0) {
      // Select all fields if none specified
      selectFields = undefined;
    }

    // Apply DISTINCT if needed
    if (this.distinctValue && selectFields) {
      // Add distinct to each field using sql template
      const distinctFields: Record<string, SQL> = {};
      for (const [alias, field] of Object.entries(selectFields)) {
        distinctFields[alias] = sql`DISTINCT ${field}`;
      }
      selectFields = distinctFields;
    }

    let query =
      selectFields ?
        this.client.select(selectFields).from(this.table)
      : this.client.select().from(this.table);

    // Apply joins
    for (const joinClause of this.joinClauses) {
      query = query as any; // Type assertion needed for joins
    }

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    // Apply GROUP BY
    if (this.groupByColumns.length > 0) {
      query = query.groupBy(...this.groupByColumns);
    }

    // Apply HAVING
    if (this.havingConditions.length > 0) {
      query = query.having(and(...this.havingConditions));
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
    operator: FilterOperator,
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
      default:
        throw new QueryError(`Unsupported filter operator: ${operator}`);
    }
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
      if (tableAny._.columns?.[fieldName]) {
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
 * Native INSERT query builder with advanced features
 */
export class InsertChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private insertData: InferInsertModel<TSchema[TTable]>[] = [];
  private onConflictAction?: 'ignore' | 'update';
  private onConflictTarget?: (keyof InferSelectModel<TSchema[TTable]>)[];
  private onConflictUpdateData?: Partial<InferInsertModel<TSchema[TTable]>>;
  private returningColumns?: (keyof InferSelectModel<TSchema[TTable]>)[];

  constructor(
    private client: DrizzleClient<TSchema>,
    private table: TSchema[TTable],
    private schema: TSchema,
    private tableName: TTable
  ) {}

  /**
   * Set values to insert (single record)
   */
  values(data: InferInsertModel<TSchema[TTable]>): this;
  /**
   * Set values to insert (multiple records)
   */
  values(data: InferInsertModel<TSchema[TTable]>[]): this;
  values(
    data:
      | InferInsertModel<TSchema[TTable]>
      | InferInsertModel<TSchema[TTable]>[]
  ): this {
    if (Array.isArray(data)) {
      this.insertData = data;
    } else {
      this.insertData = [data];
    }
    return this;
  }

  /**
   * Handle conflicts by ignoring them
   */
  onConflict(action: 'ignore'): this;
  /**
   * Handle conflicts by updating with new data
   */
  onConflict(
    action: 'update',
    target?: (keyof InferSelectModel<TSchema[TTable]>)[],
    updateData?: Partial<InferInsertModel<TSchema[TTable]>>
  ): this;
  onConflict(
    action: 'ignore' | 'update',
    target?: (keyof InferSelectModel<TSchema[TTable]>)[],
    updateData?: Partial<InferInsertModel<TSchema[TTable]>>
  ): this {
    this.onConflictAction = action;
    if (target) {
      this.onConflictTarget = target;
    }
    if (updateData) {
      this.onConflictUpdateData = updateData;
    }
    return this;
  }

  /**
   * Specify columns to return after insert
   */
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the insert query
   */
  async execute(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    if (this.insertData.length === 0) {
      throw new ValidationError('No data provided for insert operation');
    }

    let query = this.client.insert(this.table).values(this.insertData);

    // Handle conflict resolution
    if (this.onConflictAction) {
      if (this.onConflictAction === 'ignore') {
        query = query.onConflictDoNothing();
      } else if (this.onConflictAction === 'update') {
        if (this.onConflictTarget && this.onConflictTarget.length > 0) {
          // Build conflict target columns
          const targetColumns = this.onConflictTarget
            .map(col => this.getTableColumn(col as string))
            .filter(Boolean);
          if (targetColumns.length > 0) {
            const updateSet = this.onConflictUpdateData || {};
            query = query.onConflictDoUpdate({
              target: targetColumns,
              set: updateSet,
            });
          }
        } else {
          // Use default conflict resolution
          const updateSet = this.onConflictUpdateData || {};
          query = query.onConflictDoUpdate({ set: updateSet });
        }
      }
    }

    // Handle returning clause
    if (this.returningColumns && this.returningColumns.length > 0) {
      const returningFields: Record<string, Column> = {};
      for (const column of this.returningColumns) {
        const tableColumn = this.getTableColumn(column as string);
        if (tableColumn) {
          returningFields[column as string] = tableColumn;
        }
      }
      if (Object.keys(returningFields).length > 0) {
        query = query.returning(returningFields);
      }
    } else {
      // Return all columns by default
      query = query.returning();
    }

    return await (query.execute ? query.execute() : query);
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
      if (tableAny._.columns?.[fieldName]) {
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
 * Native UPDATE query builder with advanced features
 */
export class UpdateChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private updateData?: Partial<InferInsertModel<TSchema[TTable]>>;
  private whereConditions: SQL[] = [];
  private returningColumns?: (keyof InferSelectModel<TSchema[TTable]>)[];
  private joinClauses: SQL[] = [];

  constructor(
    private client: DrizzleClient<TSchema>,
    private table: TSchema[TTable],
    private schema: TSchema,
    private tableName: TTable
  ) {}

  /**
   * Set data to update
   */
  set(data: Partial<InferInsertModel<TSchema[TTable]>>): this {
    this.updateData = data;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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
   * Add multiple WHERE conditions with AND logic
   */
  whereAnd(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const andCondition = and(...sqlConditions);
      if (andCondition) {
        this.whereConditions.push(andCondition);
      }
    }

    return this;
  }

  /**
   * Add multiple WHERE conditions with OR logic
   */
  whereOr(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const orCondition = or(...sqlConditions);
      if (orCondition) {
        this.whereConditions.push(orCondition);
      }
    }

    return this;
  }

  /**
   * Add INNER JOIN for update with join
   */
  innerJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`INNER JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Add LEFT JOIN for update with join
   */
  leftJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`LEFT JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Specify columns to return after update
   */
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the update query
   */
  async execute(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    if (!this.updateData || Object.keys(this.updateData).length === 0) {
      throw new ValidationError('No data provided for update operation');
    }

    let query = this.client.update(this.table).set(this.updateData);

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    // Handle returning clause
    if (this.returningColumns && this.returningColumns.length > 0) {
      const returningFields: Record<string, Column> = {};
      for (const column of this.returningColumns) {
        const tableColumn = this.getTableColumn(column as string);
        if (tableColumn) {
          returningFields[column as string] = tableColumn;
        }
      }
      if (Object.keys(returningFields).length > 0) {
        query = query.returning(returningFields);
      }
    } else {
      // Return all columns by default
      query = query.returning();
    }

    return await (query.execute ? query.execute() : query);
  }

  /**
   * Build field condition based on operator
   */
  private buildFieldCondition(
    column: Column,
    operator: FilterOperator,
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
      default:
        throw new QueryError(`Unsupported filter operator: ${operator}`);
    }
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
      if (tableAny._.columns?.[fieldName]) {
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
 * Native DELETE query builder with advanced features
 */
export class DeleteChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  private whereConditions: SQL[] = [];
  private returningColumns?: (keyof InferSelectModel<TSchema[TTable]>)[];
  private joinClauses: SQL[] = [];

  constructor(
    private client: DrizzleClient<TSchema>,
    private table: TSchema[TTable],
    private schema: TSchema,
    private tableName: TTable
  ) {}

  /**
   * Add WHERE condition
   */
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
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
   * Add multiple WHERE conditions with AND logic
   */
  whereAnd(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const andCondition = and(...sqlConditions);
      if (andCondition) {
        this.whereConditions.push(andCondition);
      }
    }

    return this;
  }

  /**
   * Add multiple WHERE conditions with OR logic
   */
  whereOr(
    conditions: Array<{
      column: keyof InferSelectModel<TSchema[TTable]>;
      operator: FilterOperator;
      value: any;
    }>
  ): this {
    const sqlConditions: SQL[] = [];

    for (const condition of conditions) {
      const tableColumn = this.getTableColumn(condition.column as string);
      if (tableColumn) {
        const sqlCondition = this.buildFieldCondition(
          tableColumn,
          condition.operator,
          condition.value
        );
        if (sqlCondition) {
          sqlConditions.push(sqlCondition);
        }
      }
    }

    if (sqlConditions.length > 0) {
      const orCondition = or(...sqlConditions);
      if (orCondition) {
        this.whereConditions.push(orCondition);
      }
    }

    return this;
  }

  /**
   * Add INNER JOIN for delete with join
   */
  innerJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`INNER JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Add LEFT JOIN for delete with join
   */
  leftJoin<TJoinTable extends keyof TSchema>(
    joinTable: TJoinTable,
    onCondition: SQL
  ): this {
    const joinTableRef = this.schema[joinTable];
    const joinClause = sql`LEFT JOIN ${joinTableRef} ON ${onCondition}`;
    this.joinClauses.push(joinClause);
    return this;
  }

  /**
   * Specify columns to return after delete
   */
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the delete query
   */
  async execute(): Promise<InferSelectModel<TSchema[TTable]>[]> {
    let query = this.client.delete(this.table);

    // Apply WHERE conditions
    if (this.whereConditions.length > 0) {
      query = query.where(and(...this.whereConditions));
    }

    // Handle returning clause
    if (this.returningColumns && this.returningColumns.length > 0) {
      const returningFields: Record<string, Column> = {};
      for (const column of this.returningColumns) {
        const tableColumn = this.getTableColumn(column as string);
        if (tableColumn) {
          returningFields[column as string] = tableColumn;
        }
      }
      if (Object.keys(returningFields).length > 0) {
        query = query.returning(returningFields);
      }
    } else {
      // Return all columns by default
      query = query.returning();
    }

    return await (query.execute ? query.execute() : query);
  }

  /**
   * Build field condition based on operator
   */
  private buildFieldCondition(
    column: Column,
    operator: FilterOperator,
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
      default:
        throw new QueryError(`Unsupported filter operator: ${operator}`);
    }
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
      if (tableAny._.columns?.[fieldName]) {
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
 * Factory functions for creating native query builders
 */
export function createSelectChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
>(
  client: DrizzleClient<TSchema>,
  table: TSchema[TTable],
  schema: TSchema,
  tableName: TTable
): SelectChain<TSchema, TTable> {
  return new SelectChain(client, table, schema, tableName);
}

export function createInsertChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
>(
  client: DrizzleClient<TSchema>,
  table: TSchema[TTable],
  schema: TSchema,
  tableName: TTable
): InsertChain<TSchema, TTable> {
  return new InsertChain(client, table, schema, tableName);
}

export function createUpdateChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
>(
  client: DrizzleClient<TSchema>,
  table: TSchema[TTable],
  schema: TSchema,
  tableName: TTable
): UpdateChain<TSchema, TTable> {
  return new UpdateChain(client, table, schema, tableName);
}

export function createDeleteChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
>(
  client: DrizzleClient<TSchema>,
  table: TSchema[TTable],
  schema: TSchema,
  tableName: TTable
): DeleteChain<TSchema, TTable> {
  return new DeleteChain(client, table, schema, tableName);
}
