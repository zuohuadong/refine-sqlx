import type { D1Database } from '@cloudflare/workers-types';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import { createSqlAffected, isSelectQuery } from './utils';

export default function createCloudflareD1Adapter(d1: D1Database): SqlClient {
  return { query, execute, batch };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const [columnNames, ...rows] = await stmt.raw({ columnNames: true });
    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const result = await stmt.run();

    return createSqlAffected({
      changes: result.meta.changes,
      last_row_id: result.meta.last_row_id,
    });
  }

  async function batch(
    queries: SqlQuery[],
  ): Promise<(SqlResult | SqlAffected)[]> {
    const statements = queries.map((query) =>
      d1.prepare(query.sql).bind(query.args),
    );
    const results = await d1.batch(statements);

    return results.map((result, index) => {
      if (result.success) {
        // For SELECT queries, return SqlResult
        if (isSelectQuery(queries[index].sql)) {
          return {
            columnNames: result.meta.columns || [],
            rows: result.results || [],
          } as SqlResult;
        }
        // For INSERT/UPDATE/DELETE queries, return SqlAffected
        return createSqlAffected({
          changes: result.meta.changes,
          last_row_id: result.meta.last_row_id,
        });
      }
      throw new Error(`Batch query failed: ${result.error}`);
    });
  }
}
