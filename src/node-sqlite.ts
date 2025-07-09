import type { DatabaseSync } from 'node:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

// TODO: transaction
export default function (db: DatabaseSync): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const result = stmt.all(...(query.args as any[]));
    const columnNames = stmt
      .columns()
      .map((e) => e.column)
      .filter(Boolean) as string[];
    const rows: unknown[][] = [];
    for (const item of result) {
      const row: unknown[] = [];
      for (const key in item) row.push(item[key]);
      rows.push(row);
    }

    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as any[]));
    return {
      changes: result.changes as any,
      lastInsertId: result.lastInsertRowid as any,
    };
  }
}
