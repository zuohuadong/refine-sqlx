import type { DatabaseType, MySQLConfig, PostgreSQLConfig } from '../types';

/**
 * Connection string parser result
 */
export interface ParsedConnection {
  type: DatabaseType;
  config?: MySQLConfig | PostgreSQLConfig;
  path?: string;
}

/**
 * Parse database connection string and detect database type
 *
 * @param connection - Connection string or path
 * @returns Parsed connection information
 *
 * @example
 * ```typescript
 * parseConnectionString('database.sqlite')
 * // => { type: 'sqlite', path: 'database.sqlite' }
 *
 * parseConnectionString(':memory:')
 * // => { type: 'sqlite', path: ':memory:' }
 *
 * parseConnectionString('mysql://root:pass@localhost:3306/mydb')
 * // => { type: 'mysql', config: { host: 'localhost', port: 3306, user: 'root', password: 'pass', database: 'mydb' } }
 *
 * parseConnectionString('postgresql://user:pass@localhost:5432/mydb')
 * // => { type: 'postgresql', config: { host: 'localhost', port: 5432, user: 'user', password: 'pass', database: 'mydb' } }
 * ```
 */
export function parseConnectionString(connection: string): ParsedConnection {
  // D1 is handled separately (instance-based, not string-based)

  // Check for MySQL connection string
  if (connection.startsWith('mysql://')) {
    const config = parseMySQLConnectionString(connection);
    return { type: 'mysql', config };
  }

  // Check for PostgreSQL connection string (both postgresql:// and postgres://)
  if (
    connection.startsWith('postgresql://') ||
    connection.startsWith('postgres://')
  ) {
    const config = parsePostgreSQLConnectionString(connection);
    return { type: 'postgresql', config };
  }

  // Default to SQLite for file paths and :memory:
  return { type: 'sqlite', path: connection };
}

/**
 * Parse MySQL connection string
 *
 * @param url - MySQL connection URL
 * @returns MySQL configuration object
 *
 * Format: mysql://[user[:password]@][host][:port]/database[?options]
 */
function parseMySQLConnectionString(url: string): MySQLConfig {
  try {
    const parsed = new URL(url);

    const config: MySQLConfig = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username || 'root',
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.slice(1), // Remove leading '/'
    };

    // Parse query parameters for additional options
    const searchParams = parsed.searchParams;
    if (searchParams.has('ssl')) {
      config.ssl = searchParams.get('ssl') === 'true';
    }

    return config;
  } catch (error) {
    throw new Error(
      `Invalid MySQL connection string: ${url}. Expected format: mysql://user:password@host:port/database`,
    );
  }
}

/**
 * Parse PostgreSQL connection string
 *
 * @param url - PostgreSQL connection URL
 * @returns PostgreSQL configuration object
 *
 * Format: postgresql://[user[:password]@][host][:port]/database[?options]
 */
function parsePostgreSQLConnectionString(url: string): PostgreSQLConfig {
  try {
    const parsed = new URL(url);

    const config: PostgreSQLConfig = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      user: parsed.username || 'postgres',
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.slice(1), // Remove leading '/'
    };

    // Parse query parameters for additional options
    const searchParams = parsed.searchParams;
    if (searchParams.has('ssl')) {
      const sslValue = searchParams.get('ssl');
      config.ssl = sslValue === 'true' || sslValue === '1';
    }
    if (searchParams.has('max')) {
      config.max = parseInt(searchParams.get('max')!, 10);
    }

    return config;
  } catch (error) {
    throw new Error(
      `Invalid PostgreSQL connection string: ${url}. Expected format: postgresql://user:password@host:port/database`,
    );
  }
}

/**
 * Detect database type from connection configuration
 *
 * @param connection - Connection string, config object, or database instance
 * @returns Detected database type
 */
export function detectDatabaseType(connection: any): DatabaseType {
  // String-based detection
  if (typeof connection === 'string') {
    return parseConnectionString(connection).type;
  }

  // Config object detection
  if (typeof connection === 'object' && connection !== null) {
    // D1Database detection
    if (
      'prepare' in connection &&
      'dump' in connection &&
      'batch' in connection
    ) {
      return 'd1';
    }

    // MySQL/PostgreSQL config object
    if ('host' in connection && 'database' in connection) {
      // Heuristic: PostgreSQL default user is 'postgres', MySQL is 'root'
      // Or check port: 5432 = PostgreSQL, 3306 = MySQL
      if (connection.port === 5432 || connection.user === 'postgres') {
        return 'postgresql';
      }
      if (connection.port === 3306 || connection.user === 'root') {
        return 'mysql';
      }
      // Default to MySQL for ambiguous config objects
      return 'mysql';
    }

    // Drizzle database instance detection (has query methods)
    if ('select' in connection && 'insert' in connection) {
      // Try to detect from internal properties or assume SQLite
      return 'sqlite'; // Default assumption for Drizzle instances
    }

    // SQLite native instances
    if ('prepare' in connection && 'exec' in connection) {
      return 'sqlite';
    }
  }

  // Default to SQLite
  return 'sqlite';
}

/**
 * Validate MySQL configuration
 */
export function validateMySQLConfig(config: MySQLConfig): void {
  if (!config.host) {
    throw new Error('MySQL configuration requires a host');
  }
  if (!config.database) {
    throw new Error('MySQL configuration requires a database name');
  }
  if (!config.user) {
    throw new Error('MySQL configuration requires a user');
  }
}

/**
 * Validate PostgreSQL configuration
 */
export function validatePostgreSQLConfig(config: PostgreSQLConfig): void {
  if (!config.host) {
    throw new Error('PostgreSQL configuration requires a host');
  }
  if (!config.database) {
    throw new Error('PostgreSQL configuration requires a database name');
  }
  if (!config.user) {
    throw new Error('PostgreSQL configuration requires a user');
  }
}

/**
 * Build MySQL connection string from config object
 */
export function buildMySQLConnectionString(config: MySQLConfig): string {
  const { host, port = 3306, user, password, database } = config;
  const auth = password ? `${user}:${encodeURIComponent(password)}` : user;
  return `mysql://${auth}@${host}:${port}/${database}`;
}

/**
 * Build PostgreSQL connection string from config object
 */
export function buildPostgreSQLConnectionString(
  config: PostgreSQLConfig,
): string {
  const { host, port = 5432, user, password, database } = config;
  const auth = password ? `${user}:${encodeURIComponent(password)}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}
