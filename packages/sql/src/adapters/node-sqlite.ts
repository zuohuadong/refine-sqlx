import type { DatabaseSync } from 'node:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import {
  createSqlAffected,
  createTransactionWrapper,
  convertObjectRowsToArrayRows,
} from './utils';
import { withAdapterErrorHandling } from '../utils';

export default function createNodeSQLiteAdapter(db: DatabaseSync): SqlClient {
  const query = withAdapterErrorHandling(
    async (query: SqlQuery): Promise<SqlResult> => {
      const stmt = db.prepare(query.sql);
      const result = stmt.all(...(query.args as any[]));
      const columnNames = stmt
        .columns()
        .map(e => e.column || e.name)
        .filter(Boolean) as string[];

      const rows = convertObjectRowsToArrayRows(result, columnNames);

      return { columnNames, rows };
    },
    'query'
  );

  const execute = withAdapterErrorHandling(
    async (query: SqlQuery): Promise<SqlAffected> => {
      const stmt = db.prepare(query.sql);
      const result = stmt.run(...(query.args as any[]));

      return createSqlAffected(result);
    },
    'execute'
  );

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}
