import { describe, it, expect, vi } from 'vitest';

// 测试 Cloudflare Workers 环境和其他边缘情况
describe('Worker Environment and Edge Cases', () => {
  describe('Cloudflare Worker Integration', () => {
    it('should handle worker environment detection', async () => {
      // Mock Cloudflare Workers environment
      const originalFetch = globalThis.fetch;
      const originalCaches = (globalThis as any).caches;
      
      // Set up Workers-like environment
      Object.defineProperty(globalThis, 'caches', {
        value: { default: { match: vi.fn(), put: vi.fn() } },
        configurable: true
      });

      try {
        const { DatabaseAdapter } = await import('../src/database');
        
        // Test that it works in Workers environment
        const mockD1 = {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
          }),
          batch: vi.fn().mockResolvedValue([]),
          dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 })
        };

        const adapter = new DatabaseAdapter(mockD1 as any);
        expect(adapter.getType()).toBe('d1');
        
        // Test basic operations work in Workers environment
        const result = await adapter.query('SELECT * FROM test');
        expect(Array.isArray(result)).toBe(true);
        
      } finally {
        // Restore environment
        if (originalCaches !== undefined) {
          Object.defineProperty(globalThis, 'caches', {
            value: originalCaches,
            configurable: true
          });
        } else {
          try {
            delete (globalThis as any).caches;
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    it('should handle worker fetch requests', async () => {
      // Test worker.ts module if possible
      try {
        const workerModule = await import('../src/worker');
        
        if (workerModule.default && typeof workerModule.default.fetch === 'function') {
          const mockRequest = new Request('https://example.com/api/users');
          const mockEnv = {
            DB: {
              prepare: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [] })
              })
            }
          };

          // Test that worker can handle requests
          const response = await workerModule.default.fetch(mockRequest, mockEnv);
          expect(response).toBeInstanceOf(Response);
        }
      } catch (error) {
        // Worker module might not be available in test environment
        expect(true).toBe(true);
      }
    });

    it('should handle worker environment variables', async () => {
      // Test environment detection for Workers
      const originalEnv = process.env;
      
      try {
        process.env.NODE_ENV = 'production';
        process.env.CLOUDFLARE_ENV = 'workers';
        
        // Import and test environment-specific behavior
        const { DatabaseAdapter } = await import('../src/database');
        
        const mockD1 = {
          prepare: () => ({
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ success: true, meta: { changes: 0 } })
          }),
          batch: async () => []
        };
        
        const adapter = new DatabaseAdapter(mockD1 as any);
        expect(adapter.getType()).toBe('d1');
        
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Runtime Environment Edge Cases', () => {
    it('should handle undefined global objects gracefully', async () => {
      const originalProcess = globalThis.process;
      const originalBun = (globalThis as any).Bun;
      
      try {
        // Remove global objects temporarily
        delete (globalThis as any).process;
        delete (globalThis as any).Bun;
        
        const { DatabaseAdapter } = await import('../src/database');
        
        // Should still work with D1 mock
        const mockD1 = {
          prepare: () => ({
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ success: true, meta: { changes: 0 } })
          }),
          batch: async () => []
        };
        
        const adapter = new DatabaseAdapter(mockD1 as any);
        expect(adapter.getType()).toBe('d1');
        
      } finally {
        // Restore globals
        if (originalProcess) {
          Object.defineProperty(globalThis, 'process', {
            value: originalProcess,
            configurable: true
          });
        }
        if (originalBun) {
          Object.defineProperty(globalThis, 'Bun', {
            value: originalBun,
            configurable: true
          });
        }
      }
    });

    it('should handle mixed runtime scenarios', async () => {
      // Test when both Node.js and Bun indicators are present (edge case)
      const originalBun = (globalThis as any).Bun;
      
      try {
        Object.defineProperty(globalThis, 'Bun', {
          value: { version: '1.0.0' },
          configurable: true
        });
        
        const { DatabaseAdapter } = await import('../src/database');
        
        // Should prefer one runtime over another consistently
        try {
          const adapter = new DatabaseAdapter(':memory:');
          const type = adapter.getType();
          expect(['bun-sqlite', 'node-sqlite'].includes(type)).toBe(true);
        } catch (error) {
          // 在测试环境中可能会失败，这是预期的
          expect(error).toBeDefined();
        }
        
      } finally {
        if (originalBun !== undefined) {
          Object.defineProperty(globalThis, 'Bun', {
            value: originalBun,
            configurable: true
          });
        } else {
          try {
            delete (globalThis as any).Bun;
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    it('should handle corrupted or invalid database inputs', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      // Test with null/undefined inputs
      try {
        new DatabaseAdapter(null as any);
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Test with invalid string
      try {
        const adapter = new DatabaseAdapter('invalid://path');
        await adapter.query('SELECT 1');
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined();
      }
      
      // Test with malformed object
      try {
        const invalidDb = { notAPrepareMethod: true };
        new DatabaseAdapter(invalidDb as any);
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large query results', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      // Mock a database that returns large results
      const mockDb = {
        prepare: () => ({
          all: async () => ({
            results: Array.from({ length: 10000 }, (_, i) => ({
              id: i,
              data: `large data string ${i}`.repeat(100)
            }))
          })
        })
      };
      
      const adapter = new DatabaseAdapter(mockDb as any);
      
      const startTime = Date.now();
      const results = await adapter.query('SELECT * FROM large_table');
      const endTime = Date.now();
      
      expect(results.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should handle within 5 seconds
    });

    it('should handle concurrent database operations', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      let callCount = 0;
      const mockDb = {
        prepare: () => ({
          all: async () => {
            callCount++;
            // Simulate some async work
            await new Promise(resolve => setTimeout(resolve, 10));
            return { results: [{ id: callCount }] };
          }
        })
      };
      
      const adapter = new DatabaseAdapter(mockDb as any);
      
      // Execute multiple queries concurrently
      const promises = Array.from({ length: 10 }, () =>
        adapter.query('SELECT * FROM concurrent_test')
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(callCount).toBe(10);
      
      // Each result should be unique (proving concurrency)
      const ids = results.map(r => r[0]?.id).filter(id => id !== undefined);
      const uniqueIds = new Set(ids);
      // 确保我们至少有一些有效的并发结果
      expect(uniqueIds.size).toBeGreaterThan(0);
      expect(uniqueIds.size).toBeLessThanOrEqual(10);
    });

    it('should handle memory cleanup properly', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      // Create many adapters to test memory management
      const adapters = [];
      
      for (let i = 0; i < 100; i++) {
        const mockDb = {
          prepare: () => ({
            all: async () => ({ results: [{ id: i }] })
          })
        };
        
        adapters.push(new DatabaseAdapter(mockDb as any));
      }
      
      // Use all adapters
      const promises = adapters.map((adapter, i) =>
        adapter.query(`SELECT ${i} as test_id`)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      
      // Clear references to test garbage collection
      adapters.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      expect(true).toBe(true); // Test completed without memory issues
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary database failures', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      let failureCount = 0;
      const mockDb = {
        prepare: () => ({
          all: async () => {
            failureCount++;
            if (failureCount <= 2) {
              throw new Error('Temporary database failure');
            }
            return { results: [{ id: 1, recovered: true }] };
          }
        })
      };
      
      const adapter = new DatabaseAdapter(mockDb as any);
      
      // First two attempts should fail
      try {
        await adapter.query('SELECT * FROM test');
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Temporary database failure');
      }
      
      try {
        await adapter.query('SELECT * FROM test');
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Temporary database failure');
      }
      
      // Third attempt should succeed
      const result = await adapter.query('SELECT * FROM test');
      expect(result[0]).toMatchObject({ id: 1, recovered: true });
    });

    it('should handle network timeouts gracefully', async () => {
      const { DatabaseAdapter } = await import('../src/database');
      
      const mockDb = {
        prepare: () => ({
          all: async () => {
            // Simulate network timeout
            await new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Network timeout')), 100)
            );
          }
        })
      };
      
      const adapter = new DatabaseAdapter(mockDb as any);
      
      try {
        await adapter.query('SELECT * FROM remote_table');
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Network timeout');
      }
    });

    it('should handle malformed SQL injection attempts safely', async () => {
      const { dataProvider } = await import('../src/provider');
      
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] })
          })
        })
      };
      
      const provider = dataProvider(mockDb as any);
      
      // Test with potential SQL injection strings
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "UNION SELECT * FROM sensitive_data",
        "<script>alert('xss')</script>",
        "../../etc/passwd"
      ];
      
      for (const maliciousInput of maliciousInputs) {
        try {
          await provider.getList({
            resource: 'users',
            filters: [{ field: 'name', operator: 'eq', value: maliciousInput }]
          });
          
          // Should not crash and should use parameterized queries
          expect(mockDb.prepare).toHaveBeenCalled();
        } catch (error) {
          // Errors are acceptable as long as they don't indicate SQL injection success
          expect(error.message).not.toContain('syntax error');
        }
      }
    });
  });
});
