import type { DatabaseSync } from 'node:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import { createSqlAffected, createTransactionWrapper, convertObjectRowsToArrayRows } from './utils';

export default function createNodeSQLiteAdapter(db: DatabaseSync): SqlClient {
  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const result = stmt.all(...(query.args as any[]));
    const columnNames = stmt
      .columns()
      .map((e) => e.column)
      .filter(Boolean) as string[];
    
    const rows = convertObjectRowsToArrayRows(result, columnNames);

    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as any[]));
    
    return createSqlAffected(result);
  }

  const transaction = createTransactionWrapper(execute, query);

  return { query, execute, transaction };
}