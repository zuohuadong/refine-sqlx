// Cloudflare D1 types
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: {
    changed_db: boolean;
    changes: number;
    duration: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
    size_after: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Database connection types
export type DatabaseType = 'sqlite' | 'd1';

export interface DatabaseConfig {
  type: DatabaseType;
  connection: string | D1Database;
}

// Runtime environment detection
export interface RuntimeEnvironment {
  isCloudflareWorker: boolean;
  isNode: boolean;
  supportsSQLite: boolean;
}
