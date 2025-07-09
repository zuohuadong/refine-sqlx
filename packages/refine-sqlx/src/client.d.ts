export interface SqlQuery {
  sql: string;
  args: unknown[];
}

export interface SqlResult {
  columnNames: string[];
  rows: unknown[][];
}

export interface SqlClient {
  query(query: SqlQuery): Promise<SqlResult>;
  execute(query: SqlQuery): Promise<number>;
}

export interface SqlClientFactory {
  connect(): Promise<SqlClient>;
}
