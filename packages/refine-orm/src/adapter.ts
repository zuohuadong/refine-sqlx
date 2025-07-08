import type { DatabaseConnection, OrmAdapter, OrmConfig, Transaction } from "./types";

export class DrizzleOrmAdapter implements OrmAdapter {
  private connection: DatabaseConnection;
  private config: OrmConfig;

  constructor(config: OrmConfig) {
    this.config = config;
    this.connection = config.connection;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (this.config.logger) {
      console.log("🔍 Query:", sql, params);
    }
    return await this.connection.query<T>(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: any }> {
    if (this.config.logger) {
      console.log("⚡ Execute:", sql, params);
    }
    return await this.connection.execute(sql, params);
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx: Transaction = {
      query: this.query.bind(this),
      execute: this.execute.bind(this),
      commit: async () => {
        await this.execute("COMMIT");
      },
      rollback: async () => {
        await this.execute("ROLLBACK");
      }
    };

    try {
      await this.execute("BEGIN");
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection.close) {
      await this.connection.close();
    }
  }
}
