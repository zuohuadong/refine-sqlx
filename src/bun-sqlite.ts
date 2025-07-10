import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type { SqlAffected, SqlClient, SqlQuery, SqlResult } from './client';

export default function (db: Database): SqlClient {
  return { query, execute, transaction };

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
