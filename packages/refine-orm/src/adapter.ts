import type { DatabaseConnection, OrmAdapter, OrmConfig, Transaction } from "./types";
import { createRuntimeConnection, convertSqlParams } from "./runtime-adapter";

export class DrizzleOrmAdapter implements OrmAdapter {
  private connection: DatabaseConnection;
  public config: OrmConfig; // 改为 public，允许外部访问
  private initPromise?: Promise<void>;

  constructor(config: OrmConfig) {
    this.config = config;
    this.initPromise = this._initConnection();
  }

  private async _initConnection(): Promise<void> {
    this.connection = await createRuntimeConnection(this.config);
  }

  private async _ensureInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = undefined;
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    await this._ensureInit();
    if (this.config.logger) {
      console.log("🔍 Query:", sql, params);
    }
    const convertedSql = convertSqlParams(sql, this.config.database);
    return await this.connection.query<T>(convertedSql, params);
  }

  async execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: any }> {
    await this._ensureInit();
    if (this.config.logger) {
      console.log("⚡ Execute:", sql, params);
    }
    const convertedSql = convertSqlParams(sql, this.config.database);
    return await this.connection.execute(convertedSql, params);
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    await this._ensureInit();
    
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
    await this._ensureInit();
    if (this.connection.close) {
      await this.connection.close();
    }
  }
}
