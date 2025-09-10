import type { RuntimeConfig } from '../types/config';
import { ConfigurationError } from '../types/errors';

/**
 * Detect if running in Bun runtime environment
 */
export function detectBunRuntime(): boolean {
  return typeof Bun !== 'undefined';
}

/**
 * Detect if running in Node.js runtime environment
 */
export function detectNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions &&
    !!process.versions.node
  );
}

/**
 * Detect if running in Cloudflare Workers/D1 environment
 */
export function detectCloudflareD1(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).D1Database !== 'undefined'
  );
}

/**
 * Get current runtime information
 */
export function getRuntimeInfo(): {
  runtime: 'bun' | 'node' | 'cloudflare-d1' | 'unknown';
  version?: string;
} {
  if (detectCloudflareD1()) {
    return { runtime: 'cloudflare-d1' };
  }

  if (detectBunRuntime()) {
    const bunVersion = typeof Bun !== 'undefined' ? Bun.version : undefined;
    return { runtime: 'bun', ...(bunVersion ? { version: bunVersion } : {}) };
  }

  if (detectNodeRuntime()) {
    return { runtime: 'node', version: process.versions.node };
  }

  return { runtime: 'unknown' };
}

/**
 * Check if bun:sql is available and supports the specified database
 */
export function detectBunSqlSupport(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): boolean {
  if (!detectBunRuntime()) {
    return false;
  }

  try {
    // Check if Bun.sql is available
    if (typeof Bun === 'undefined' || typeof Bun.sql !== 'function') {
      return false;
    }

    switch (dbType) {
      case 'postgresql':
        return true; // bun:sql supports PostgreSQL
      case 'mysql':
        return true; // bun:sql supports MySQL since Bun 1.2.21
      case 'sqlite':
        return typeof (Bun as any).sqlite === 'function'; // Check for bun:sqlite
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Get the recommended driver for a database type in the current runtime
 */
export function getRecommendedDriver(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): string {
  const runtime = getRuntimeInfo().runtime;

  switch (dbType) {
    case 'postgresql':
      if (runtime === 'bun' && detectBunSqlSupport('postgresql')) {
        return 'bun:sql';
      }
      return 'postgres';

    case 'mysql':
      // Use bun:sql if available, otherwise mysql2
      if (runtime === 'bun' && detectBunSqlSupport('mysql')) {
        return 'bun:sql';
      }
      return 'mysql2';

    case 'sqlite':
      if (runtime === 'cloudflare-d1') {
        return 'd1';
      }
      if (runtime === 'bun' && detectBunSqlSupport('sqlite')) {
        return 'bun:sqlite';
      }
      return 'better-sqlite3';

    default:
      throw new ConfigurationError(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Get complete runtime configuration for a database
 */
export function getRuntimeConfig(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): RuntimeConfig {
  const runtime = getRuntimeInfo().runtime as 'bun' | 'node' | 'cloudflare-d1';
  const driver = getRecommendedDriver(dbType);
  const supportsNativeDriver =
    runtime === 'cloudflare-d1' || detectBunSqlSupport(dbType);

  return { runtime, database: dbType, driver, supportsNativeDriver };
}

/**
 * Check if a specific driver package is available
 */
export async function checkDriverAvailability(
  driverName: string
): Promise<boolean> {
  try {
    await import(driverName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available drivers for a database type
 */
export async function getAvailableDrivers(
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): Promise<string[]> {
  const drivers: string[] = [];

  switch (dbType) {
    case 'postgresql':
      if (detectBunSqlSupport('postgresql')) {
        drivers.push('bun:sql');
      }
      if (await checkDriverAvailability('postgres')) {
        drivers.push('postgres');
      }
      break;

    case 'mysql':
      if (detectBunSqlSupport('mysql')) {
        drivers.push('bun:sql');
      }
      if (await checkDriverAvailability('mysql2')) {
        drivers.push('mysql2');
      }
      break;

    case 'sqlite':
      if (detectCloudflareD1()) {
        drivers.push('d1');
      }
      if (detectBunSqlSupport('sqlite')) {
        drivers.push('bun:sqlite');
      }
      if (await checkDriverAvailability('better-sqlite3')) {
        drivers.push('better-sqlite3');
      }
      break;
  }

  return drivers;
}

/**
 * Validate connection string format for a specific database type
 */
export function validateConnectionString(
  connectionString: string,
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): boolean {
  switch (dbType) {
    case 'postgresql':
      return (
        connectionString.startsWith('postgresql://') ||
        connectionString.startsWith('postgres://')
      );
    case 'mysql':
      return connectionString.startsWith('mysql://');
    case 'sqlite':
      return (
        connectionString === ':memory:' ||
        connectionString.endsWith('.db') ||
        connectionString.endsWith('.sqlite') ||
        connectionString.includes('/') || // File path
        connectionString.includes('\\')
      ); // Windows file path
    default:
      return false;
  }
}

/**
 * Auto-detect database type from connection string
 */
export function detectDatabaseTypeFromConnection(
  connection: string | object
): 'postgresql' | 'mysql' | 'sqlite' | null {
  if (typeof connection === 'object') {
    if ('d1Database' in connection) {
      return 'sqlite';
    }
    // For connection objects, we can't auto-detect reliably
    return null;
  }

  if (typeof connection === 'string') {
    if (
      connection.startsWith('postgresql://') ||
      connection.startsWith('postgres://')
    ) {
      return 'postgresql';
    }
    if (connection.startsWith('mysql://')) {
      return 'mysql';
    }
    if (
      connection === ':memory:' ||
      connection.endsWith('.db') ||
      connection.endsWith('.sqlite') ||
      connection.includes('/') ||
      connection.includes('\\')
    ) {
      return 'sqlite';
    }
  }

  return null;
}

/**
 * Get optimal configuration for a database type in current runtime
 */
export function getOptimalConfig(dbType: 'postgresql' | 'mysql' | 'sqlite'): {
  driver: string;
  poolConfig?: { min: number; max: number };
  features: string[];
} {
  const runtime = getRuntimeInfo().runtime;
  const driver = getRecommendedDriver(dbType);

  const config = { driver, features: [] as string[] };

  // Add runtime-specific optimizations
  switch (runtime) {
    case 'bun':
      if (dbType === 'postgresql' && detectBunSqlSupport('postgresql')) {
        config.features.push('native-sql', 'high-performance');
      }
      if (dbType === 'sqlite' && detectBunSqlSupport('sqlite')) {
        config.features.push('native-sqlite', 'zero-copy');
      }
      break;

    case 'node':
      config.features.push('connection-pooling', 'prepared-statements');
      break;

    case 'cloudflare-d1':
      if (dbType === 'sqlite') {
        config.features.push('edge-optimized', 'serverless');
      }
      break;
  }

  // Add database-specific pool configurations
  const poolConfig = getDefaultPoolConfig(dbType, runtime);
  if (poolConfig) {
    return { ...config, poolConfig };
  }

  return config;
}

/**
 * Get default pool configuration for database and runtime
 */
function getDefaultPoolConfig(
  dbType: 'postgresql' | 'mysql' | 'sqlite',
  runtime: string
): { min: number; max: number } | undefined {
  // SQLite doesn't use connection pools in the traditional sense
  if (dbType === 'sqlite') {
    return undefined;
  }

  // Default pool sizes based on database type and runtime
  switch (dbType) {
    case 'postgresql':
      return runtime === 'bun' ? { min: 2, max: 10 } : { min: 2, max: 8 };
    case 'mysql':
      return runtime === 'bun' ? { min: 3, max: 15 } : { min: 2, max: 10 };
    default:
      return { min: 2, max: 10 };
  }
}
