import type * as BetterSqlite3 from 'better-sqlite3';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client.d';
import { createSqlAffected, createTransactionWrapper } from './utils';
import { withAdapterErrorHandling } from '../utils';

export default function createBetterSQLite3Adapter(
  db: BetterSqlite3.Database
): SqlClient {
  const query = withAdapterErrorHandling(async (query: SqlQuery): Promise<SqlResult> => {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const columns = stmt.columns();

    return {
      columnNames: columns.map(column => column.name),
      rows: stmt.raw().all() as unknown[][],
    };
  }, 'query');

  const execute = withAdapterErrorHandling(async (query: SqlQuery): Promise<SqlAffected> => {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const result = stmt.run();

    return createSqlAffected(result);
  }, 'execute');

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}
