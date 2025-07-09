import type { D1Database } from '@cloudflare/workers-types';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

// TODO: batch
export default function (d1: D1Database): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const [columnNames, ...rows] = await stmt.raw({ columnNames: true });
    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const result = await stmt.run();

    return {
      changes: result.meta.changes,
      lastInsertId: result.meta.last_row_id,
    };
  }
}
