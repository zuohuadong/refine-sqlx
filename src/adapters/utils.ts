import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';

/**
 * Creates a transaction wrapper for adapters that support transactions.
 * This implements the standard SQLite transaction pattern using BEGIN/COMMIT/ROLLBACK.
 */
export function createTransactionWrapper(
  execute: (query: SqlQuery) => Promise<SqlAffected>,
  query: (query: SqlQuery) => Promise<SqlResult>,
) {
  return async function transaction<T>(
    fn: (tx: SqlClient) => Promise<T>,
  ): Promise<T> {
    await execute({ sql: 'BEGIN', args: [] });

    try {
      const txClient: SqlClient = { query, execute };
      const result = await fn(txClient);
      await execute({ sql: 'COMMIT', args: [] });
      return result;
    } catch (error) {
      await execute({ sql: 'ROLLBACK', args: [] });
      throw error;
    }
  };
}

/**
 * Converts object-based query results to row-based format.
 * Used by adapters that return results as arrays of objects (like Node.js sqlite).
 */
export function convertObjectRowsToArrayRows(
  objectRows: Record<string, any>[],
  columnNames: string[],
): unknown[][] {
  const rows: unknown[][] = [];
  for (const item of objectRows) {
    const row: unknown[] = [];
    for (const key of columnNames) {
      row.push(item[key]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Normalizes lastInsertRowid/lastInsertId property names across different SQLite implementations.
 */
export function normalizeLastInsertId(result: any): number | undefined {
  return result.lastInsertRowid ?? result.lastInsertId ?? result.last_row_id;
}

/**
 * Creates a standardized SqlAffected response from various SQLite result formats.
 */
export function createSqlAffected(result: any): SqlAffected {
  return {
    changes: result.changes,
    lastInsertId: normalizeLastInsertId(result),
  };
}

/**
 * Determines if a SQL query is a SELECT statement.
 * Used by batch operations to determine result type.
 */
export function isSelectQuery(sql: string): boolean {
  return sql.trim().toLowerCase().startsWith('select');
}
