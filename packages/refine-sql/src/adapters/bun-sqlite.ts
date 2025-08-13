import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client.d';
import { createSqlAffected, createTransactionWrapper } from './utils';
import { withAdapterErrorHandling } from '../utils';

export default function createBunSQLiteAdapter(db: Database): SqlClient {
  const query = withAdapterErrorHandling(async (query: SqlQuery): Promise<SqlResult> => {
    const stmt = db.prepare(query.sql);
    const rows = stmt.values(...(query.args as SQLQueryBindings[]));

    return { columnNames: stmt.columnNames, rows };
  }, 'query');

  const execute = withAdapterErrorHandling(async (query: SqlQuery): Promise<SqlAffected> => {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as SQLQueryBindings[]));

    return createSqlAffected(result);
  }, 'execute');

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}
