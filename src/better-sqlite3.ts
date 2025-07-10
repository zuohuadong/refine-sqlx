import type BetterSqlite3 from 'better-sqlite3';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

export default function (db: BetterSqlite3.Database): SqlClient {
  return { query, execute, transaction };

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

  async function transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    await execute({ sql: 'BEGIN', args: [] });
    
    try {
      const txClient: SqlClient = {
        query,
        execute
      };
      const result = await fn(txClient);
      await execute({ sql: 'COMMIT', args: [] });
      return result;
    } catch (error) {
      await execute({ sql: 'ROLLBACK', args: [] });
      throw error;
    }
  }
}
