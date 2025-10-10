import type { Table } from 'drizzle-orm';

// Dynamic imports for database drivers
let drizzleMySQL: any;

import {
  BaseDatabaseAdapter,
  LogDatabaseOperation,
  RetryOnFailure,
} from './base';
import type {
  DatabaseConfig,
  MySQLOptions,
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
  getRuntimeConfig,
  checkDriverAvailability,
} from '../utils/runtime-detection';

/**
 * MySQL database adapter with runtime detection
 * Supports both Bun (bun:sql) and Node.js (mysql2) environments
 * Uses bun:sql for Bun runtime when available (Bun 1.2.21+)
 */
export class MySQLAdapter<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends BaseDatabaseAdapter<TSchema> {
  private connection: any = null;
  private runtimeConfig = getRuntimeConfig('mysql');
  private actualDriver: 'mysql2' | 'bun:sql' = 'mysql2'; // Track actual driver in use

  constructor(config: DatabaseConfig<TSchema>) {
    super(config);
    this.validateConfig();
  }

  /**
   * Establish connection to MySQL database
   * Uses bun:sql for Bun runtime (1.2.21+) or mysql2 for other environments
   */
  @LogDatabaseOperation
  @RetryOnFailure(3, 2000)
  async connect(): Promise<void> {
    try {
      // Check for bun:sql MySQL support (available since Bun 1.2.21)
      if (
        this.runtimeConfig.runtime === 'bun' &&
        (await this.checkBunSqlMySQLSupport())
      ) {
        try {
          await this.connectWithBunSql();
          this.actualDriver = 'bun:sql';
        } catch (bunSqlError) {
          // Fallback to mysql2 if bun:sql is not available
          if (this.config.debug) {
            console.log(
              '[RefineORM] Bun SQL not available, falling back to mysql2'
            );
          }
          await this.connectWithMySQL2();
          this.actualDriver = 'mysql2';
        }
      } else {
        await this.connectWithMySQL2();
        this.actualDriver = 'mysql2';
      }

      this.isConnected = true;

      if (this.config.debug) {
        console.log(
          `[RefineORM] Connected to MySQL using ${this.actualDriver}`
        );
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to MySQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using Bun's native SQL driver (available since Bun 1.2.21)
   */
  private async connectWithBunSql(): Promise<void> {
    try {
      // @ts-expect-error - Dynamic import for bun:sql
      const bunSql = await import('bun:sql');
      const sql = bunSql.sql;

      if (!sql) {
        throw new ConnectionError('bun:sql module not available');
      }

      // Create connection using Bun's SQL
      const connectionString = this.getConnectionString();
      this.connection = sql(connectionString);

      // Dynamic import for drizzle-orm/mysql2 (compatible with bun:sql)
      if (!drizzleMySQL) {
        const drizzleModule = await import('drizzle-orm/mysql2');
        // eslint-disable-next-line require-atomic-updates
        drizzleMySQL = drizzleModule.drizzle;
      }

      // Create drizzle client with bun:sql connection
      this.client = drizzleMySQL(this.connection, {
        schema: this.config.schema,
        mode: 'default',
        logger: this.config.debug,
        casing: 'snake_case',
      }) as DrizzleClient<TSchema>;

      // Manually assign schema if it's missing from Drizzle client
      if (!this.client.schema) {
        (this.client as any).schema = this.config.schema;
      }

      if (this.config.debug) {
        console.log('[RefineORM] Connected to MySQL using bun:sql');
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize bun:sql MySQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Connect using mysql2 driver
   */
  private async connectWithMySQL2(): Promise<void> {
    // Check if mysql2 driver is available
    if (!(await checkDriverAvailability('mysql2'))) {
      throw new ConnectionError(
        'mysql2 driver is not available. Please install it with: npm install mysql2'
      );
    }

    try {
      const mysql = await import('mysql2/promise');
      const createConnection =
        mysql.default?.createConnection || mysql.createConnection;
      const createPool = mysql.default?.createPool || mysql.createPool;

      // Dynamic import for drizzle-orm/mysql2
      if (!drizzleMySQL) {
        const drizzleModule = await import('drizzle-orm/mysql2');
        // eslint-disable-next-line require-atomic-updates
        drizzleMySQL = drizzleModule.drizzle;
      }

      // Create MySQL connection with optimized pool configuration
      const connectionConfig = this.getMySQLConnectionConfig();
      const poolConfig = this.getOptimizedPoolConfig();

      if (this.config.pool || poolConfig.usePool) {
        // Create optimized connection pool
        this.connection = createPool({
          ...connectionConfig,
          connectionLimit: poolConfig.connectionLimit,
          connectTimeout: poolConfig.timeout, // Use connectTimeout for pool config
          waitForConnections: true,
          queueLimit: poolConfig.queueLimit,
          // MySQL-specific optimizations
          multipleStatements: false,
          dateStrings: false,
          supportBigNumbers: true,
          bigNumberStrings: false,
          // Remove idleTimeout as it's not a standard mysql2 pool option
          // enableKeepAlive and keepAliveInitialDelay are also not standard
        });
      } else {
        // Create single connection with optimizations
        this.connection = await createConnection({
          ...connectionConfig,
          connectTimeout: 60000, // 60 seconds for single connection
          multipleStatements: false,
          dateStrings: false,
          supportBigNumbers: true,
          bigNumberStrings: false,
        });
      }

      // Create drizzle client with mysql2
      this.client = drizzleMySQL(this.connection, {
        schema: this.config.schema,
        mode: 'default',
        logger: this.config.debug,
        casing: 'snake_case',
      }) as DrizzleClient<TSchema>;

      // Manually assign schema if it's missing from Drizzle client
      if (!this.client.schema) {
        (this.client as any).schema = this.config.schema;
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize mysql2 connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get optimized pool configuration for MySQL
   */
  private getOptimizedPoolConfig(): {
    usePool: boolean;
    connectionLimit: number;
    acquireTimeout: number;
    timeout: number;
    idleTimeout: number;
    queueLimit: number;
  } {
    const userPoolConfig = this.config.pool || {};

    // Default optimized values for MySQL
    const defaults = {
      usePool: true, // Always use pool for better performance
      connectionLimit: 15, // MySQL handles fewer connections than PostgreSQL
      acquireTimeout: 45000, // 45 seconds
      timeout: 60000, // 1 minute
      idleTimeout: 600000, // 10 minutes
      queueLimit: 0, // No limit on queue
    };

    return {
      usePool: this.config.pool !== undefined || defaults.usePool,
      connectionLimit: userPoolConfig.max || defaults.connectionLimit,
      acquireTimeout:
        userPoolConfig.acquireTimeoutMillis || defaults.acquireTimeout,
      timeout: userPoolConfig.createTimeoutMillis || defaults.timeout,
      idleTimeout: userPoolConfig.idleTimeoutMillis || defaults.idleTimeout,
      queueLimit: defaults.queueLimit,
    };
  }

  /**
   * Get MySQL-specific connection configuration
   */
  private getMySQLConnectionConfig(): any {
    const config: any = {};

    if (typeof this.config.connection === 'string') {
      // For connection string, return it directly - don't wrap in uri property
      const url = new URL(this.config.connection);
      config.host = url.hostname;
      config.port = parseInt(url.port) || 3306;
      config.user = url.username;
      config.password = url.password;
      config.database = url.pathname.slice(1); // Remove leading slash

      // Handle SSL parameter from query string
      if (url.searchParams.get('ssl') !== null) {
        config.ssl =
          url.searchParams.get('ssl') === 'true' ||
          url.searchParams.get('ssl') === '1';
      }
    } else if (typeof this.config.connection === 'object') {
      const connOptions = this.config.connection as ConnectionOptions;

      config.host = connOptions.host || 'localhost';
      config.port = connOptions.port || 3306;
      config.user = connOptions.user;
      config.password = connOptions.password;
      config.database = connOptions.database;

      if (connOptions.ssl) {
        config.ssl = connOptions.ssl;
      }
    }

    // Add MySQL-specific options
    const mysqlOptions = this.config as DatabaseConfig<TSchema> & {
      timezone?: string;
      charset?: string;
    };

    if (mysqlOptions.timezone) {
      config.timezone = mysqlOptions.timezone;
    }

    if (mysqlOptions.charset) {
      config.charset = mysqlOptions.charset;
    }

    return config;
  }

  /**
   * Check if bun:sql supports MySQL (available since Bun 1.2.21)
   */
  private async checkBunSqlMySQLSupport(): Promise<boolean> {
    try {
      if (typeof Bun !== 'undefined' && typeof Bun.sql === 'function') {
        // MySQL support is available since Bun 1.2.21
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        if (this.connection.end) {
          // Single connection or pool
          await this.connection.end();
        } else if (this.connection.destroy) {
          // Alternative cleanup method
          this.connection.destroy();
        }

        this.connection = null;
        this.client = null;
        this.isConnected = false;

        if (this.config.debug) {
          console.log('[RefineORM] Disconnected from MySQL');
        }
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to disconnect from MySQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      if (this.connection.execute) {
        // For mysql2 connection/pool
        await this.connection.execute('SELECT 1');
      } else if (this.connection.query) {
        // Alternative query method
        await this.connection.query('SELECT 1');
      }

      return true;
    } catch (error) {
      if (this.config.debug) {
        console.error('[RefineORM] MySQL health check failed:', error);
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
        port = 3306,
        user,
        password,
        database,
      } = conn;

      if (!user || !database) {
        throw new ConfigurationError(
          'MySQL connection requires user and database'
        );
      }

      const auth = password ? `${user}:${password}` : user;
      return `mysql://${auth}@${host}:${port}/${database}`;
    }

    throw new ConfigurationError('Invalid MySQL connection configuration');
  }

  /**
   * Validate MySQL-specific configuration
   */
  protected override validateConfig(): void {
    super.validateConfig();

    if (this.config.type !== 'mysql') {
      throw new ConfigurationError('Invalid database type for MySQL adapter');
    }

    // Validate connection configuration
    if (typeof this.config.connection === 'object') {
      const conn = this.config.connection;
      // Check if it's a regular connection options object (not D1 database)
      if ('host' in conn || 'user' in conn || 'database' in conn) {
        const requiredFields = [
          'host',
          'user',
          'password',
          'database',
        ] as const;

        for (const field of requiredFields) {
          if (!(field in conn) || !conn[field as keyof typeof conn]) {
            throw new ConfigurationError(
              `Missing required connection field: ${field}`
            );
          }
        }
      }
    } else if (typeof this.config.connection === 'string') {
      // Validate connection string format
      if (!this.config.connection.startsWith('mysql://')) {
        throw new ConfigurationError('Invalid MySQL connection string format');
      }
    }
  }

  /**
   * Get adapter-specific information
   */
  override getAdapterInfo(): {
    type: 'mysql';
    runtime: string;
    driver: string;
    supportsNativeDriver: boolean;
    isConnected: boolean;
    futureSupport: { bunSql: boolean; estimatedVersion?: string };
  } {
    return {
      type: 'mysql',
      runtime: this.runtimeConfig.runtime,
      driver: this.actualDriver,
      supportsNativeDriver: this.runtimeConfig.supportsNativeDriver,
      isConnected: this.isConnected,
      futureSupport: {
        bunSql: true, // Available since Bun 1.2.21
        estimatedVersion: 'Bun 1.2.21+',
      },
    };
  }

  /**
   * Execute raw SQL query (MySQL-specific)
   */
  async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.connection) {
      throw new ConnectionError('No active MySQL connection');
    }

    try {
      const [rows] = await this.connection.execute(sql, params || []);
      return rows as T[];
    } catch (error) {
      throw new QueryError(
        `Failed to execute raw MySQL query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Begin transaction (MySQL-specific)
   */
  async beginTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active MySQL connection');
    }

    try {
      await this.connection.beginTransaction();
    } catch (error) {
      throw new ConnectionError(
        `Failed to begin MySQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Commit transaction (MySQL-specific)
   */
  async commitTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active MySQL connection');
    }

    try {
      await this.connection.commit();
    } catch (error) {
      throw new ConnectionError(
        `Failed to commit MySQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rollback transaction (MySQL-specific)
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionError('No active MySQL connection');
    }

    try {
      await this.connection.rollback();
    } catch (error) {
      throw new ConnectionError(
        `Failed to rollback MySQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Factory function to create MySQL data provider
 * Uses mysql2 driver for all environments (Bun and Node.js)
 */
export async function createMySQLProvider<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  options?: MySQLOptions
): Promise<RefineOrmDataProvider<TSchema>> {
  const config: DatabaseConfig<TSchema> = {
    type: 'mysql',
    connection,
    schema,
    ...(options?.pool && { pool: options.pool }),
    ...(options?.ssl && { ssl: options.ssl }),
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  const adapter = new MySQLAdapter(config);
  await adapter.connect();
  return createProvider(adapter, options);
}

/**
 * Create MySQL provider with explicit mysql2 driver
 * This is the current recommended approach for all environments
 */
export function createMySQLProviderWithMySQL2<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  options?: MySQLOptions
): MySQLAdapter<TSchema> {
  const config: DatabaseConfig<TSchema> = {
    type: 'mysql',
    connection,
    schema,
    ...(options?.pool && { pool: options.pool }),
    ...(options?.ssl && { ssl: options.ssl }),
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  return new MySQLAdapter(config);
}

/**
 * Create MySQL provider with connection pool
 * Optimized for production environments with high concurrency
 */
export function createMySQLProviderWithPool<
  TSchema extends Record<string, Table>,
>(
  connection: string | ConnectionOptions,
  schema: TSchema,
  poolOptions?: {
    min?: number;
    max?: number;
    acquireTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  },
  options?: MySQLOptions
): MySQLAdapter<TSchema> {
  const config: DatabaseConfig<TSchema> = {
    type: 'mysql',
    connection,
    schema,
    pool: {
      min: poolOptions?.min || 2,
      max: poolOptions?.max || 10,
      acquireTimeoutMillis: poolOptions?.acquireTimeoutMillis || 60000,
      idleTimeoutMillis: poolOptions?.idleTimeoutMillis || 600000,
      ...poolOptions,
    },
    ssl: options?.ssl,
    debug: options?.debug,
    logger: options?.logger,
    ...options,
  };

  return new MySQLAdapter(config);
}

/**
 * Create MySQL provider with Bun SQL driver
 * Available since Bun 1.2.21 with native MySQL support
 */
export function createMySQLProviderWithBunSql<
  TSchema extends Record<string, Table>,
>(
  connectionString: string,
  schema: TSchema,
  options?: MySQLOptions
): MySQLAdapter<TSchema> {
  if (!detectBunRuntime()) {
    throw new ConfigurationError(
      'Bun SQL is only available in Bun runtime environment'
    );
  }

  // Check if Bun SQL supports MySQL (available since 1.2.21)
  if (typeof Bun === 'undefined' || typeof Bun.sql !== 'function') {
    throw new ConfigurationError(
      'Bun SQL is not available. Please use Bun 1.2.21 or later.'
    );
  }

  const config: DatabaseConfig<TSchema> = {
    type: 'mysql',
    connection: connectionString,
    schema,
    ...(options?.pool && { pool: options.pool }),
    ...(options?.ssl && { ssl: options.ssl }),
    ...(options?.debug !== undefined && { debug: options.debug }),
    ...(options?.logger && { logger: options.logger }),
  };

  return new MySQLAdapter(config);
}

/**
 * Utility function to check MySQL connection
 */
export async function testMySQLConnection(
  connection: string | ConnectionOptions,
  options?: { timeout?: number }
): Promise<{ success: boolean; error?: string; info?: any }> {
  try {
    const mysql = await import('mysql2/promise');
    const createConnection =
      mysql.default?.createConnection || mysql.createConnection;

    let connectionConfig: any;
    if (typeof connection === 'string') {
      connectionConfig = { uri: connection };
    } else {
      connectionConfig = {
        host: connection.host || 'localhost',
        port: connection.port || 3306,
        user: connection.user,
        password: connection.password,
        database: connection.database,
        ssl: connection.ssl,
        connectTimeout: options?.timeout || 10000,
      };
    }

    const testConnection = await createConnection(connectionConfig);
    const [rows] = await testConnection.execute(
      'SELECT VERSION() as version, NOW() as now'
    );
    await testConnection.end();

    return {
      success: true,
      info: {
        version: (rows as any)[0]?.version,
        timestamp: (rows as any)[0]?.now,
        driver: 'mysql2',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
