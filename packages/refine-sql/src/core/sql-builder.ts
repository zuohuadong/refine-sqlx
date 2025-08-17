/**
 * 轻量级 SQL 构建器 - 替代 SqlTransformer
 * 专为 SQLite 优化，移除通用数据库支持
 */

import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type { SqlQuery } from '../client';

export class LightweightSqlBuilder {
  /**
   * 构建 SELECT 查询
   */
  buildSelectQuery(
    tableName: string,
    options: {
      filters?: CrudFilters;
      sorting?: CrudSorting;
      pagination?: Pagination;
    } = {}
  ): SqlQuery {
    const { filters, sorting, pagination } = options;
    
    let sql = `SELECT * FROM ${tableName}`;
    const args: any[] = [];
    
    // WHERE 子句
    if (filters && filters.length > 0) {
      const { whereClause, whereArgs } = this.buildWhereClause(filters);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        args.push(...whereArgs);
      }
    }
    
    // ORDER BY 子句
    if (sorting && sorting.length > 0) {
      const orderClause = this.buildOrderClause(sorting);
      if (orderClause) {
        sql += ` ORDER BY ${orderClause}`;
      }
    }
    
    // LIMIT 和 OFFSET
    if (pagination && pagination.mode === 'server') {
      const { current = 1, pageSize = 10 } = pagination;
      sql += ` LIMIT ${pageSize} OFFSET ${(current - 1) * pageSize}`;
    }
    
    return { sql, args };
  }
  
  /**
   * 构建 INSERT 查询
   */
  buildInsertQuery(tableName: string, data: Record<string, any>): SqlQuery {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    return { sql, args: values };
  }
  
  /**
   * 构建 UPDATE 查询
   */
  buildUpdateQuery(
    tableName: string,
    data: Record<string, any>,
    condition: { field: string; value: any }
  ): SqlQuery {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = Object.values(data);
    
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${condition.field} = ?`;
    
    return { sql, args: [...values, condition.value] };
  }
  
  /**
   * 构建 DELETE 查询
   */
  buildDeleteQuery(
    tableName: string,
    condition: { field: string; value: any }
  ): SqlQuery {
    const sql = `DELETE FROM ${tableName} WHERE ${condition.field} = ?`;
    
    return { sql, args: [condition.value] };
  }
  
  /**
   * 构建 COUNT 查询
   */
  buildCountQuery(tableName: string, filters?: CrudFilters): SqlQuery {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const args: any[] = [];
    
    if (filters && filters.length > 0) {
      const { whereClause, whereArgs } = this.buildWhereClause(filters);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        args.push(...whereArgs);
      }
    }
    
    return { sql, args };
  }
  
  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(filters: CrudFilters): { whereClause: string; whereArgs: any[] } {
    const conditions: string[] = [];
    const args: any[] = [];
    
    for (const filter of filters) {
      if ('field' in filter) {
        const { condition, conditionArgs } = this.buildFieldCondition(filter);
        if (condition) {
          conditions.push(condition);
          args.push(...conditionArgs);
        }
      } else if ('operator' in filter) {
        // 逻辑操作符 (and/or)
        const { whereClause, whereArgs } = this.buildWhereClause(filter.value);
        if (whereClause) {
          const operator = filter.operator === 'or' ? ' OR ' : ' AND ';
          conditions.push(`(${whereClause.split(' AND ').join(operator)})`);
          args.push(...whereArgs);
        }
      }
    }
    
    return {
      whereClause: conditions.join(' AND '),
      whereArgs: args,
    };
  }
  
  /**
   * 构建字段条件
   */
  private buildFieldCondition(filter: any): { condition: string; conditionArgs: any[] } {
    const { field, operator, value } = filter;
    
    switch (operator) {
      case 'eq':
        return { condition: `${field} = ?`, conditionArgs: [value] };
      case 'ne':
        return { condition: `${field} != ?`, conditionArgs: [value] };
      case 'gt':
        return { condition: `${field} > ?`, conditionArgs: [value] };
      case 'gte':
        return { condition: `${field} >= ?`, conditionArgs: [value] };
      case 'lt':
        return { condition: `${field} < ?`, conditionArgs: [value] };
      case 'lte':
        return { condition: `${field} <= ?`, conditionArgs: [value] };
      case 'contains':
        return { condition: `${field} LIKE ?`, conditionArgs: [`%${value}%`] };
      case 'containss':
        return { condition: `${field} LIKE ? COLLATE NOCASE`, conditionArgs: [`%${value}%`] };
      case 'ncontains':
        return { condition: `${field} NOT LIKE ?`, conditionArgs: [`%${value}%`] };
      case 'startswith':
        return { condition: `${field} LIKE ?`, conditionArgs: [`${value}%`] };
      case 'endswith':
        return { condition: `${field} LIKE ?`, conditionArgs: [`%${value}`] };
      case 'null':
        return { condition: `${field} IS NULL`, conditionArgs: [] };
      case 'nnull':
        return { condition: `${field} IS NOT NULL`, conditionArgs: [] };
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          return { condition: `${field} IN (${placeholders})`, conditionArgs: value };
        }
        return { condition: '1=0', conditionArgs: [] }; // 空数组情况
      case 'nin':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          return { condition: `${field} NOT IN (${placeholders})`, conditionArgs: value };
        }
        return { condition: '1=1', conditionArgs: [] }; // 空数组情况
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return { condition: `${field} BETWEEN ? AND ?`, conditionArgs: value };
        }
        throw new Error('Between operator requires array with exactly 2 values');
      case 'nbetween':
        if (Array.isArray(value) && value.length === 2) {
          return { condition: `${field} NOT BETWEEN ? AND ?`, conditionArgs: value };
        }
        throw new Error('Not between operator requires array with exactly 2 values');
      default:
        throw new Error(`Unsupported filter operator: ${operator}`);
    }
  }
  
  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderClause(sorting: CrudSorting): string {
    return sorting
      .map(sort => `${sort.field} ${sort.order.toUpperCase()}`)
      .join(', ');
  }
}