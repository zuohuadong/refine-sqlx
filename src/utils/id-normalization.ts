/**
 * ID type conversion utilities
 *
 * Automatically converts ID values based on schema column types
 */

import type { Column } from 'drizzle-orm';

/**
 * Column type information for ID normalization
 */
interface ColumnTypeInfo {
  dataType: string;
  columnType: string;
}

/**
 * Extract column type information from a Drizzle column
 */
function getColumnInfo(column: Column): ColumnTypeInfo {
  const columnType = (column as any).columnType || '';
  const dataType = (column as any).dataType || '';

  return { dataType, columnType };
}

/**
 * Check if column is an integer type
 */
function isIntegerColumn(column: Column): boolean {
  const { dataType, columnType } = getColumnInfo(column);

  const integerTypes = [
    'number',
    'integer',
    'int',
    'bigint',
    'smallint',
    'tinyint',
    'mediumint',
  ];

  const integerPatterns = [
    'integer',
    'int ',
    'int(',
    'bigint',
    'smallint',
    'tinyint',
    'mediumint',
    'serial',
    'autoincrement',
  ];

  if (integerTypes.includes(dataType.toLowerCase())) {
    return true;
  }

  const lowerColumnType = columnType.toLowerCase();
  return integerPatterns.some((pattern) => lowerColumnType.includes(pattern));
}

/**
 * Check if column is a string/text type
 */
function isStringColumn(column: Column): boolean {
  const { dataType, columnType } = getColumnInfo(column);

  const stringTypes = ['string', 'text', 'varchar', 'char', 'uuid'];

  const stringPatterns = [
    'text',
    'varchar',
    'char(',
    'uuid',
    'string',
    'character',
  ];

  if (stringTypes.includes(dataType.toLowerCase())) {
    return true;
  }

  const lowerColumnType = columnType.toLowerCase();
  return stringPatterns.some((pattern) => lowerColumnType.includes(pattern));
}

/**
 * Normalize ID value based on column type
 *
 * @param column - The Drizzle column definition
 * @param id - The ID value to normalize
 * @returns Normalized ID value matching the column type
 *
 * @example
 * ```typescript
 * // For integer column
 * normalizeId(table.id, "123")  // returns 123
 * normalizeId(table.id, 123)    // returns 123
 *
 * // For string column
 * normalizeId(table.id, 123)    // returns "123"
 * normalizeId(table.id, "abc")  // returns "abc"
 * ```
 */
export function normalizeId(column: Column | undefined, id: unknown): unknown {
  if (id === null || id === undefined) {
    return id;
  }

  if (!column) {
    return id;
  }

  if (isIntegerColumn(column)) {
    if (typeof id === 'string') {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    if (typeof id === 'number') {
      return id;
    }
  }

  if (isStringColumn(column)) {
    if (typeof id === 'number') {
      return String(id);
    }
    if (typeof id === 'string') {
      return id;
    }
  }

  return id;
}

/**
 * Normalize an array of IDs based on column type
 *
 * @param column - The Drizzle column definition
 * @param ids - Array of IDs to normalize
 * @returns Array of normalized ID values
 */
export function normalizeIds(
  column: Column | undefined,
  ids: unknown[],
): unknown[] {
  if (!ids || ids.length === 0) {
    return ids;
  }

  return ids.map((id) => normalizeId(column, id));
}

/**
 * Get column from table by name
 *
 * @param table - The Drizzle table object
 * @param columnName - Name of the column
 * @returns The column or undefined if not found
 */
export function getColumn(
  table: Record<string, unknown>,
  columnName: string,
): Column | undefined {
  const column = table[columnName];
  if (column && typeof column === 'object') {
    return column as Column;
  }
  return undefined;
}
