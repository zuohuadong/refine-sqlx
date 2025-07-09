import type BetterSqlite3 from 'better-sqlite3';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

// TODO: transaction
export default function (db: BetterSqlite3.Database): SqlClient {
  return { query, execute };

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
    return {
      changes: result.changes,
      lastInsertId: result.lastInsertRowid as any,
    };
  }
}
