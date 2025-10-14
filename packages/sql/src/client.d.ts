export interface SqlQuery {
  sql: string;
  args: unknown[];
}

export interface SqlResult {
  columnNames: string[];
  rows: unknown[][];
}

export interface SqlAffected {
  changes?: number;
  lastInsertId?: number | string;
}

export interface SqlClient {
  query(query: SqlQuery): Promise<SqlResult>;
  execute(query: SqlQuery): Promise<SqlAffected>;
  transaction?: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
  batch?: (query: SqlQuery[]) => Promise<(SqlResult | SqlAffected)[]>;
}

export interface SqlClientFactory {
  connect(): Promise<SqlClient>;
}
