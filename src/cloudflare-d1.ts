import type { D1Database } from '@cloudflare/workers-types';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

export default function (d1: D1Database): SqlClient {
  return { query, execute, batch };

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

  async function batch(queries: SqlQuery[]): Promise<(SqlResult | SqlAffected)[]> {
    const statements = queries.map(query => d1.prepare(query.sql).bind(query.args));
    const results = await d1.batch(statements);
    
    return results.map((result, index) => {
      if (result.success) {
        // For SELECT queries, return SqlResult
        if (queries[index].sql.trim().toLowerCase().startsWith('select')) {
          return {
            columnNames: result.meta.columns || [],
            rows: result.results || []
          } as SqlResult;
        }
        // For INSERT/UPDATE/DELETE queries, return SqlAffected
        return {
          changes: result.meta.changes,
          lastInsertId: result.meta.last_row_id,
        } as SqlAffected;
      }
      throw new Error(`Batch query failed: ${result.error}`);
    });
  }
}
