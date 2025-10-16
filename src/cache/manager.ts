import type { CacheAdapter, CacheConfig } from '../types';
import { MemoryCacheAdapter } from './memory-adapter';

/**
 * Cache manager for handling query caching
 */
export class CacheManager {
  private adapter: CacheAdapter;
  private keyPrefix: string;
  private defaultTTL: number;
  private enabled: boolean;

  constructor(config: CacheConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.keyPrefix = config.keyPrefix ?? 'refine-sqlx:';
    this.defaultTTL = config.ttl ?? 300; // 5 minutes default

    // Initialize adapter
    if (typeof config.adapter === 'object') {
      this.adapter = config.adapter;
    } else {
      this.adapter = new MemoryCacheAdapter(config.maxSize);
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate cache key for a query
   */
  generateKey(
    operation: string,
    resource: string,
    params?: Record<string, any>,
  ): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${this.keyPrefix}${operation}:${resource}:${paramsStr}`;
  }

  /**
   * Get cached value
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    return this.adapter.get<T>(key);
  }

  /**
   * Set cached value
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.adapter.set(key, value, ttl ?? this.defaultTTL);
  }

  /**
   * Invalidate cache for a resource
   */
  async invalidate(resource: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.adapter.delete(`${this.keyPrefix}*:${resource}:*`);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.adapter.delete(`${this.keyPrefix}${pattern}`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (this.adapter.clear) {
      await this.adapter.clear();
    } else {
      await this.adapter.delete(`${this.keyPrefix}*`);
    }
  }
}
