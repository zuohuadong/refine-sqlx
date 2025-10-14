/**
 * Advanced features for refine-d1 to match refine-sqlx capabilities
 * Includes transactions, batch operations, upsert, and native query builders
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient, SqlQuery } from './client';
import { SqlxChainQuery } from './chain-query';

/**
 * Transaction context interface
 */
export interface TransactionContext {
  client: SqlClient;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

/**
 * Transaction manager for refine-d1
 */
export class TransactionManager {
  private activeTransactions = new Map<string, any>();
  private transactionCounter = 0;

  constructor(private client: SqlClient) {}

  /**
   * Execute a function within a database transaction
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const transactionId = this.generateTransactionId();

    try {
      // SQLite transaction implementation
      await this.client.execute({ sql: 'BEGIN TRANSACTION', args: [] });

      const txContext: TransactionContext = {
        client: this.client,
        rollback: () => this.rollbackTransaction(transactionId),
        commit: () => this.commitTransaction(transactionId),
      };

      this.activeTransactions.set(transactionId, txContext);

      const result = await fn(txContext);

      // Commit if not already committed/rolled back
      if (this.activeTransactions.has(transactionId)) {
        await this.commitTransaction(transactionId);
      }

      return result;
    } catch (error) {
      // Rollback if transaction is still active
      if (this.activeTransactions.has(transactionId)) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (rollbackError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to rollback transaction:', rollbackError);
          }
        }
      }

      throw error;
    }
  }

  private async commitTransaction(transactionId: string): Promise<void> {
    await this.client.execute({ sql: 'COMMIT', args: [] });
    this.activeTransactions.delete(transactionId);
  }

  private async rollbackTransaction(transactionId: string): Promise<void> {
    await this.client.execute({ sql: 'ROLLBACK', args: [] });
    this.activeTransactions.delete(transactionId);
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${++this.transactionCounter}`;
  }
}

/**
 * Native query builders for advanced SQL operations
 */
export class NativeQueryBuilders {
  constructor(private client: SqlClient) {}

  /**
   * SELECT query builder
   */
  select(tableName: string): SelectChain {
    return new SelectChain(this.client, tableName);
  }

  /**
   * INSERT query builder
   */
  insert(tableName: string): InsertChain {
    return new InsertChain(this.client, tableName);
  }

  /**
   * UPDATE query builder
   */
  update(tableName: string): UpdateChain {
    return new UpdateChain(this.client, tableName);
  }

  /**
   * DELETE query builder
   */
  delete(tableName: string): DeleteChain {
    return new DeleteChain(this.client, tableName);
  }
}

/**
 * SELECT chain builder
 */
export class SelectChain {
  private selectFields: string[] = [];
  private whereConditions: string[] = [];
  private whereArgs: any[] = [];
  private orderByConditions: string[] = [];
  private groupByColumns: string[] = [];
  private havingConditions: string[] = [];
  private havingArgs: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private distinctValue = false;
  private joinClauses: string[] = [];

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {}

  /**
   * Select specific columns
   */
  select(columns: string[]): this {
    this.selectFields = columns;
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
  where(column: string, operator: string, value: any): this {
    const condition = this.buildWhereCondition(column, operator, value);
    this.whereConditions.push(condition.sql);
    this.whereArgs.push(...condition.args);
    return this;
  }

  /**
   * Add raw WHERE condition
   */
  whereRaw(condition: string, args: any[] = []): this {
    this.whereConditions.push(condition);
    this.whereArgs.push(...args);
    return this;
  }

  /**
   * Add multiple WHERE conditions with AND logic
   */
  whereAnd(
    conditions: Array<{ column: string; operator: string; value: any }>
  ): this {
    const andConditions = conditions.map(c => {
      const condition = this.buildWhereCondition(c.column, c.operator, c.value);
      this.whereArgs.push(...condition.args);
      return condition.sql;
    });

    if (andConditions.length > 0) {
      this.whereConditions.push(`(${andConditions.join(' AND ')})`);
    }
    return this;
  }

  /**
   * Add multiple WHERE conditions with OR logic
   */
  whereOr(
    conditions: Array<{ column: string; operator: string; value: any }>
  ): this {
    const orConditions = conditions.map(c => {
      const condition = this.buildWhereCondition(c.column, c.operator, c.value);
      this.whereArgs.push(...condition.args);
      return condition.sql;
    });

    if (orConditions.length > 0) {
      this.whereConditions.push(`(${orConditions.join(' OR ')})`);
    }
    return this;
  }

  /**
   * Add ORDER BY condition
   */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByConditions.push(`${column} ${direction.toUpperCase()}`);
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(column: string): this {
    this.groupByColumns.push(column);
    return this;
  }

  /**
   * Add HAVING condition
   */
  having(condition: string, args: any[] = []): this {
    this.havingConditions.push(condition);
    this.havingArgs.push(...args);
    return this;
  }

  /**
   * Add HAVING with count condition
   */
  havingCount(operator: string, value: number): this {
    const condition = this.buildWhereCondition('COUNT(*)', operator, value);
    this.havingConditions.push(condition.sql);
    this.havingArgs.push(...condition.args);
    return this;
  }

  /**
   * Add INNER JOIN
   */
  innerJoin(joinTable: string, onCondition: string): this {
    this.joinClauses.push(`INNER JOIN ${joinTable} ON ${onCondition}`);
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(joinTable: string, onCondition: string): this {
    this.joinClauses.push(`LEFT JOIN ${joinTable} ON ${onCondition}`);
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin(joinTable: string, onCondition: string): this {
    this.joinClauses.push(`RIGHT JOIN ${joinTable} ON ${onCondition}`);
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
  async get<T = BaseRecord>(): Promise<T[]> {
    const query = this.buildQuery();
    const result = await this.client.query(query);
    return result.rows as T[];
  }

  /**
   * Get the first result
   */
  async first<T = BaseRecord>(): Promise<T | null> {
    const originalLimit = this.limitValue;
    this.limitValue = 1;

    const results = await this.get<T>();

    this.limitValue = originalLimit;
    return results[0] || null;
  }

  /**
   * Get count of results
   */
  async count(): Promise<number> {
    const countQuery = this.buildCountQuery();
    const result = await this.client.query(countQuery);
    return (result.rows[0] as any)?.count || 0;
  }

  /**
   * Build the final query
   */
  private buildQuery(): SqlQuery {
    let sql = 'SELECT ';

    // Add DISTINCT
    if (this.distinctValue) {
      sql += 'DISTINCT ';
    }

    // Add columns
    if (this.selectFields.length > 0) {
      sql += this.selectFields.join(', ');
    } else {
      sql += '*';
    }

    sql += ` FROM ${this.tableName}`;

    // Add JOINs
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`;
    }

    // Add WHERE
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    // Add GROUP BY
    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    // Add HAVING
    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (this.orderByConditions.length > 0) {
      sql += ` ORDER BY ${this.orderByConditions.join(', ')}`;
    }

    // Add LIMIT
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // Add OFFSET
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, args: [...this.whereArgs, ...this.havingArgs] };
  }

  private buildCountQuery(): SqlQuery {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;

    // Add JOINs
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`;
    }

    // Add WHERE
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    // Add GROUP BY
    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    // Add HAVING
    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }

    return { sql, args: [...this.whereArgs, ...this.havingArgs] };
  }

  private buildWhereCondition(
    column: string,
    operator: string,
    value: any
  ): { sql: string; args: any[] } {
    switch (operator.toLowerCase()) {
      case 'eq':
      case '=':
        return { sql: `${column} = ?`, args: [value] };
      case 'ne':
      case '!=':
        return { sql: `${column} != ?`, args: [value] };
      case 'gt':
      case '>':
        return { sql: `${column} > ?`, args: [value] };
      case 'gte':
      case '>=':
        return { sql: `${column} >= ?`, args: [value] };
      case 'lt':
      case '<':
        return { sql: `${column} < ?`, args: [value] };
      case 'lte':
      case '<=':
        return { sql: `${column} <= ?`, args: [value] };
      case 'like':
        return { sql: `${column} LIKE ?`, args: [`%${value}%`] };
      case 'ilike':
        return { sql: `${column} LIKE ? COLLATE NOCASE`, args: [`%${value}%`] };
      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${column} IN (${placeholders})`, args: value };
        }
        return { sql: `${column} = ?`, args: [value] };
      case 'notin':
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${column} NOT IN (${placeholders})`, args: value };
        }
        return { sql: `${column} != ?`, args: [value] };
      case 'isnull':
        return { sql: `${column} IS NULL`, args: [] };
      case 'isnotnull':
        return { sql: `${column} IS NOT NULL`, args: [] };
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return { sql: `${column} BETWEEN ? AND ?`, args: value };
        }
        throw new Error(
          'Between operator requires array with exactly 2 values'
        );
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

/**
 * INSERT chain builder
 */
export class InsertChain {
  private insertData: Record<string, any>[] = [];
  private onConflictAction?: 'ignore' | 'replace';
  private returningColumns?: string[];

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {}

  /**
   * Set values to insert
   */
  values(data: Record<string, any> | Record<string, any>[]): this {
    if (Array.isArray(data)) {
      this.insertData = data;
    } else {
      this.insertData = [data];
    }
    return this;
  }

  /**
   * Handle conflicts
   */
  onConflict(action: 'ignore' | 'replace'): this {
    this.onConflictAction = action;
    return this;
  }

  /**
   * Specify columns to return after insert
   */
  returning(columns?: string[]): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the insert query
   */
  async execute<T = BaseRecord>(): Promise<T[]> {
    if (this.insertData.length === 0) {
      throw new Error('No data provided for insert operation');
    }

    const query = this.buildQuery();
    const result = await this.client.query(query);
    return result.rows as T[];
  }

  private buildQuery(): SqlQuery {
    const firstRecord = this.insertData[0];
    const columns = Object.keys(firstRecord);

    let sql = '';

    if (this.onConflictAction === 'replace') {
      sql = `INSERT OR REPLACE INTO ${this.tableName}`;
    } else if (this.onConflictAction === 'ignore') {
      sql = `INSERT OR IGNORE INTO ${this.tableName}`;
    } else {
      sql = `INSERT INTO ${this.tableName}`;
    }

    sql += ` (${columns.join(', ')}) VALUES `;

    const valuePlaceholders = this.insertData
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    sql += valuePlaceholders;

    // Add RETURNING clause if specified
    if (this.returningColumns && this.returningColumns.length > 0) {
      sql += ` RETURNING ${this.returningColumns.join(', ')}`;
    } else {
      sql += ' RETURNING *';
    }

    // Flatten all values for parameters
    const args = this.insertData.flatMap(record =>
      columns.map(col => record[col])
    );

    return { sql, args };
  }
}

/**
 * UPDATE chain builder
 */
export class UpdateChain {
  private updateData?: Record<string, any>;
  private whereConditions: string[] = [];
  private whereArgs: any[] = [];
  private returningColumns?: string[];

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {}

  /**
   * Set data to update
   */
  set(data: Record<string, any>): this {
    this.updateData = data;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(column: string, operator: string, value: any): this {
    const condition = this.buildWhereCondition(column, operator, value);
    this.whereConditions.push(condition.sql);
    this.whereArgs.push(...condition.args);
    return this;
  }

  /**
   * Add raw WHERE condition
   */
  whereRaw(condition: string, args: any[] = []): this {
    this.whereConditions.push(condition);
    this.whereArgs.push(...args);
    return this;
  }

  /**
   * Specify columns to return after update
   */
  returning(columns?: string[]): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the update query
   */
  async execute<T = BaseRecord>(): Promise<T[]> {
    if (!this.updateData || Object.keys(this.updateData).length === 0) {
      throw new Error('No data provided for update operation');
    }

    const query = this.buildQuery();
    const result = await this.client.query(query);
    return result.rows as T[];
  }

  private buildQuery(): SqlQuery {
    if (!this.updateData) {
      throw new Error('No update data provided');
    }

    const columns = Object.keys(this.updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');

    let sql = `UPDATE ${this.tableName} SET ${setClause}`;

    // Add WHERE
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    // Add RETURNING clause
    if (this.returningColumns && this.returningColumns.length > 0) {
      sql += ` RETURNING ${this.returningColumns.join(', ')}`;
    } else {
      sql += ' RETURNING *';
    }

    const args = [
      ...columns.map(col => this.updateData![col]),
      ...this.whereArgs,
    ];

    return { sql, args };
  }

  private buildWhereCondition(
    column: string,
    operator: string,
    value: any
  ): { sql: string; args: any[] } {
    // Same implementation as SelectChain
    switch (operator.toLowerCase()) {
      case 'eq':
      case '=':
        return { sql: `${column} = ?`, args: [value] };
      case 'ne':
      case '!=':
        return { sql: `${column} != ?`, args: [value] };
      case 'gt':
      case '>':
        return { sql: `${column} > ?`, args: [value] };
      case 'gte':
      case '>=':
        return { sql: `${column} >= ?`, args: [value] };
      case 'lt':
      case '<':
        return { sql: `${column} < ?`, args: [value] };
      case 'lte':
      case '<=':
        return { sql: `${column} <= ?`, args: [value] };
      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${column} IN (${placeholders})`, args: value };
        }
        return { sql: `${column} = ?`, args: [value] };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

/**
 * DELETE chain builder
 */
export class DeleteChain {
  private whereConditions: string[] = [];
  private whereArgs: any[] = [];
  private returningColumns?: string[];

  constructor(
    private client: SqlClient,
    private tableName: string
  ) {}

  /**
   * Add WHERE condition
   */
  where(column: string, operator: string, value: any): this {
    const condition = this.buildWhereCondition(column, operator, value);
    this.whereConditions.push(condition.sql);
    this.whereArgs.push(...condition.args);
    return this;
  }

  /**
   * Add raw WHERE condition
   */
  whereRaw(condition: string, args: any[] = []): this {
    this.whereConditions.push(condition);
    this.whereArgs.push(...args);
    return this;
  }

  /**
   * Specify columns to return after delete
   */
  returning(columns?: string[]): this {
    this.returningColumns = columns;
    return this;
  }

  /**
   * Execute the delete query
   */
  async execute<T = BaseRecord>(): Promise<T[]> {
    const query = this.buildQuery();
    const result = await this.client.query(query);
    return result.rows as T[];
  }

  private buildQuery(): SqlQuery {
    let sql = `DELETE FROM ${this.tableName}`;

    // Add WHERE
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    // Add RETURNING clause
    if (this.returningColumns && this.returningColumns.length > 0) {
      sql += ` RETURNING ${this.returningColumns.join(', ')}`;
    } else {
      sql += ' RETURNING *';
    }

    return { sql, args: this.whereArgs };
  }

  private buildWhereCondition(
    column: string,
    operator: string,
    value: any
  ): { sql: string; args: any[] } {
    // Same implementation as SelectChain and UpdateChain
    switch (operator.toLowerCase()) {
      case 'eq':
      case '=':
        return { sql: `${column} = ?`, args: [value] };
      case 'ne':
      case '!=':
        return { sql: `${column} != ?`, args: [value] };
      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${column} IN (${placeholders})`, args: value };
        }
        return { sql: `${column} = ?`, args: [value] };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

/**
 * Advanced utility methods for refine-d1
 */
export class AdvancedUtils {
  constructor(private client: SqlClient) {}

  /**
   * Upsert operation (INSERT OR REPLACE)
   */
  async upsert<T = BaseRecord>(
    tableName: string,
    data: Record<string, any>,
    conflictColumns?: string[]
  ): Promise<T> {
    const insertChain = new InsertChain(this.client, tableName);

    if (conflictColumns && conflictColumns.length > 0) {
      // Use INSERT OR REPLACE for specific conflict columns
      insertChain.onConflict('replace');
    } else {
      // Use INSERT OR REPLACE for any conflict
      insertChain.onConflict('replace');
    }

    const result = await insertChain.values(data).execute<T>();
    return result[0];
  }

  /**
   * First or create operation
   */
  async firstOrCreate<T = BaseRecord>(
    tableName: string,
    where: Record<string, any>,
    defaults: Record<string, any> = {}
  ): Promise<{ data: T; created: boolean }> {
    // Try to find existing record
    const selectChain = new SelectChain(this.client, tableName);

    // Add where conditions
    Object.entries(where).forEach(([column, value]) => {
      selectChain.where(column, 'eq', value);
    });

    const existing = await selectChain.first<T>();

    if (existing) {
      return { data: existing, created: false };
    }

    // Create new record
    const insertData = { ...where, ...defaults };
    const insertChain = new InsertChain(this.client, tableName);
    const result = await insertChain.values(insertData).execute<T>();

    return { data: result[0], created: true };
  }

  /**
   * Update or create operation
   */
  async updateOrCreate<T = BaseRecord>(
    tableName: string,
    where: Record<string, any>,
    values: Record<string, any>
  ): Promise<{ data: T; created: boolean }> {
    // Try to update existing record
    const updateChain = new UpdateChain(this.client, tableName);

    // Add where conditions
    Object.entries(where).forEach(([column, value]) => {
      updateChain.where(column, 'eq', value);
    });

    const updateResult = await updateChain.set(values).execute<T>();

    if (updateResult.length > 0) {
      return { data: updateResult[0], created: false };
    }

    // Create new record if update didn't affect any rows
    const insertData = { ...where, ...values };
    const insertChain = new InsertChain(this.client, tableName);
    const insertResult = await insertChain.values(insertData).execute<T>();

    return { data: insertResult[0], created: true };
  }

  /**
   * Increment a numeric column
   */
  async increment(
    tableName: string,
    where: Record<string, any>,
    column: string,
    amount: number = 1
  ): Promise<void> {
    const updateChain = new UpdateChain(this.client, tableName);

    // Add where conditions
    Object.entries(where).forEach(([col, value]) => {
      updateChain.where(col, 'eq', value);
    });

    // Use raw SQL for increment
    await updateChain.set({ [column]: `${column} + ${amount}` }).execute();
  }

  /**
   * Decrement a numeric column
   */
  async decrement(
    tableName: string,
    where: Record<string, any>,
    column: string,
    amount: number = 1
  ): Promise<void> {
    await this.increment(tableName, where, column, -amount);
  }

  /**
   * Batch insert with conflict resolution
   */
  async batchInsert<T = BaseRecord>(
    tableName: string,
    data: Record<string, any>[],
    batchSize: number = 100,
    onConflict: 'ignore' | 'replace' = 'ignore'
  ): Promise<T[]> {
    const results: T[] = [];

    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const insertChain = new InsertChain(this.client, tableName);

      const batchResult = await insertChain
        .values(batch)
        .onConflict(onConflict)
        .execute<T>();

      results.push(...batchResult);
    }

    return results;
  }

  /**
   * Execute raw SQL with parameters
   */
  async raw<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.client.query({ sql, args: params });
    return result.rows as T[];
  }
}
