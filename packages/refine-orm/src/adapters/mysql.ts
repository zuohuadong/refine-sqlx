import type { Table } from 'drizzle-orm';

// Dynamic imports for database drivers
let drizzleMySQL: any;

import { BaseDatabaseAdapter } from './base.js';
import type {
  DatabaseConfig,
  MySQLOptions,
  ConnectionOptions,
} from '../types/config.js';
import type { DrizzleClient } from '../types/client.js';
import { ConnectionError, ConfigurationError } from '../types/errors.js';
import {
  detectBunRuntime,
  getRuntimeConfig,
  checkDriverAvailability,
} from '../utils/runtime-detection.js';

/**
 * MySQL database adapter with runtime detection
 * Currently uses mysql2 driver for all environments
 * Future: Will support bun:sql when MySQL support is added
 */
export class MySQLAdapter<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends BaseDatabaseAdapter<TSchema> {
  private connection: any = null;
  private runtimeConfig = getRuntimeConfig('mysql');

  constructor(config: DatabaseConfig<TSchema>) {
    super(config);
    this.validateConfig();
  }

  /**
   * Establish connection to MySQL database
   * Currently uses mysql2 for all environments
   */
  async connect(): Promise<void> {
    try {
      // Check for future bun:sql MySQL support
      if (
        this.runtimeConfig.runtime === 'bun' &&
        (await this.checkBunSqlMySQLSupport())
      ) {
        await this.connectWithBunSql();
      } else {
        await this.connectWithMySQL2();
      }

      this.isConnected = true;

      if (this.config.debug) {
        console.log(
          `[RefineORM] Connected to MySQL using ${this.runtimeConfig.driver}`
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
   * Connect using Bun's native SQL driver (future implementation)
   * Currently not supported - bun:sql doesn't support MySQL yet
   */
  private async connectWithBunSql(): Promise<void> {
    throw new ConnectionError(
      'Bun SQL does not support MySQL yet. Using mysql2 driver instead.'
    );
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

      // Dynamic import for drizzle-orm/mysql2
      if (!drizzleMySQL) {
        const drizzleModule = await import('drizzle-orm/mysql2');
        drizzleMySQL = drizzleModule.drizzle;
      }

      // Create MySQL connection with optimized pool configuration
      const connectionConfig = this.getMySQLConnectionConfig();
      const poolConfig = this.getOptimizedPoolConfig();

      if (this.config.pool || poolConfig.usePool) {
        // Create optimized connection pool
        this.connection = mysql.createPool({
          ...connectionConfig,
          connectionLimit: poolConfig.connectionLimit,
          acquireTimeout: poolConfig.acquireTimeout,
          timeout: poolConfig.timeout,
          idleTimeout: poolConfig.idleTimeout,
          queueLimit: poolConfig.queueLimit,
          // MySQL-specific optimizations
          reconnect: true,
          multipleStatements: false,
          dateStrings: false,
          supportBigNumbers: true,
          bigNumberStrings: false,
        });
      } else {
        // Create single connection with optimizations
        this.connection = await mysql.createConnection({
          ...connectionConfig,
          reconnect: true,
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
      }) as DrizzleClient<TSchema>;
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
      // Parse connection string
      config.uri = this.config.connection;
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
   * Check if bun:sql supports MySQL (future feature detection)
   */
  private async checkBunSqlMySQLSupport(): Promise<boolean> {
    try {
      if (typeof Bun !== 'undefined' && typeof Bun.sql === 'function') {
        // Future: Add version check or feature detection for MySQL support
        // For now, always return false since bun:sql doesn't support MySQL
        return false;
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
      driver: this.runtimeConfig.driver,
      supportsNativeDriver: this.runtimeConfig.supportsNativeDriver,
      isConnected: this.isConnected,
      futureSupport: {
        bunSql: false, // Will be true when bun:sql adds MySQL support
        estimatedVersion: 'TBD', // To be determined by Bun team
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
      throw new ConnectionError(
        `Failed to execute raw MySQL query: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
export function createMySQLProvider<TSchema extends Record<string, Table>>(
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
 * Future: Create MySQL provider with Bun SQL driver
 * This will be available when bun:sql adds MySQL support
 */
export function createMySQLProviderWithBunSql<
  TSchema extends Record<string, Table>,
>(
  _connectionString: string,
  _schema: TSchema,
  _options?: MySQLOptions
): MySQLAdapter<TSchema> {
  if (!detectBunRuntime()) {
    throw new ConfigurationError(
      'Bun SQL is only available in Bun runtime environment'
    );
  }

  // Future implementation - currently throws error
  throw new ConfigurationError(
    'Bun SQL does not support MySQL yet. Please use createMySQLProvider() which uses mysql2 driver.'
  );
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
        timeout: options?.timeout || 10000,
      };
    }

    const testConnection = await mysql.createConnection(connectionConfig);
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
