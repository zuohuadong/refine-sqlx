// Base adapter interface compatible with refine-sqlx
import type { SqlClient } from '../client';
import type { SQLiteOptions } from '../types/config';
import { logExecution } from '../utils';

/**
 * Base adapter interface compatible with refine-sqlx
 */
export interface BaseAdapter {
  /** Get the underlying SQL client */
  getClient(): SqlClient;

  /** Connect to the database */
  connect(): Promise<void>;

  /** Disconnect from the database */
  disconnect(): Promise<void>;

  /** Check if connected */
  isConnected(): boolean;

  /** Get adapter configuration */
  getConfig(): SQLiteOptions;

  /** Get adapter type */
  getType(): 'sqlite';

  /** Get driver name */
  getDriver(): string;
}

/**
 * SQLite adapter base class
 */
export abstract class SQLiteAdapter implements BaseAdapter {
  protected client: SqlClient;
  protected config: SQLiteOptions;
  protected connected: boolean = false;

  constructor(client: SqlClient, config: SQLiteOptions = {}) {
    this.client = client;
    this.config = config;
  }

  getClient(): SqlClient {
    return this.client;
  }

  @logExecution
  async connect(): Promise<void> {
    this.connected = true;
  }

  @logExecution
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConfig(): SQLiteOptions {
    return this.config;
  }

  getType(): 'sqlite' {
    return 'sqlite';
  }

  abstract getDriver(): string;
}
