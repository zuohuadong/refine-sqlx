import type { Table } from 'drizzle-orm';

// Dynamic imports for database drivers
let drizzlePostgres: any;
let drizzleBun: any;
let postgres: any;
let PostgresJsDatabase: any;
let BunSQLDatabase: any;

import {
  BaseDatabaseAdapter,
  LogDatabaseOperation,
  RetryOnFailure,
} from './base';
import type {
  DatabaseConfig,
  PostgreSQLOptions,
  ConnectionOptions,
} from '../types/config';
import type { DrizzleClient, RefineOrmDataProvider } from '../types/client';
import {
  ConnectionError,
  ConfigurationError,
  QueryError,
} from '../types/errors';
import { createProvider } from '../core/data-provider';
import {
  detectBunRuntime,
  detectBunSqlSupport,
  getRuntimeConfig,
  checkDriverAvailability,
} from '../utils/runtime-detection';

/**
 * PostgreSQL database adapter with runtime detection
 * Supports both Bun (bun:sql) and Node.js (postgres) environments
 */
export class PostgreSQLAdapter<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends BaseDatabaseAdapter<TSchema> {
  private connection: any = null;
  private runtimeConfig = getRuntimeConfig('postgresql');

  constructor(config: DatabaseConfig<TSchema>) {
    super(config);
    this.validateConfig();
  }

  /**
   * Establish connection to PostgreSQL database
   * Uses runtime detection to choose appropriate driver
   */
  @LogDatabaseOperation
  @RetryOnFailure(3, 2000)
  async connect(): Promise<void> {
    try {
      if (
        this.runtimeConfig.runtime === 'bun' &&
        this.runtimeConfig.supportsNativeDriver
      ) {
        await this.connectWithBunSql();
      } else {
        await this.connectWithPostgresJs();
      }

      this.isConnected = true;

      if (this.config.debug) {
        console.log(
          `[RefineORM] Connected to PostgreSQL using ${this.runtimeConfig.driver}`
        );
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to PostgreSQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using Bun's native SQL driver
   */
  private async connectWithBunSql(): Promise<void> {
    if (typeof Bun === 'undefined' || typeof Bun.sql !== 'function') {
      throw new ConnectionError('Bun SQL is not available in this environment');
    }

    const connectionString = this.getConnectionString();

    try {
      // Dynamic import for Bun SQL
      let sql: any;
      try {
        // @ts-ignore - Dynamic import for bun:sql
        const bunSql = await import('bun:sql');
        sql = bunSql.sql;
      } catch {
        throw new ConnectionError('bun:sql module not available');
      }
      this.connection = sql(connectionString);

      // For Bun, fall back to using standard postgres driver
      if (!drizzlePostgres) {
        const drizzleModule = await import('drizzle-orm/postgres-js');
        drizzlePostgres = drizzleModule.drizzle;
      }

      // Import postgres driver
      if (!postgres) {
        const postgresModule = await import('postgres');
        postgres = postgresModule.default;
      }

      // Create connection with postgres driver
      const pgConnection = postgres(connectionString);

      // Create drizzle client with postgres connection
      this.client = drizzlePostgres(pgConnection, {
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
        `Failed to initialize Bun SQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using postgres-js driver
   */
  private async connectWithPostgresJs(): Promise<void> {
    // Check if postgres driver is available
    if (!(await checkDriverAvailability('postgres'))) {
      throw new ConnectionError(
        'postgres driver is not available. Please install it with: npm install postgres'
      );
    }

    try {
      const postgres = await import('postgres');
      const connectionString = this.getConnectionString();

      // Dynamic import for drizzle-orm/postgres-js
      if (!drizzlePostgres) {
        const drizzleModule = await import('drizzle-orm/postgres-js');
        drizzlePostgres = drizzleModule.drizzle;
      }

      // Create postgres connection with optimized pool configuration
      const poolConfig = this.getOptimizedPoolConfig();
      this.connection =
        (postgres as any).default ?
          (postgres as any).default(connectionString, {
            max: poolConfig.max,
            idle_timeout: poolConfig.idle_timeout,
            connect_timeout: poolConfig.connect_timeout,
            ssl: this.config.ssl || false,
            ...this.getPostgresSpecificOptions(),
          })
        : (postgres as any)(connectionString, {
            max: poolConfig.max,
            idle_timeout: poolConfig.idle_timeout,
            connect_timeout: poolConfig.connect_timeout,
            ssl: this.config.ssl || false,
            ...this.getPostgresSpecificOptions(),
          });

      // Create drizzle client with postgres-js
      this.client = drizzlePostgres(this.connection, {
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
        `Failed to initialize postgres-js connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get optimized pool configuration for PostgreSQL
   */
  private getOptimizedPoolConfig(): {
    max: number;
    idle_timeout: number;
    connect_timeout: number;
  } {
    const userPoolConfig = this.config.pool || {};

    // Default optimized values for PostgreSQL
    const defaults = {
      max: 20,
      idle_timeout: 300, // 5 minutes
      connect_timeout: 60, // 1 minute
    };

    // Apply user overrides
    return {
      max: userPoolConfig.max || defaults.max,
      idle_timeout:
        userPoolConfig.idleTimeoutMillis ?
          userPoolConfig.idleTimeoutMillis / 1000
        : defaults.idle_timeout,
      connect_timeout:
        userPoolConfig.acquireTimeoutMillis ?
          userPoolConfig.acquireTimeoutMillis / 1000
        : defaults.connect_timeout,
    };
  }

  /**
   * Get PostgreSQL-specific connection options
   */
  private getPostgresSpecificOptions(): Record<string, any> {
    const options: Record<string, any> = {};

    if (typeof this.config.connection === 'object') {
      const connOptions = this.config.connection as ConnectionOptions;

      if (connOptions.ssl) {
        options.ssl = connOptions.ssl;
      }
    }

    // Add PostgreSQL performance optimizations
    options['prepare'] = false; // Disable prepared statements by default for better performance with connection pooling
    options['transform'] = undefined; // Disable automatic transformations for better performance

    return options;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        if (this.runtimeConfig.driver === 'postgres') {
          // postgres-js connection
          await this.connection.end();
        }
        // Bun SQL connections are automatically managed

        this.connection = null;
        this.client = null;
        this.isConnected = false;

        if (this.config.debug) {
          console.log('[RefineORM] Disconnected from PostgreSQL');
        }
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to disconnect from PostgreSQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      if (this.runtimeConfig.driver === 'bun:sql') {
        // For Bun SQL, execute a simple SELECT 1
        await this.connection.query('SELECT 1');
      } else {
        // For postgres-js, use the connection's built-in method
        await this.connection`SELECT 1`;
      }

      return true;
    } catch (error) {
      if (this.config.debug) {
        console.error('[RefineORM] PostgreSQL health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Get connection string from configuration
   */
  protected override getConnectionString(): string {
    if (typeof this.config.connection === 'string') {
      return this.config.connection;
    }

    if (typeof this.config.connection === 'object') {
      const conn = this.config.connection as ConnectionOptions;

      if (conn.connectionString) {
        return conn.connectionString;
      }

      // Build connection string from components
      const {
        host = 'localhost',
        port = 5432,
        user,
        password,
        database,
      } = conn;

      if (!user || !database) {
        throw new ConfigurationError(
          'PostgreSQL connection requires user and database'
        );
      }

      const auth = password ? `${user}:${password}` : user;
      return `postgresql://${auth}@${host}:${port}/${database}`;
    }

    throw new ConfigurationError('Invalid PostgreSQL connection configuration');
  }

  /**
   * Validate PostgreSQL-specific configuration
   */
  protected override validateConfig(): void {
    super.validateConfig();

    if (this.config.type !== 'postgresql') {
      throw new ConfigurationError(
        'Invalid database type for PostgreSQL adapter'
      );
    }
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.connection) {
      throw new ConnectionError('No active PostgreSQL connection');
    }

    console.log('Executing raw SQL:', sql, 'with params:', params);

    try {
      // For postgres-js driver
      if (this.runtimeConfig.driver === 'postgres') {
        let result;
        if (params && params.length > 0) {
          // Use parameterized query if params are provided
          // postgres-js doesn't support positional parameters directly,
          // so we need to convert to template literal
          result = await this.connection.unsafe(sql, params);
        } else {
          // Use template literal for queries without parameters
          result = await this.connection.unsafe(sql);
        }
        return result as T[];
      }

      // For other drivers (fallback)
      throw new Error(
        `executeRaw not implemented for driver: ${this.runtimeConfig.driver}`
      );
    } catch (error) {
      throw new QueryError(
        `Failed to execute raw SQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Begin database transaction
   */
  async beginTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active PostgreSQL connection');
    }

    try {
      // For postgres-js, execute BEGIN command using sql template
      await this.connection`BEGIN`;
    } catch (error) {
      throw new ConnectionError(
        `Failed to begin PostgreSQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Commit database transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active PostgreSQL connection');
    }

    try {
      // For postgres-js, execute COMMIT command using sql template
      await this.connection`COMMIT`;
    } catch (error) {
      throw new ConnectionError(
        `Failed to commit PostgreSQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rollback database transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active PostgreSQL connection');
    }

    try {
      // For postgres-js, execute ROLLBACK command using sql template
      await this.connection`ROLLBACK`;
    } catch (error) {
      throw new ConnectionError(
        `Failed to rollback PostgreSQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get adapter-specific information
   */
  override getAdapterInfo(): {
    type: 'postgresql';
    runtime: string;
    driver: string;
    supportsNativeDriver: boolean;
    isConnected: boolean;
    futureSupport: { bunSql: boolean };
  } {
    return {
      type: 'postgresql',
      runtime: this.runtimeConfig.runtime,
      driver: this.runtimeConfig.driver,
      supportsNativeDriver: this.runtimeConfig.supportsNativeDriver,
      isConnected: this.isConnected,
      futureSupport: { bunSql: this.runtimeConfig.runtime === 'bun' },
    };
  }
}

/**
 * Factory function to create PostgreSQL data provider
 * Automatically detects runtime and uses appropriate driver
 */
export async function createPostgreSQLProvider<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  options?: PostgreSQLOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  const config: DatabaseConfig<TSchema> = {
    type: 'postgresql',
    connection,
    schema,
    ...(options?.pool && { pool: options.pool }),
    ...(options?.ssl && { ssl: options.ssl }),
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new PostgreSQLAdapter(config);
  await adapter.connect();
  return createProvider(adapter, options);
}

/**
 * Create PostgreSQL provider with explicit Bun SQL driver
 */
export async function createPostgreSQLProviderWithBunSql<
  TSchema extends Record<string, Table>,
>(
  connectionString: string,
  schema: TSchema,
  options?: PostgreSQLOptions
): Promise<PostgreSQLAdapter<TSchema>> {
  if (!detectBunRuntime() || !detectBunSqlSupport('postgresql')) {
    throw new ConfigurationError(
      'Bun SQL is not available for PostgreSQL in this environment'
    );
  }

  const config: DatabaseConfig<TSchema> = {
    type: 'postgresql',
    connection: connectionString,
    schema,
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new PostgreSQLAdapter(config);
  await adapter.connect();
  return adapter;
}

/**
 * Create PostgreSQL provider with explicit postgres-js driver
 */
export async function createPostgreSQLProviderWithPostgresJs<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  options?: PostgreSQLOptions
): Promise<PostgreSQLAdapter<TSchema>> {
  const config: DatabaseConfig<TSchema> = {
    type: 'postgresql',
    connection,
    schema,
    ...(options?.pool && { pool: options.pool }),
    ...(options?.ssl && { ssl: options.ssl }),
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new PostgreSQLAdapter(config);
  await adapter.connect();
  return adapter;
}
