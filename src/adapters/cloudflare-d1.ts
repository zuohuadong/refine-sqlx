import type { D1Database } from '@cloudflare/workers-types';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from '../client';
import { createSqlAffected, isSelectQuery } from './utils';

export default function createCloudflareD1Adapter(d1: D1Database): SqlClient {
  return { query, execute, batch, transaction };

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

    return results.map((result: any, index: number) => {
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

  /**
   * Transaction wrapper for D1 using batch API.
   * D1's batch API provides atomic transactions with automatic rollback.
   * This wrapper provides a transaction-like API for consistency with other adapters.
   */
  async function transaction<T>(
    fn: (tx: SqlClient) => Promise<T>,
  ): Promise<T> {
    // Collect all queries executed within the transaction
    const queries: SqlQuery[] = [];

    // Create a transaction client that collects queries
    const txClient: SqlClient = {
      query: async (q: SqlQuery) => {
        queries.push(q);
        // For transaction context, we return empty result
        // The actual execution happens in batch
        return { columnNames: [], rows: [] };
      },
      execute: async (q: SqlQuery) => {
        queries.push(q);
        // For transaction context, we return empty result
        return { changes: 0 };
      },
    };

    // Execute the transaction function to collect queries
    const result = await fn(txClient);

    // Execute all queries in a batch (atomic transaction)
    if (queries.length > 0) {
      await batch(queries);
    }

    return result;
  }
}
