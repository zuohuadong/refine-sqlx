import type { Table } from 'drizzle-orm';

// Dynamic imports for database drivers
let drizzleSqlite: any;
let drizzleBun: any;
let drizzleD1: any;
let BetterSqlite3Database: any;
let BunSQLiteDatabase: any;
let D1Database: any;

import {
  BaseDatabaseAdapter,
  LogDatabaseOperation,
  RetryOnFailure,
} from './base.js';
import type {
  DatabaseConfig,
  SQLiteOptions,
  ConnectionOptions,
} from '../types/config.js';
import type { DrizzleClient, RefineOrmDataProvider } from '../types/client.js';
import { ConnectionError, ConfigurationError } from '../types/errors.js';
import { createProvider } from '../core/data-provider.js';
import {
  detectBunRuntime,
  detectBunSqlSupport,
  getRuntimeConfig,
  checkDriverAvailability,
  detectCloudflareD1,
} from '../utils/runtime-detection.js';

/**
 * SQLite database adapter with runtime detection
 * Supports Bun (bun:sqlite), Node.js (better-sqlite3), and Cloudflare D1 environments
 */
export class SQLiteAdapter<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends BaseDatabaseAdapter<TSchema> {
  private connection: any = null;
  private runtimeConfig = getRuntimeConfig('sqlite');

  constructor(config: DatabaseConfig<TSchema>) {
    super(config);
    this.validateConfig();
  }

  /**
   * Establish connection to SQLite database
   * Uses runtime detection to choose appropriate driver
   */
  @LogDatabaseOperation
  @RetryOnFailure(3, 1000)
  async connect(): Promise<void> {
    try {
      if (this.runtimeConfig.runtime === 'cloudflare-d1') {
        await this.connectWithD1();
      } else if (
        this.runtimeConfig.runtime === 'bun' &&
        this.runtimeConfig.supportsNativeDriver
      ) {
        await this.connectWithBunSqlite();
      } else {
        await this.connectWithBetterSqlite3();
      }

      this.isConnected = true;

      if (this.config.debug) {
        console.log(
          `[RefineORM] Connected to SQLite using ${this.runtimeConfig.driver}`
        );
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to SQLite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using Bun's native SQLite driver
   */
  private async connectWithBunSqlite(): Promise<void> {
    if (
      typeof Bun === 'undefined' ||
      typeof (Bun as any).sqlite !== 'function'
    ) {
      throw new ConnectionError(
        'Bun SQLite is not available in this environment'
      );
    }

    const dbPath = this.getDatabasePath();

    try {
      // Dynamic import for Bun SQLite
      const { Database } = await import('bun:sqlite');
      this.connection = new Database(dbPath);

      // Dynamic import for drizzle-orm/bun-sqlite
      if (!drizzleBun) {
        const drizzleModule = await import('drizzle-orm/bun-sqlite');
        drizzleBun = drizzleModule.drizzle;
      }

      // Create drizzle client with Bun SQLite
      this.client = drizzleBun(this.connection, {
        schema: this.config.schema,
        logger: this.config.debug,
        casing: 'snake_case',
      }) as DrizzleClient<TSchema>;
      
      // Manually assign schema if it's missing from Drizzle client
      if (!this.client.schema) {
        (this.client as any).schema = this.config.schema;
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize Bun SQLite connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using better-sqlite3 driver
   */
  private async connectWithBetterSqlite3(): Promise<void> {
    // Check if better-sqlite3 driver is available
    if (!(await checkDriverAvailability('better-sqlite3'))) {
      throw new ConnectionError(
        'better-sqlite3 driver is not available. Please install it with: npm install better-sqlite3'
      );
    }

    try {
      const Database = await import('better-sqlite3');
      const dbPath = this.getDatabasePath();

      // Dynamic import for drizzle-orm/better-sqlite3
      if (!drizzleSqlite) {
        const drizzleModule = await import('drizzle-orm/better-sqlite3');
        drizzleSqlite = drizzleModule.drizzle;
      }

      // Create better-sqlite3 connection with options
      const sqliteOptions = this.getSqliteOptions();
      this.connection = new Database.default(dbPath, sqliteOptions);

      // Create drizzle client with better-sqlite3
      this.client = drizzleSqlite(this.connection, {
        schema: this.config.schema,
        logger: this.config.debug,
        casing: 'snake_case',
      }) as DrizzleClient<TSchema>;
      
      // Manually assign schema if it's missing from Drizzle client
      if (!this.client.schema) {
        (this.client as any).schema = this.config.schema;
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize better-sqlite3 connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using Cloudflare D1 driver
   */
  private async connectWithD1(): Promise<void> {
    if (!detectCloudflareD1()) {
      throw new ConnectionError(
        'Cloudflare D1 is not available in this environment'
      );
    }

    try {
      // Dynamic import for drizzle-orm/d1
      if (!drizzleD1) {
        const drizzleModule = await import('drizzle-orm/d1');
        drizzleD1 = drizzleModule.drizzle;
      }

      // Get D1 database instance from connection config
      if (
        typeof this.config.connection !== 'object' ||
        !('d1Database' in this.config.connection)
      ) {
        throw new ConnectionError(
          'D1 database instance is required for Cloudflare D1 connection'
        );
      }

      const d1Database = (this.config.connection as any).d1Database;
      this.connection = d1Database;

      // Create drizzle client with D1
      this.client = drizzleD1(this.connection, {
        schema: this.config.schema,
        logger: this.config.debug,
        casing: 'snake_case',
      }) as DrizzleClient<TSchema>;
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize Cloudflare D1 connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get SQLite-specific connection options
   */
  private getSqliteOptions(): Record<string, any> {
    const options: Record<string, any> = {};

    if (typeof this.config.connection === 'object') {
      const connOptions = this.config.connection as ConnectionOptions & {
        readonly?: boolean;
        fileMustExist?: boolean;
        timeout?: number;
        verbose?: boolean;
      };

      if (connOptions['readonly'] !== undefined) {
        options.readonly = connOptions['readonly'];
      }

      if (connOptions['fileMustExist'] !== undefined) {
        options.fileMustExist = connOptions['fileMustExist'];
      }

      if (connOptions['timeout'] !== undefined) {
        options.timeout = connOptions['timeout'];
      }

      if (connOptions['verbose'] !== undefined) {
        options.verbose = connOptions['verbose'];
      }
    }

    return options;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        if (this.runtimeConfig.driver === 'better-sqlite3') {
          // better-sqlite3 connection
          this.connection.close();
        }
        // Bun SQLite and D1 connections are automatically managed

        this.connection = null;
        this.client = null;
        this.isConnected = false;

        if (this.config.debug) {
          console.log('[RefineORM] Disconnected from SQLite');
        }
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to disconnect from SQLite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }

      // Execute a simple query to test connection
      if (this.runtimeConfig.driver === 'bun:sqlite') {
        // For Bun SQLite, execute a simple SELECT 1
        this.connection.query('SELECT 1').get();
      } else if (this.runtimeConfig.driver === 'd1') {
        // For D1, execute a simple SELECT 1
        await this.connection.prepare('SELECT 1').first();
      } else {
        // For better-sqlite3, use prepare and get
        this.connection.prepare('SELECT 1').get();
      }

      return true;
    } catch (error) {
      if (this.config.debug) {
        console.error('[RefineORM] SQLite health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Get database path from configuration
   */
  protected getDatabasePath(): string {
    if (typeof this.config.connection === 'string') {
      return this.config.connection;
    }

    if (typeof this.config.connection === 'object') {
      const conn = this.config.connection as ConnectionOptions & {
        filename?: string;
        path?: string;
      };

      if (conn.filename) {
        return conn.filename;
      }

      if (conn.path) {
        return conn.path;
      }

      if (conn.database) {
        return conn.database;
      }
    }

    throw new ConfigurationError(
      'SQLite connection requires a database path or filename'
    );
  }

  /**
   * Validate SQLite-specific configuration
   */
  protected override validateConfig(): void {
    super.validateConfig();

    if (this.config.type !== 'sqlite') {
      throw new ConfigurationError('Invalid database type for SQLite adapter');
    }

    // For D1, we need a D1 database instance
    if (detectCloudflareD1()) {
      if (
        typeof this.config.connection !== 'object' ||
        !('d1Database' in this.config.connection)
      ) {
        throw new ConfigurationError(
          'D1 database instance is required for Cloudflare D1 connection'
        );
      }
    }
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.client || !this.connection) {
      throw new ConnectionError('No active SQLite connection');
    }

    try {
      // For SQLite with better-sqlite3 or similar drivers
      if (this.connection && typeof this.connection.prepare === 'function') {
        const stmt = this.connection.prepare(sql);
        if (
          sql.trim().toLowerCase().startsWith('select') ||
          sql.trim().toLowerCase().startsWith('with')
        ) {
          return stmt.all(params || []) as T[];
        } else {
          const result = stmt.run(params || []);
          return [result] as T[];
        }
      }

      // Fallback for other SQLite implementations
      console.warn('SQLite raw query execution: Using basic implementation');
      return [] as T[];
    } catch (error) {
      throw new ConnectionError(
        `Failed to execute raw SQLite query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Begin database transaction
   */
  async beginTransaction(): Promise<void> {
    // Implementation depends on the specific driver being used
    // This is a basic implementation that should be extended
  }

  /**
   * Commit database transaction
   */
  async commitTransaction(): Promise<void> {
    // Implementation depends on the specific driver being used
    // This is a basic implementation that should be extended
  }

  /**
   * Rollback database transaction
   */
  async rollbackTransaction(): Promise<void> {
    // Implementation depends on the specific driver being used
    // This is a basic implementation that should be extended
  }

  /**
   * Get adapter-specific information
   */
  override getAdapterInfo(): {
    type: 'sqlite';
    runtime: string;
    driver: string;
    supportsNativeDriver: boolean;
    isConnected: boolean;
  } {
    return {
      type: 'sqlite',
      runtime: this.runtimeConfig.runtime,
      driver: this.runtimeConfig.driver,
      supportsNativeDriver: this.runtimeConfig.supportsNativeDriver,
      isConnected: this.isConnected,
    };
  }
} 

/**
 * Factory function to create SQLite data provider
 * Automatically detects runtime and uses appropriate driver
 */
export async function createSQLiteProvider<
  TSchema extends Record<string, Table>,
>(
  config: {
    connection: string | ConnectionOptions | { d1Database: any };
    schema: TSchema;
    options?: SQLiteOptions;
  }
): Promise<RefineOrmDataProvider<TSchema>>;

export async function createSQLiteProvider<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions | { d1Database: any },
  schema: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>>;

export async function createSQLiteProvider<
  TSchema extends Record<string, Table>,
>(
  configOrConnection:
    | {
        connection: string | ConnectionOptions | { d1Database: any };
        schema: TSchema;
        options?: SQLiteOptions;
      }
    | string
    | ConnectionOptions
    | { d1Database: any },
  schema?: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  let connection: string | ConnectionOptions | { d1Database: any };
  let finalSchema: TSchema;
  let finalOptions: SQLiteOptions | undefined;

  // Handle both object and separate parameter signatures
  if (
    typeof configOrConnection === 'object' &&
    configOrConnection !== null &&
    'connection' in configOrConnection &&
    'schema' in configOrConnection
  ) {
    // Object signature
    connection = configOrConnection.connection;
    finalSchema = configOrConnection.schema;
    finalOptions = configOrConnection.options;
  } else {
    // Separate parameters signature
    if (!schema) {
      throw new Error('Schema is required when using separate parameters');
    }
    connection = configOrConnection as string | ConnectionOptions | { d1Database: any };
    finalSchema = schema;
    finalOptions = options;
  }

  const dbConfig: DatabaseConfig<TSchema> = {
    type: 'sqlite',
    connection,
    schema: finalSchema,
    ...(finalOptions?.debug !== undefined && { debug: finalOptions.debug }),
    ...(finalOptions?.logger && { logger: finalOptions.logger }),
  };

  const adapter = new SQLiteAdapter(dbConfig);
  await adapter.connect();

  const provider = createProvider(adapter, finalOptions);
  return provider;
}

/**
 * Create SQLite provider with explicit Bun SQLite driver
 */
export async function createSQLiteProviderWithBunSqlite<
  TSchema extends Record<string, Table>,
>(
  databasePath: string,
  schema: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  if (!detectBunRuntime() || !detectBunSqlSupport('sqlite')) {
    throw new ConfigurationError(
      'Bun SQLite is not available in this environment'
    );
  }

  const config: DatabaseConfig<TSchema> = {
    type: 'sqlite',
    connection: databasePath,
    schema,
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new SQLiteAdapter(config);
  await adapter.connect();
  return createProvider(adapter, options);
}

/**
 * Create SQLite provider with explicit better-sqlite3 driver
 */
export async function createSQLiteProviderWithBetterSqlite3<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  const config: DatabaseConfig<TSchema> = {
    type: 'sqlite',
    connection,
    schema,
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new SQLiteAdapter(config);
  await adapter.connect();
  return createProvider(adapter, options);
}

/**
 * Create SQLite provider with Cloudflare D1 driver
 */
export async function createSQLiteProviderWithD1<
  TSchema extends Record<string, Table>,
>(
  d1Database: any,
  schema: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  if (!detectCloudflareD1()) {
    throw new ConfigurationError(
      'Cloudflare D1 is not available in this environment'
    );
  }

  const config: DatabaseConfig<TSchema> = {
    type: 'sqlite',
    connection: { d1Database },
    schema,
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new SQLiteAdapter(config);
  await adapter.connect();
  return createProvider(adapter, options);
}
