/**
 * SQL transformation utilities for converting between different query formats
 */

import type { CrudFilters, CrudSorting } from '@refinedev/core';
import type { UnifiedFilterOperator } from './enhanced-types.js';

export class SqlTransformer {
  /**
   * Convert Refine filters to SQL WHERE conditions
   */
  filtersToSql(filters: CrudFilters): { sql: string; params: any[] } {
    return SqlTransformer.filtersToSql(filters);
  }

  static filtersToSql(filters: CrudFilters): { sql: string; params: any[] } {
    if (!filters || filters.length === 0) {
      return { sql: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const filter of filters) {
      if ('field' in filter) {
        const { condition, values } = this.filterToSqlCondition(filter);
        conditions.push(condition);
        params.push(...values);
      }
    }

    return {
      sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Convert Refine sorting to SQL ORDER BY clause
   */
  sortingToSql(sorting: CrudSorting): string {
    return SqlTransformer.sortingToSql(sorting);
  }

  static sortingToSql(sorting: CrudSorting): string {
    if (!sorting || sorting.length === 0) {
      return '';
    }

    const orderClauses = sorting.map(
      sort => `${sort.field} ${sort.order?.toUpperCase() || 'ASC'}`
    );

    return `ORDER BY ${orderClauses.join(', ')}`;
  }

  /**
   * Convert a single filter to SQL condition
   */
  private static filterToSqlCondition(filter: any): {
    condition: string;
    values: any[];
  } {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'eq':
        return { condition: `${field} = ?`, values: [value] };
      case 'ne':
        return { condition: `${field} != ?`, values: [value] };
      case 'gt':
        return { condition: `${field} > ?`, values: [value] };
      case 'gte':
        return { condition: `${field} >= ?`, values: [value] };
      case 'lt':
        return { condition: `${field} < ?`, values: [value] };
      case 'lte':
        return { condition: `${field} <= ?`, values: [value] };
      case 'in':
      case 'ina':
        const placeholders = Array(value.length).fill('?').join(', ');
        return { condition: `${field} IN (${placeholders})`, values: value };
      case 'nin':
      case 'nina':
        const notPlaceholders = Array(value.length).fill('?').join(', ');
        return {
          condition: `${field} NOT IN (${notPlaceholders})`,
          values: value,
        };
      case 'contains':
        return { condition: `${field} LIKE ?`, values: [`%${value}%`] };
      case 'containss':
        return {
          condition: `LOWER(${field}) LIKE LOWER(?)`,
          values: [`%${value}%`],
        };
      case 'ncontains':
        return { condition: `${field} NOT LIKE ?`, values: [`%${value}%`] };
      case 'ncontainss':
        return {
          condition: `LOWER(${field}) NOT LIKE LOWER(?)`,
          values: [`%${value}%`],
        };
      case 'startswith':
        return { condition: `${field} LIKE ?`, values: [`${value}%`] };
      case 'startswiths':
        return {
          condition: `LOWER(${field}) LIKE LOWER(?)`,
          values: [`${value}%`],
        };
      case 'nstartswith':
        return { condition: `${field} NOT LIKE ?`, values: [`${value}%`] };
      case 'nstartswiths':
        return {
          condition: `LOWER(${field}) NOT LIKE LOWER(?)`,
          values: [`${value}%`],
        };
      case 'endswith':
        return { condition: `${field} LIKE ?`, values: [`%${value}`] };
      case 'endswiths':
        return {
          condition: `LOWER(${field}) LIKE LOWER(?)`,
          values: [`%${value}`],
        };
      case 'nendswith':
        return { condition: `${field} NOT LIKE ?`, values: [`%${value}`] };
      case 'nendswiths':
        return {
          condition: `LOWER(${field}) NOT LIKE LOWER(?)`,
          values: [`%${value}`],
        };
      case 'null':
        return { condition: `${field} IS NULL`, values: [] };
      case 'nnull':
        return { condition: `${field} IS NOT NULL`, values: [] };
      case 'between':
        return {
          condition: `${field} BETWEEN ? AND ?`,
          values: [value[0], value[1]],
        };
      case 'nbetween':
        return {
          condition: `${field} NOT BETWEEN ? AND ?`,
          values: [value[0], value[1]],
        };
      default:
        // Fallback to equality
        return { condition: `${field} = ?`, values: [value] };
    }
  }

  /**
   * Convert unified filter operator to SQL operator
   */
  static unifiedOperatorToSql(operator: UnifiedFilterOperator): string {
    const mapping: Record<UnifiedFilterOperator, string> = {
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
    };

    return mapping[operator] || '=';
  }

  /**
   * Escape SQL identifiers (table names, column names)
   */
  static escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Build a parameterized SQL query
   */
  static buildQuery(options: {
    select?: string[];
    from: string;
    where?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): string {
    const parts: string[] = [];

    // SELECT clause
    const selectClause =
      options.select && options.select.length > 0 ?
        options.select.map(col => this.escapeIdentifier(col)).join(', ')
      : '*';
    parts.push(`SELECT ${selectClause}`);

    // FROM clause
    parts.push(`FROM ${this.escapeIdentifier(options.from)}`);

    // WHERE clause
    if (options.where) {
      parts.push(options.where);
    }

    // ORDER BY clause
    if (options.orderBy) {
      parts.push(options.orderBy);
    }

    // LIMIT clause
    if (options.limit !== undefined) {
      parts.push(`LIMIT ${options.limit}`);
    }

    // OFFSET clause
    if (options.offset !== undefined) {
      parts.push(`OFFSET ${options.offset}`);
    }

    return parts.join(' ');
  }

  /**
   * Build INSERT query
   */
  static buildInsertQuery(
    table: string,
    data: Record<string, any>
  ): { sql: string; params: any[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = Array(columns.length).fill('?').join(', ');

    const sql = `INSERT INTO ${this.escapeIdentifier(table)} (${columns.map(col => this.escapeIdentifier(col)).join(', ')}) VALUES (${placeholders})`;

    return { sql, params: values };
  }

  /**
   * Build UPDATE query
   */
  static buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: { field: string; value: any }
  ): { sql: string; params: any[] } {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns
      .map(col => `${this.escapeIdentifier(col)} = ?`)
      .join(', ');

    const sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setClause} WHERE ${this.escapeIdentifier(where.field)} = ?`;
    const params = [...values, where.value];

    return { sql, params };
  }

  /**
   * Build DELETE query
   */
  static buildDeleteQuery(
    table: string,
    where: { field: string; value: any }
  ): { sql: string; params: any[] } {
    const sql = `DELETE FROM ${this.escapeIdentifier(table)} WHERE ${this.escapeIdentifier(where.field)} = ?`;
    const params = [where.value];

    return { sql, params };
  }

  // Instance methods that delegate to static methods
  buildSelectQuery(table: string, options: any): { sql: string; args: any[] } {
    const sql = SqlTransformer.buildQuery({
      from: table,
      select: options.select,
      where: options.where,
      orderBy: options.orderBy,
      limit: options.limit,
      offset: options.offset,
    });
    return { sql, args: options.args || [] };
  }

  buildCountQuery(table: string, filters?: any): { sql: string; args: any[] } {
    const whereResult =
      filters ? SqlTransformer.filtersToSql(filters) : { sql: '', params: [] };
    const sql = `SELECT COUNT(*) as count FROM ${SqlTransformer.escapeIdentifier(table)} ${whereResult.sql}`;
    return { sql, args: whereResult.params };
  }

  buildInsertQuery(
    table: string,
    data: Record<string, any>
  ): { sql: string; args: any[] } {
    const result = SqlTransformer.buildInsertQuery(table, data);
    return { sql: result.sql, args: result.params };
  }

  buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: { field: string; value: any }
  ): { sql: string; args: any[] } {
    const result = SqlTransformer.buildUpdateQuery(table, data, where);
    return { sql: result.sql, args: result.params };
  }

  buildDeleteQuery(
    table: string,
    where: { field: string; value: any } | { field: string; value: any }[]
  ): { sql: string; args: any[] } {
    // Handle both single where condition and array of conditions
    if (Array.isArray(where)) {
      // For now, just use the first condition - this is a simplified implementation
      const firstWhere = where[0];
      const result = SqlTransformer.buildDeleteQuery(table, firstWhere);
      return { sql: result.sql, args: result.params };
    } else {
      const result = SqlTransformer.buildDeleteQuery(table, where);
      return { sql: result.sql, args: result.params };
    }
  }

  transformFilters(filters: any): { sql: string; args: any[] } {
    if (!filters || filters.length === 0) return { sql: '', args: [] };
    const result = SqlTransformer.filtersToSql(filters);
    return { sql: result.sql, args: result.params };
  }

  unifiedOperatorToSql(operator: any): string {
    return SqlTransformer.unifiedOperatorToSql(operator);
  }

  escapeIdentifier(identifier: string): string {
    return SqlTransformer.escapeIdentifier(identifier);
  }

  buildQuery(options: any): string {
    return SqlTransformer.buildQuery(options);
  }
}
