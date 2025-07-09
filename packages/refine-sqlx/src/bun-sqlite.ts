import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

// TODO: transaction
export default function (db: Database): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const rows = stmt.values(...(query.args as SQLQueryBindings[]));

    return { columnNames: stmt.columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as SQLQueryBindings[]));
    return {
      changes: result.changes,
      lastInsertId: result.lastInsertRowid as number | undefined,
    };
  }
}
