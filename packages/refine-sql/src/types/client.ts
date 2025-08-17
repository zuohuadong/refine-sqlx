// Modern client types for refine-sql
import type { DataProvider } from '@refinedev/core';

/**
 * Simplified data provider interface
 */
export interface ModernDataProvider extends DataProvider {
  // Core query methods
  raw<T = any>(sql: string, bindings?: any[]): Promise<T[]>;
  
  // Transaction management
  transaction<TResult>(callback: (provider: ModernDataProvider) => Promise<TResult>): Promise<TResult>;
}

// Re-export from client.d.ts
export type { SqlQuery, SqlResult, SqlAffected, SqlClient, SqlClientFactory } from '../client';