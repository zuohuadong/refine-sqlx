import type {
  CrudFilters,
  CrudSorting,
  LogicalFilter,
  Pagination,
} from '@refinedev/core';
import type { SqlQuery, SqlResult } from './client';

/**
 * Escapes SQL identifiers (table names, column names) to prevent SQL injection.
 * Wraps identifiers in double quotes and escapes any existing double quotes.
 * @param identifier - The SQL identifier to escape
 * @returns The safely escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  // Remove any potentially dangerous characters and escape existing quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function createInsertQuery<T extends Record<string, any>>(
  table: string,
  data: T,
): SqlQuery {
  const columns = Object.keys(data)
    .map((col) => escapeIdentifier(col))
    .join(', ');
  const placeholders = Object.keys(data)
    .map(() => '?')
    .join(', ');

  return {
    sql: `INSERT INTO ${escapeIdentifier(table)} (${columns}) VALUES (${placeholders})`,
    args: Object.values(data),
  };
}

export function createUpdateQuery<T extends Record<string, any>>(
  table: string,
  filter: LogicalFilter,
  data: T,
): SqlQuery {
  const columns = Object.keys(data);
  const placeholders = columns
    .map((key) => `${escapeIdentifier(key)} = ?`)
    .join(', ');
  const where = createCrudFilters([filter])!;
  const sql = `UPDATE ${escapeIdentifier(table)} SET ${placeholders} WHERE ${where.sql}`;
  const args = [...Object.values(data), ...where.args];

  return { sql, args };
}

export function createDeleteQuery(
  table: string,
  filter: LogicalFilter,
): SqlQuery {
  const where = createCrudFilters([filter])!;
  const sql = `DELETE FROM ${escapeIdentifier(table)} WHERE ${where.sql}`;
  const args = where.args;

  return { sql, args };
}

export function createSelectQuery(
  table: string,
  filter: LogicalFilter,
): SqlQuery {
  const where = createCrudFilters([filter])!;
  const sql = `SELECT * FROM ${escapeIdentifier(table)} WHERE ${where.sql}`;
  const args = where.args;

  return { sql, args };
}

export function deserializeSqlResult({ columnNames, rows }: SqlResult) {
  return rows.map((row) =>
    Object.fromEntries(
      columnNames.map((name, index) => [name, row[index]] as const),
    ),
  );
}

export function createPagination(
  pagination?: Pagination,
): SqlQuery | undefined {
  if (!pagination) return void 0;
  const { pageSize = 10, current = 1 } = pagination;

  return {
    sql: `LIMIT ? OFFSET ?`,
    args: [pageSize, (current - 1) * pageSize],
  };
}

export function createCrudSorting(sort?: CrudSorting): SqlQuery | undefined {
  if (!sort?.length) return void 0;

  const sql = sort
    .map(({ field, order }) => `${escapeIdentifier(field)} ${order.toUpperCase()}`)
    .join(', ');
  return { sql, args: [] };
}

export function createCrudFilters(filters?: CrudFilters): SqlQuery | undefined {
  if (!filters?.length) return void 0;

  const result = processFilters(filters);
  if (!result?.parts) return void 0;

  return { sql: result.parts.join(' AND '), args: result.values };
}

function processFilters(filters: CrudFilters) {
  const parts: string[] = [];
  const values: any[] = [];

  for (const filter of filters) {
    // LogicalFilter
    if ('field' in filter) {
      const result = processLogicalFilter(filter);
      if (result.part) {
        parts.push(result.part);
        values.push(...result.values);
      }
      continue;
    }

    // ConditionalFilter
    const result = processConditionalFilter(filter);
    if (result?.part) {
      parts.push(result.part);
      values.push(...result.values);
    }
  }

  if (!parts.length) return void 0;
  return { parts, values };
}

function processLogicalFilter(filter: any) {
  const escapedField = escapeIdentifier(filter.field);

  switch (filter.operator) {
    case 'eq':
      return { part: `${escapedField} = ?`, values: [filter.value] };
    case 'ne':
      return { part: `${escapedField} != ?`, values: [filter.value] };
    case 'lt':
      return { part: `${escapedField} < ?`, values: [filter.value] };
    case 'gt':
      return { part: `${escapedField} > ?`, values: [filter.value] };
    case 'lte':
      return { part: `${escapedField} <= ?`, values: [filter.value] };
    case 'gte':
      return { part: `${escapedField} >= ?`, values: [filter.value] };
    case 'in':
    case 'ina':
      return {
        part: `${escapedField} IN (${filter.value.map(() => '?').join(', ')})`,
        values: [...filter.value],
      };
    case 'nin':
    case 'nina':
      return {
        part: `${escapedField} NOT IN (${filter.value.map(() => '?').join(', ')})`,
        values: [...filter.value],
      };
    case 'contains':
      return {
        part: `${escapedField} LIKE ?`,
        values: [`%${filter.value}%`],
      };
    case 'ncontains':
      return {
        part: `${escapedField} NOT LIKE ?`,
        values: [`%${filter.value}%`],
      };
    case 'containss':
      return {
        part: `${escapedField} LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}%`],
      };
    case 'ncontainss':
      return {
        part: `${escapedField} NOT LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}%`],
      };
    case 'null':
      return { part: `${escapedField} IS NULL`, values: [] };
    case 'nnull':
      return { part: `${escapedField} IS NOT NULL`, values: [] };
    case 'startswith':
      return { part: `${escapedField} LIKE ?`, values: [`${filter.value}%`] };
    case 'nstartswith':
      return {
        part: `${escapedField} NOT LIKE ?`,
        values: [`${filter.value}%`],
      };
    case 'startswiths':
      return {
        part: `${escapedField} LIKE ? COLLATE BINARY`,
        values: [`${filter.value}%`],
      };
    case 'nstartswiths':
      return {
        part: `${escapedField} NOT LIKE ? COLLATE BINARY`,
        values: [`${filter.value}%`],
      };
    case 'endswith':
      return { part: `${escapedField} LIKE ?`, values: [`%${filter.value}`] };
    case 'nendswith':
      return {
        part: `${escapedField} NOT LIKE ?`,
        values: [`%${filter.value}`],
      };
    case 'endswiths':
      return {
        part: `${escapedField} LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}`],
      };
    case 'nendswiths':
      return {
        part: `${escapedField} NOT LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}`],
      };
    case 'between':
      return {
        part: `${escapedField} BETWEEN ? AND ?`,
        values: [filter.value[0], filter.value[1]],
      };
    case 'nbetween':
      return {
        part: `${escapedField} NOT BETWEEN ? AND ?`,
        values: [filter.value[0], filter.value[1]],
      };
    default:
      throw new Error(`Unknown filter operator: ${filter.operator}`);
  }
}

function processConditionalFilter(filter: any) {
  const result = processFilters(filter.value);
  if (!result?.parts.length) return void 0;

  const operator = filter.operator.toUpperCase();
  const part =
    result.parts.length > 1 ?
      `(${result.parts.join(` ${operator} `)})`
    : result.parts[0];

  return { part, values: result.values };
}
