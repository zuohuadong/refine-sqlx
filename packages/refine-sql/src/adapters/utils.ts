import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import {
  convertObjectRowsToArrayRows,
  normalizeLastInsertId,
  createSqlAffected,
  isSelectQuery,
} from '../utils';

// Re-export common utility functions
export {
  convertObjectRowsToArrayRows,
  normalizeLastInsertId,
  createSqlAffected,
  isSelectQuery,
};

/**
 * Creates a transaction wrapper for adapters that support transactions.
 * This implements the standard SQLite transaction pattern using BEGIN/COMMIT/ROLLBACK.
 */
export function createTransactionWrapper(
  execute: (query: SqlQuery) => Promise<SqlAffected>,
  query: (query: SqlQuery) => Promise<SqlResult>
) {
  return async function transaction<T>(
    fn: (tx: SqlClient) => Promise<T>
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
