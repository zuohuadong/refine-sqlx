// SQLite adapter that auto-detects the best driver
import type { SqlClient } from '../client.d';
import type { SQLiteOptions } from '../types/config';
import { SQLiteAdapter } from './base';
import detectSqlite from '../detect-sqlite';
import { handleErrors, logExecution } from '../utils';



class AutoSQLiteAdapter extends SQLiteAdapter {
  private connection: string | { d1Database: any };
  private schema: any;
  private detectedDriver: string = 'unknown';

  constructor(
    connection: string | { d1Database: any },
    schema?: any,
    options: SQLiteOptions = {}
  ) {
    // We'll initialize the client in connect()
    super(null as any, options);
    this.connection = connection;
    this.schema = schema;
  }

  @handleErrors('Failed to connect to SQLite')
  @logExecution
  async connect(): Promise<void> {
    if (!this.client) {
      // Handle D1 database
      if (typeof this.connection === 'object' && 'd1Database' in this.connection) {
        const createCloudflareD1Adapter = (await import('./cloudflare-d1')).default;
        this.client = createCloudflareD1Adapter(this.connection.d1Database);
        this.detectedDriver = 'd1';
      } else {
        // Auto-detect SQLite driver
        const factory = detectSqlite(this.connection as string, this.config as any);
        this.client = await factory.connect();
        
        // Detect which driver was used
        const runtime = this.detectRuntime();
        switch (runtime) {
          case 'bun':
            this.detectedDriver = 'bun:sqlite';
            break;
          case 'node':
            this.detectedDriver = 'better-sqlite3';
            break;
          default:
            this.detectedDriver = 'better-sqlite3';
        }
      }
    }
    
    await super.connect();
  }

  getDriver(): string {
    return this.detectedDriver;
  }

  private detectRuntime(): string {
    if ('Bun' in globalThis) {
      return 'bun';
    } else if ('process' in globalThis && (process as any)?.versions?.node) {
      return 'node';
    }
    return 'unknown';
  }
}