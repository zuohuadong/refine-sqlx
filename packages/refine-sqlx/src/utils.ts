import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type { SqlQuery, SqlResult } from './client';

export function createInsertQuery<T extends Record<string, any>>(
  table: string,
  data: T,
): SqlQuery {
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data)
    .map(() => '?')
    .join(', ');

  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    args: Object.values(data),
  };
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
    .map(({ field, order }) => `${field} ${order.toUpperCase()}`)
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
  switch (filter.operator) {
    case 'eq':
      return { part: `"${filter.field}" = ?`, values: [filter.value] };
    case 'ne':
      return { part: `"${filter.field}" != ?`, values: [filter.value] };
    case 'lt':
      return { part: `"${filter.field}" < ?`, values: [filter.value] };
    case 'gt':
      return { part: `"${filter.field}" > ?`, values: [filter.value] };
    case 'lte':
      return { part: `"${filter.field}" <= ?`, values: [filter.value] };
    case 'gte':
      return { part: `"${filter.field}" >= ?`, values: [filter.value] };
    case 'in':
    case 'ina':
      return {
        part: `"${filter.field}" IN (${filter.value.map(() => '?').join(', ')})`,
        values: [...filter.value],
      };
    case 'nin':
    case 'nina':
      return {
        part: `"${filter.field}" NOT IN (${filter.value.map(() => '?').join(', ')})`,
        values: [...filter.value],
      };
    case 'contains':
      return {
        part: `"${filter.field}" LIKE ?`,
        values: [`%${filter.value}%`],
      };
    case 'ncontains':
      return {
        part: `"${filter.field}" NOT LIKE ?`,
        values: [`%${filter.value}%`],
      };
    case 'containss':
      return {
        part: `"${filter.field}" LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}%`],
      };
    case 'ncontainss':
      return {
        part: `"${filter.field}" NOT LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}%`],
      };
    case 'null':
      return { part: `"${filter.field}" IS NULL`, values: [] };
    case 'nnull':
      return { part: `"${filter.field}" IS NOT NULL`, values: [] };
    case 'startswith':
      return { part: `"${filter.field}" LIKE ?`, values: [`${filter.value}%`] };
    case 'nstartswith':
      return {
        part: `"${filter.field}" NOT LIKE ?`,
        values: [`${filter.value}%`],
      };
    case 'startswiths':
      return {
        part: `"${filter.field}" LIKE ? COLLATE BINARY`,
        values: [`${filter.value}%`],
      };
    case 'nstartswiths':
      return {
        part: `"${filter.field}" NOT LIKE ? COLLATE BINARY`,
        values: [`${filter.value}%`],
      };
    case 'endswith':
      return { part: `"${filter.field}" LIKE ?`, values: [`%${filter.value}`] };
    case 'nendswith':
      return {
        part: `"${filter.field}" NOT LIKE ?`,
        values: [`%${filter.value}`],
      };
    case 'endswiths':
      return {
        part: `"${filter.field}" LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}`],
      };
    case 'nendswiths':
      return {
        part: `"${filter.field}" NOT LIKE ? COLLATE BINARY`,
        values: [`%${filter.value}`],
      };
    case 'between':
      return {
        part: `"${filter.field}" BETWEEN ? AND ?`,
        values: [filter.value[0], filter.value[1]],
      };
    case 'nbetween':
      return {
        part: `"${filter.field}" NOT BETWEEN ? AND ?`,
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
