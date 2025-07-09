import { DataProvider } from '@refinedev/core';
import { Database } from 'bun:sqlite';
import { DatabaseSyncOptions, DatabaseSync } from 'node:sqlite';
import BetterSqlite3 from 'better-sqlite3';
import { D1Database } from '@cloudflare/workers-types';

interface SqlQuery {
  sql: string;
  args: unknown[];
}

interface SqlResult {
  columnNames: string[];
  rows: unknown[][];
}

interface SqlAffected {
  changes?: number;
  lastInsertId?: number | string;
}

interface SqlClient {
  query(query: SqlQuery): Promise<SqlResult>;
  execute(query: SqlQuery): Promise<SqlAffected>;
  transaction?: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
  batch?: (query: SqlQuery[]) => Promise<(SqlResult | SqlAffected)[]>;
}

interface SqlClientFactory {
  connect(): Promise<SqlClient>;
}

type SQLiteOptions = {
    bun?: ConstructorParameters<typeof Database>['1'];
    node?: DatabaseSyncOptions;
    'better-sqlite3'?: BetterSqlite3.Options;
};

declare function export_default(client: SqlClient): DataProvider;
declare function export_default(factory: SqlClientFactory): DataProvider;
declare function export_default(path: ':memory:', options?: SQLiteOptions): DataProvider;
declare function export_default(path: string, options?: SQLiteOptions): DataProvider;
declare function export_default(db: D1Database): DataProvider;
declare function export_default(db: Database): DataProvider;
declare function export_default(db: DatabaseSync): DataProvider;
declare function export_default(db: BetterSqlite3.Database): DataProvider;

export { export_default as createRefineSQLite };
export type { SqlAffected, SqlClient, SqlClientFactory, SqlQuery, SqlResult };
