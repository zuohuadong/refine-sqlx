import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import { createSqlAffected, createTransactionWrapper } from './utils';

export default function createBunSQLiteAdapter(db: Database): SqlClient {
  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const rows = stmt.values(...(query.args as SQLQueryBindings[]));

    return { columnNames: stmt.columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as SQLQueryBindings[]));
    
    return createSqlAffected(result);
  }

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}