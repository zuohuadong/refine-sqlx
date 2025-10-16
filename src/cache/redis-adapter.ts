import type { CacheAdapter } from '../types';

/**
 * Redis client interface (supports both ioredis and redis packages)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  setex?(key: string, seconds: number, value: string): Promise<'OK' | null>;
  set?(
    key: string,
    value: string,
    mode?: 'EX',
    duration?: number,
  ): Promise<'OK' | null>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
  flushdb?(): Promise<'OK'>;
  flushDb?(): Promise<void>; // ioredis uses camelCase
}

/**
 * Redis cache adapter options
 */
export interface RedisCacheAdapterOptions {
  /**
   * Redis client instance (ioredis or redis package)
   */
  client: RedisClient;

  /**
   * JSON serialization options
   */
  serialization?: {
    /**
     * Custom serialize function
     * @default JSON.stringify
     */
    serialize?: (value: any) => string;

    /**
     * Custom deserialize function
     * @default JSON.parse
     */
    deserialize?: (value: string) => any;
  };

  /**
   * Error handling
   */
  errorHandling?: {
    /**
     * Silently fail on errors (returns null/void instead of throwing)
     * @default true
     */
    silent?: boolean;

    /**
     * Custom error handler
     */
    onError?: (error: Error, operation: string) => void;
  };
}

/**
 * Redis cache adapter
 * Supports both ioredis and redis packages
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { RedisCacheAdapter } from 'refine-sqlx';
 *
 * const redis = new Redis();
 * const adapter = new RedisCacheAdapter({ client: redis });
 * ```
 *
 * @example
 * ```typescript
 * import { createClient } from 'redis';
 * import { RedisCacheAdapter } from 'refine-sqlx';
 *
 * const redis = createClient();
 * await redis.connect();
 * const adapter = new RedisCacheAdapter({ client: redis });
 * ```
 */
export class RedisCacheAdapter implements CacheAdapter {
  private client: RedisClient;
  private serialize: (value: any) => string;
  private deserialize: (value: string) => any;
  private silent: boolean;
  private onError?: (error: Error, operation: string) => void;

  constructor(options: RedisCacheAdapterOptions) {
    this.client = options.client;
    this.serialize = options.serialization?.serialize ?? JSON.stringify;
    this.deserialize = options.serialization?.deserialize ?? JSON.parse;
    this.silent = options.errorHandling?.silent ?? true;
    this.onError = options.errorHandling?.onError;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);

      if (!value) {
        return null;
      }

      return this.deserialize(value) as T;
    } catch (error) {
      this.handleError(error as Error, 'get');
      return null;
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      const serialized = this.serialize(value);

      // Try ioredis-style setex first
      if (this.client.setex) {
        await this.client.setex(key, ttl, serialized);
      }
      // Fallback to redis-style set with EX
      else if (this.client.set) {
        await this.client.set(key, serialized, 'EX', ttl);
      } else {
        throw new Error('Redis client does not support set operations');
      }
    } catch (error) {
      this.handleError(error as Error, 'set');
    }
  }

  async delete(pattern: string): Promise<void> {
    try {
      // Convert glob pattern to Redis pattern
      // Refine-sqlx uses '*' as wildcard, which is compatible with Redis KEYS
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.handleError(error as Error, 'delete');
    }
  }

  async clear(): Promise<void> {
    try {
      // Try ioredis-style flushDb first (camelCase)
      if (this.client.flushDb) {
        await this.client.flushDb();
      }
      // Fallback to redis-style flushdb (lowercase)
      else if (this.client.flushdb) {
        await this.client.flushdb();
      } else {
        throw new Error('Redis client does not support flush operations');
      }
    } catch (error) {
      this.handleError(error as Error, 'clear');
    }
  }

  /**
   * Handle errors based on configuration
   */
  private handleError(error: Error, operation: string): void {
    if (this.onError) {
      this.onError(error, operation);
    }

    if (!this.silent) {
      throw error;
    }

    // Silent mode: log to console but don't throw
    if (typeof console !== 'undefined' && console.error) {
      console.error(
        `[RedisCacheAdapter] Error during ${operation}:`,
        error.message,
      );
    }
  }

  /**
   * Test Redis connection
   */
  async ping(): Promise<boolean> {
    try {
      // Try to get a non-existent key to test connection
      await this.client.get('__refine_sqlx_ping__');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics (requires Redis INFO command support)
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount?: number;
  }> {
    const connected = await this.ping();

    if (!connected) {
      return { connected: false };
    }

    try {
      // Try to get key count using pattern
      const keys = await this.client.keys('*');
      return {
        connected: true,
        keyCount: keys.length,
      };
    } catch {
      return { connected: true };
    }
  }
}
