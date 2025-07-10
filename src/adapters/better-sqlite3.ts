import type BetterSqlite3 from 'better-sqlite3';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import { createSqlAffected, createTransactionWrapper } from './utils';

export default function createBetterSQLite3Adapter(db: BetterSqlite3.Database): SqlClient {
  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const columns = stmt.columns();

    return {
      columnNames: columns.map((column) => column.name),
      rows: stmt.raw().all() as unknown[][],
    };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const result = stmt.run();
    
    return createSqlAffected(result);
  }

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}