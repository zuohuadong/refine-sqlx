import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  RedisCacheAdapter,
  type RedisClient,
} from '../../src/cache/redis-adapter';

/**
 * Mock Redis client (ioredis-style)
 */
class MockRedisClient implements RedisClient {
  private data = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async setex(
    key: string,
    seconds: number,
    value: string,
  ): Promise<'OK' | null> {
    this.data.set(key, {
      value,
      expiresAt: Date.now() + seconds * 1000,
    });
    return 'OK';
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter((key) => regex.test(key));
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async flushDb(): Promise<void> {
    this.data.clear();
  }

  // Helper method for testing
  getSize(): number {
    return this.data.size;
  }
}

/**
 * Mock Redis client (redis package style)
 */
class MockRedisClientV4 implements RedisClient {
  private data = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode?: 'EX',
    duration?: number,
  ): Promise<'OK' | null> {
    this.data.set(key, {
      value,
      expiresAt: Date.now() + (duration ?? 0) * 1000,
    });
    return 'OK';
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.data.keys()).filter((key) => regex.test(key));
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async flushdb(): Promise<'OK'> {
    this.data.clear();
    return 'OK';
  }

  getSize(): number {
    return this.data.size;
  }
}

describe('RedisCacheAdapter', () => {
  describe('with ioredis client', () => {
    let client: MockRedisClient;
    let adapter: RedisCacheAdapter;

    beforeEach(() => {
      client = new MockRedisClient();
      adapter = new RedisCacheAdapter({ client });
    });

    it('should get and set values', async () => {
      await adapter.set('test:key', { foo: 'bar' }, 60);
      const value = await adapter.get<{ foo: string }>('test:key');

      expect(value).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', async () => {
      const value = await adapter.get('non:existent');

      expect(value).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      await adapter.set('test:expiring', 'value', 0); // Expire immediately

      // Wait a bit for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const value = await adapter.get('test:expiring');
      expect(value).toBeNull();
    });

    it('should delete keys by pattern', async () => {
      await adapter.set('users:1', { id: 1 }, 60);
      await adapter.set('users:2', { id: 2 }, 60);
      await adapter.set('posts:1', { id: 1 }, 60);

      await adapter.delete('users:*');

      expect(await adapter.get('users:1')).toBeNull();
      expect(await adapter.get('users:2')).toBeNull();
      expect(await adapter.get('posts:1')).toEqual({ id: 1 });
    });

    it('should clear all cache', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);

      await adapter.clear();

      expect(client.getSize()).toBe(0);
    });

    it('should handle complex objects', async () => {
      const complexObject = {
        id: 1,
        name: 'Test',
        nested: {
          array: [1, 2, 3],
          object: { foo: 'bar' },
        },
      };

      await adapter.set('complex', complexObject, 60);
      const value = await adapter.get('complex');

      expect(value).toEqual(complexObject);
    });

    it('should test connection with ping', async () => {
      const result = await adapter.ping();
      expect(result).toBe(true);
    });

    it('should get cache statistics', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);

      const stats = await adapter.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.keyCount).toBe(2);
    });
  });

  describe('with redis v4 client', () => {
    let client: MockRedisClientV4;
    let adapter: RedisCacheAdapter;

    beforeEach(() => {
      client = new MockRedisClientV4();
      adapter = new RedisCacheAdapter({ client });
    });

    it('should get and set values using set with EX', async () => {
      await adapter.set('test:key', { foo: 'bar' }, 60);
      const value = await adapter.get<{ foo: string }>('test:key');

      expect(value).toEqual({ foo: 'bar' });
    });

    it('should clear all cache using flushdb', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);

      await adapter.clear();

      expect(client.getSize()).toBe(0);
    });
  });

  describe('custom serialization', () => {
    it('should use custom serialize/deserialize functions', async () => {
      const client = new MockRedisClient();
      const adapter = new RedisCacheAdapter({
        client,
        serialization: {
          serialize: (value: any) => `custom:${JSON.stringify(value)}`,
          deserialize: (value: string) =>
            JSON.parse(value.replace('custom:', '')),
        },
      });

      await adapter.set('test:key', { foo: 'bar' }, 60);
      const value = await adapter.get<{ foo: string }>('test:key');

      expect(value).toEqual({ foo: 'bar' });
    });
  });

  describe('error handling', () => {
    it('should silently fail on errors by default', async () => {
      const client = {
        get: jest.fn().mockRejectedValue(new Error('Connection error')),
        setex: jest.fn().mockRejectedValue(new Error('Connection error')),
        keys: jest.fn().mockRejectedValue(new Error('Connection error')),
        del: jest.fn(),
        flushDb: jest.fn().mockRejectedValue(new Error('Connection error')),
      } as unknown as RedisClient;

      const adapter = new RedisCacheAdapter({ client });

      // Should not throw
      const value = await adapter.get('test');
      expect(value).toBeNull();

      await adapter.set('test', 'value', 60);
      await adapter.delete('test:*');
      await adapter.clear();
    });

    it('should call error handler when provided', async () => {
      const onError = jest.fn();
      const client = {
        get: jest.fn().mockRejectedValue(new Error('Connection error')),
        setex: jest.fn(),
        keys: jest.fn(),
        del: jest.fn(),
        flushDb: jest.fn(),
      } as unknown as RedisClient;

      const adapter = new RedisCacheAdapter({
        client,
        errorHandling: {
          onError,
        },
      });

      await adapter.get('test');

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        'get',
      );
    });

    it('should throw errors when silent mode is disabled', async () => {
      const client = {
        get: jest.fn().mockRejectedValue(new Error('Connection error')),
        setex: jest.fn(),
        keys: jest.fn(),
        del: jest.fn(),
        flushDb: jest.fn(),
      } as unknown as RedisClient;

      const adapter = new RedisCacheAdapter({
        client,
        errorHandling: {
          silent: false,
        },
      });

      await expect(adapter.get('test')).rejects.toThrow('Connection error');
    });

    it('should return false on ping failure', async () => {
      const client = {
        get: jest.fn().mockRejectedValue(new Error('Connection error')),
        setex: jest.fn(),
        keys: jest.fn(),
        del: jest.fn(),
        flushDb: jest.fn(),
      } as unknown as RedisClient;

      const adapter = new RedisCacheAdapter({ client });

      const result = await adapter.ping();
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern delete', async () => {
      const client = new MockRedisClient();
      const adapter = new RedisCacheAdapter({ client });

      await adapter.set('key1', 'value1', 60);

      // Delete with pattern that doesn't match anything
      await adapter.delete('nonexistent:*');

      expect(await adapter.get('key1')).toEqual('value1');
    });

    it('should handle null values (undefined becomes null in JSON)', async () => {
      const client = new MockRedisClient();
      const adapter = new RedisCacheAdapter({ client });

      await adapter.set('null-key', null, 60);
      await adapter.set('undefined-key', undefined, 60);

      // Both null and undefined become null when serialized with JSON
      expect(await adapter.get('null-key')).toBeNull();
      expect(await adapter.get('undefined-key')).toBeNull();
    });

    it('should handle arrays', async () => {
      const client = new MockRedisClient();
      const adapter = new RedisCacheAdapter({ client });

      const array = [1, 2, 3, { foo: 'bar' }];
      await adapter.set('array-key', array, 60);

      expect(await adapter.get('array-key')).toEqual(array);
    });

    it('should handle special characters in keys', async () => {
      const client = new MockRedisClient();
      const adapter = new RedisCacheAdapter({ client });

      await adapter.set('key:with:colons', 'value', 60);
      await adapter.set('key-with-dashes', 'value', 60);
      await adapter.set('key_with_underscores', 'value', 60);

      expect(await adapter.get('key:with:colons')).toEqual('value');
      expect(await adapter.get('key-with-dashes')).toEqual('value');
      expect(await adapter.get('key_with_underscores')).toEqual('value');
    });
  });
});
