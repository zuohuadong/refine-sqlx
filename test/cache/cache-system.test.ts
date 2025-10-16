import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { MemoryCacheAdapter } from '../../src/cache/memory-adapter';
import { CacheManager } from '../../src/cache/manager';
import type { CacheAdapter } from '../../src/types';

describe('MemoryCacheAdapter', () => {
  let adapter: MemoryCacheAdapter;

  beforeEach(() => {
    adapter = new MemoryCacheAdapter(100);
  });

  describe('Basic operations', () => {
    it('should store and retrieve values', async () => {
      await adapter.set('key1', { foo: 'bar' }, 60);
      const value = await adapter.get('key1');

      expect(value).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', async () => {
      const value = await adapter.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should handle different data types', async () => {
      await adapter.set('string', 'hello', 60);
      await adapter.set('number', 42, 60);
      await adapter.set('boolean', true, 60);
      await adapter.set('array', [1, 2, 3], 60);
      await adapter.set('object', { a: 1, b: 2 }, 60);

      expect(await adapter.get('string')).toBe('hello');
      expect(await adapter.get('number')).toBe(42);
      expect(await adapter.get('boolean')).toBe(true);
      expect(await adapter.get('array')).toEqual([1, 2, 3]);
      expect(await adapter.get('object')).toEqual({ a: 1, b: 2 });
    });

    it('should overwrite existing keys', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key1', 'value2', 60);

      expect(await adapter.get('key1')).toBe('value2');
    });
  });

  describe('TTL and expiration', () => {
    it('should expire entries after TTL', async () => {
      await adapter.set('key1', 'value', 0); // 0 seconds TTL

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await adapter.get('key1')).toBeNull();
    });

    it('should not expire before TTL', async () => {
      await adapter.set('key1', 'value', 10); // 10 seconds TTL

      // Check immediately
      expect(await adapter.get('key1')).toBe('value');
    });

    it('should update TTL on set', async () => {
      await adapter.set('key1', 'value1', 1);
      await adapter.set('key1', 'value2', 10); // Extend TTL

      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should still exist (new TTL)
      expect(await adapter.get('key1')).toBe('value2');
    });
  });

  describe('Pattern-based deletion', () => {
    beforeEach(async () => {
      await adapter.set('users:1', { id: 1 }, 60);
      await adapter.set('users:2', { id: 2 }, 60);
      await adapter.set('posts:1', { id: 1 }, 60);
      await adapter.set('posts:2', { id: 2 }, 60);
      await adapter.set('categories:1', { id: 1 }, 60);
    });

    it('should delete keys matching pattern', async () => {
      await adapter.delete('users:*');

      expect(await adapter.get('users:1')).toBeNull();
      expect(await adapter.get('users:2')).toBeNull();
      expect(await adapter.get('posts:1')).not.toBeNull();
    });

    it('should support wildcard patterns', async () => {
      await adapter.delete('*:1');

      expect(await adapter.get('users:1')).toBeNull();
      expect(await adapter.get('posts:1')).toBeNull();
      expect(await adapter.get('categories:1')).toBeNull();
      expect(await adapter.get('users:2')).not.toBeNull();
    });

    it('should support complex patterns', async () => {
      await adapter.set('refine:users:list:page1', [], 60);
      await adapter.set('refine:users:list:page2', [], 60);
      await adapter.set('refine:posts:list:page1', [], 60);

      await adapter.delete('refine:users:*');

      expect(await adapter.get('refine:users:list:page1')).toBeNull();
      expect(await adapter.get('refine:users:list:page2')).toBeNull();
      expect(await adapter.get('refine:posts:list:page1')).not.toBeNull();
    });

    it('should handle no matches gracefully', async () => {
      await adapter.delete('nonexistent:*');

      // Should not throw, all keys should still exist
      expect(await adapter.get('users:1')).not.toBeNull();
    });
  });

  describe('Clear operation', () => {
    it('should clear all entries', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);
      await adapter.set('key3', 'value3', 60);

      await adapter.clear();

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
      expect(await adapter.get('key3')).toBeNull();
    });

    it('should allow new entries after clear', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.clear();
      await adapter.set('key2', 'value2', 60);

      expect(await adapter.get('key2')).toBe('value2');
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when max size reached', async () => {
      const smallAdapter = new MemoryCacheAdapter(3);

      await smallAdapter.set('key1', 'value1', 60);
      await smallAdapter.set('key2', 'value2', 60);
      await smallAdapter.set('key3', 'value3', 60);
      await smallAdapter.set('key4', 'value4', 60); // Should evict key1

      expect(await smallAdapter.get('key1')).toBeNull();
      expect(await smallAdapter.get('key2')).not.toBeNull();
      expect(await smallAdapter.get('key3')).not.toBeNull();
      expect(await smallAdapter.get('key4')).not.toBeNull();
    });

    it('should maintain max size', async () => {
      const smallAdapter = new MemoryCacheAdapter(2);

      for (let i = 0; i < 10; i++) {
        await smallAdapter.set(`key${i}`, `value${i}`, 60);
      }

      const stats = smallAdapter.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should return cache statistics', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);

      const stats = adapter.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
    });

    it('should update size after operations', async () => {
      await adapter.set('key1', 'value1', 60);
      expect(adapter.getStats().size).toBe(1);

      await adapter.set('key2', 'value2', 60);
      expect(adapter.getStats().size).toBe(2);

      await adapter.delete('key1');
      expect(adapter.getStats().size).toBe(1);

      await adapter.clear();
      expect(adapter.getStats().size).toBe(0);
    });
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;
  let mockAdapter: jest.Mocked<CacheAdapter>;

  beforeEach(() => {
    mockAdapter = {
      get: jest.fn().mockResolvedValue(null) as any,
      set: jest.fn().mockResolvedValue(undefined) as any,
      delete: jest.fn().mockResolvedValue(undefined) as any,
      clear: jest.fn().mockResolvedValue(undefined) as any,
    };

    manager = new CacheManager({
      enabled: true,
      adapter: mockAdapter,
      keyPrefix: 'test:',
      ttl: 300,
    });
  });

  describe('Key generation', () => {
    it('should generate keys with prefix', () => {
      const key = manager.generateKey('getList', 'users');

      expect(key).toContain('test:');
      expect(key).toContain('getList');
      expect(key).toContain('users');
    });

    it('should include params in key', () => {
      const key = manager.generateKey('getList', 'users', {
        page: 1,
        pageSize: 10,
      });

      expect(key).toContain('page');
      expect(key).toContain('pageSize');
    });

    it('should generate consistent keys for same inputs', () => {
      const key1 = manager.generateKey('getList', 'users', { page: 1 });
      const key2 = manager.generateKey('getList', 'users', { page: 1 });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = manager.generateKey('getList', 'users', { page: 1 });
      const key2 = manager.generateKey('getList', 'users', { page: 2 });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Get and Set operations', () => {
    it('should delegate get to adapter', async () => {
      mockAdapter.get.mockResolvedValue({ data: [] });

      const value = await manager.get('test:key');

      expect(mockAdapter.get).toHaveBeenCalledWith('test:key');
      expect(value).toEqual({ data: [] });
    });

    it('should delegate set to adapter with default TTL', async () => {
      await manager.set('test:key', { data: [] });

      expect(mockAdapter.set).toHaveBeenCalledWith('test:key', { data: [] }, 300);
    });

    it('should use custom TTL when provided', async () => {
      await manager.set('test:key', { data: [] }, 600);

      expect(mockAdapter.set).toHaveBeenCalledWith('test:key', { data: [] }, 600);
    });

    it('should return null when disabled', async () => {
      const disabledManager = new CacheManager({
        enabled: false,
        adapter: mockAdapter,
      });

      const value = await disabledManager.get('test:key');

      expect(value).toBeNull();
      expect(mockAdapter.get).not.toHaveBeenCalled();
    });

    it('should not set when disabled', async () => {
      const disabledManager = new CacheManager({
        enabled: false,
        adapter: mockAdapter,
      });

      await disabledManager.set('test:key', { data: [] });

      expect(mockAdapter.set).not.toHaveBeenCalled();
    });
  });

  describe('Invalidation', () => {
    it('should invalidate resource cache', async () => {
      await manager.invalidate('users');

      expect(mockAdapter.delete).toHaveBeenCalledWith('test:*:users:*');
    });

    it('should invalidate by pattern', async () => {
      await manager.invalidatePattern('users:list:*');

      expect(mockAdapter.delete).toHaveBeenCalledWith('test:users:list:*');
    });

    it('should clear all cache', async () => {
      await manager.clear();

      expect(mockAdapter.clear).toHaveBeenCalled();
    });

    it('should fallback to delete if clear not available', async () => {
      const adapterWithoutClear: CacheAdapter = {
        get: jest.fn().mockResolvedValue(null) as any,
        set: jest.fn().mockResolvedValue(undefined) as any,
        delete: jest.fn().mockResolvedValue(undefined) as any,
        // No clear method
      };

      const managerWithoutClear = new CacheManager({
        enabled: true,
        adapter: adapterWithoutClear,
        keyPrefix: 'test:',
      });

      await managerWithoutClear.clear();

      expect(adapterWithoutClear.delete).toHaveBeenCalledWith('test:*');
    });

    it('should not invalidate when disabled', async () => {
      const disabledManager = new CacheManager({
        enabled: false,
        adapter: mockAdapter,
      });

      await disabledManager.invalidate('users');

      expect(mockAdapter.delete).not.toHaveBeenCalled();
    });
  });

  describe('Integration with MemoryCacheAdapter', () => {
    let integratedManager: CacheManager;

    beforeEach(() => {
      integratedManager = new CacheManager({
        enabled: true,
        adapter: 'memory',
        maxSize: 10,
        ttl: 1,
      });
    });

    it('should store and retrieve values', async () => {
      const key = integratedManager.generateKey('getList', 'users', { page: 1 });
      await integratedManager.set(key, { data: [{ id: 1 }], total: 1 });

      const value = await integratedManager.get(key);

      expect(value).toEqual({ data: [{ id: 1 }], total: 1 });
    });

    it('should handle resource invalidation', async () => {
      const key1 = integratedManager.generateKey('getList', 'users');
      const key2 = integratedManager.generateKey('getOne', 'users');
      const key3 = integratedManager.generateKey('getList', 'posts');

      await integratedManager.set(key1, { data: [] });
      await integratedManager.set(key2, { data: {} });
      await integratedManager.set(key3, { data: [] });

      await integratedManager.invalidate('users');

      expect(await integratedManager.get(key1)).toBeNull();
      expect(await integratedManager.get(key2)).toBeNull();
      expect(await integratedManager.get(key3)).not.toBeNull();
    });

    it('should handle TTL expiration', async () => {
      const key = integratedManager.generateKey('getList', 'users');
      await integratedManager.set(key, { data: [] }, 0);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await integratedManager.get(key)).toBeNull();
    });
  });

  describe('Custom key prefix', () => {
    it('should use default prefix', () => {
      const defaultManager = new CacheManager({
        enabled: true,
        adapter: mockAdapter,
      });

      const key = defaultManager.generateKey('getList', 'users');

      expect(key).toMatch(/^refine-sqlx:/);
    });

    it('should use custom prefix', () => {
      const customManager = new CacheManager({
        enabled: true,
        adapter: mockAdapter,
        keyPrefix: 'myapp:cache:',
      });

      const key = customManager.generateKey('getList', 'users');

      expect(key).toMatch(/^myapp:cache:/);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      const enabledManager = new CacheManager({
        enabled: true,
        adapter: mockAdapter,
      });

      expect(enabledManager.isEnabled()).toBe(true);
    });

    it('should return disabled status', () => {
      const disabledManager = new CacheManager({
        enabled: false,
        adapter: mockAdapter,
      });

      expect(disabledManager.isEnabled()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', async () => {
      await manager.set('key', null);

      const value = await manager.get('key');

      expect(value).toBeNull();
    });

    it('should handle undefined params', () => {
      const key1 = manager.generateKey('getList', 'users');
      const key2 = manager.generateKey('getList', 'users', undefined);

      expect(key1).toBe(key2);
    });

    it('should handle empty params', () => {
      const key1 = manager.generateKey('getList', 'users', {});
      const key2 = manager.generateKey('getList', 'users', undefined);

      // Empty object is serialized differently than undefined
      expect(key1).toContain('getList');
      expect(key2).toContain('getList');
    });

    it('should handle complex nested params', () => {
      const key = manager.generateKey('getList', 'users', {
        filters: [
          { field: 'name', operator: 'contains', value: 'John' },
        ],
        sorters: [
          { field: 'createdAt', order: 'desc' },
        ],
        pagination: { current: 1, pageSize: 10 },
      });

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });
});
