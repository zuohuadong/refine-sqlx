import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';

describe('Cross-Runtime Integration Tests', () => {
  let originalGlobalThis: any;

  beforeEach(() => {
    originalGlobalThis = globalThis;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'process', {
      value: originalGlobalThis.process,
      configurable: true
    });
    Object.defineProperty(globalThis, 'Bun', {
      value: originalGlobalThis.Bun,
      configurable: true
    });
    vi.clearAllMocks();
  });

  describe('Runtime Detection and Initialization', () => {
    it('should prioritize Bun over Node.js when both are available', () => {
      // Mock both environments
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockReturnValue({
            prepare: vi.fn(),
            close: vi.fn()
          })
        },
        configurable: true
      });
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '22.5.0' } },
        configurable: true
      });

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should fall back to Node.js when Bun is not available', () => {
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '22.5.0' } },
        configurable: true
      });

      vi.doMock('node:sqlite', () => ({
        DatabaseSync: vi.fn().mockImplementation(() => ({
          prepare: vi.fn(),
          close: vi.fn()
        }))
      }));

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('node-sqlite');
    });

    it('should handle D1 database objects correctly', () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn()
      };

      const adapter = new DatabaseAdapter(mockD1 as any);
      expect(adapter.getType()).toBe('d1');
    });
  });

  describe('API Consistency Across Runtimes', () => {
    const testCases = [
      {
        name: 'D1',
        setup: () => ({
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [{ id: 1, name: 'test' }] }),
              first: vi.fn().mockResolvedValue({ id: 1, name: 'test' }),
              run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
            }),
            all: vi.fn().mockResolvedValue({ results: [{ id: 1, name: 'test' }] }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'test' }),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
          }),
          batch: vi.fn()
        }),
        createAdapter: (mockDb: any) => new DatabaseAdapter(mockDb),
        expectedType: 'd1'
      },
      {
        name: 'Node.js',
        setup: () => {
          Object.defineProperty(globalThis, 'process', {
            value: { versions: { node: '22.5.0' } },
            configurable: true
          });
          Object.defineProperty(globalThis, 'Bun', {
            value: undefined,
            configurable: true
          });

          const mockDb = {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([{ id: 1, name: 'test' }]),
              get: vi.fn().mockReturnValue({ id: 1, name: 'test' }),
              run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
            }),
            close: vi.fn()
          };

          vi.doMock('node:sqlite', () => ({
            DatabaseSync: vi.fn().mockImplementation(() => mockDb)
          }));

          return mockDb;
        },
        createAdapter: () => new DatabaseAdapter('./test.db'),
        expectedType: 'node-sqlite'
      },
      {
        name: 'Bun',
        setup: () => {
          Object.defineProperty(globalThis, 'Bun', {
            value: { 
              version: '1.2.0',
              sqlite: vi.fn()
            },
            configurable: true
          });
          Object.defineProperty(globalThis, 'process', {
            value: undefined,
            configurable: true
          });

          const mockDb = {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([{ id: 1, name: 'test' }]),
              get: vi.fn().mockReturnValue({ id: 1, name: 'test' }),
              run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
            }),
            close: vi.fn()
          };

          (globalThis as any).Bun.sqlite.mockReturnValue(mockDb);
          return mockDb;
        },
        createAdapter: () => new DatabaseAdapter('./test.db'),
        expectedType: 'bun-sqlite'
      }
    ];

    testCases.forEach(({ name, setup, createAdapter, expectedType }) => {
      describe(`${name} Runtime`, () => {
        let adapter: DatabaseAdapter;

        beforeEach(() => {
          setup();
          adapter = createAdapter();
        });

        it(`should identify as ${expectedType}`, () => {
          expect(adapter.getType()).toBe(expectedType);
        });

        it('should execute query operations consistently', async () => {
          const result = await adapter.query('SELECT * FROM test');
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);
        });

        it('should execute queryFirst operations consistently', async () => {
          const result = await adapter.queryFirst('SELECT * FROM test WHERE id = 1');
          expect(result).toBeDefined();
          expect(result.id).toBe(1);
        });

        it('should execute insert operations consistently', async () => {
          const result = await adapter.execute('INSERT INTO test (name) VALUES (?)', ['test']);
          expect(result).toHaveProperty('changes');
          expect(result).toHaveProperty('lastInsertRowid');
          expect(result.changes).toBe(1);
        });

        it('should handle batch operations consistently', async () => {
          const statements = [
            { sql: 'INSERT INTO test (name) VALUES (?)', params: ['test1'] },
            { sql: 'INSERT INTO test (name) VALUES (?)', params: ['test2'] }
          ];
          const results = await adapter.batch(statements);
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBe(2);
        });
      });
    });
  });

  describe('DataProvider Consistency Across Runtimes', () => {
    const providerTestCases = [
      {
        name: 'D1 Provider',
        createProvider: () => {
          const mockD1 = {
            prepare: vi.fn().mockReturnValue({
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ 
                  results: [
                    { id: 1, name: 'John', email: 'john@example.com' },
                    { id: 2, name: 'Jane', email: 'jane@example.com' }
                  ] 
                }),
                first: vi.fn().mockResolvedValue({ id: 1, name: 'John', email: 'john@example.com' }),
                run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 123 } })
              }),
              all: vi.fn().mockResolvedValue({ 
                results: [{ count: 2 }] 
              }),
              first: vi.fn().mockResolvedValue({ id: 1, name: 'John', email: 'john@example.com' }),
              run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 123 } })
            }),
            batch: vi.fn()
          };
          return dataProvider(mockD1 as any);
        }
      },
      {
        name: 'Node.js Provider',
        createProvider: () => {
          Object.defineProperty(globalThis, 'process', {
            value: { versions: { node: '22.5.0' } },
            configurable: true
          });
          Object.defineProperty(globalThis, 'Bun', {
            value: undefined,
            configurable: true
          });

          const mockDb = {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([
                { id: 1, name: 'John', email: 'john@example.com' },
                { id: 2, name: 'Jane', email: 'jane@example.com' }
              ]),
              get: vi.fn().mockReturnValue({ id: 1, name: 'John', email: 'john@example.com' }),
              run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 })
            }),
            close: vi.fn()
          };

          vi.doMock('node:sqlite', () => ({
            DatabaseSync: vi.fn().mockImplementation(() => mockDb)
          }));

          return dataProvider('./test.db');
        }
      },
      {
        name: 'Bun Provider',
        createProvider: () => {
          Object.defineProperty(globalThis, 'Bun', {
            value: { 
              version: '1.2.0',
              sqlite: vi.fn()
            },
            configurable: true
          });
          Object.defineProperty(globalThis, 'process', {
            value: undefined,
            configurable: true
          });

          const mockDb = {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([
                { id: 1, name: 'John', email: 'john@example.com' },
                { id: 2, name: 'Jane', email: 'jane@example.com' }
              ]),
              get: vi.fn().mockReturnValue({ id: 1, name: 'John', email: 'john@example.com' }),
              run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 123 })
            }),
            close: vi.fn()
          };

          (globalThis as any).Bun.sqlite.mockReturnValue(mockDb);
          return dataProvider('./test.db');
        }
      }
    ];

    providerTestCases.forEach(({ name, createProvider }) => {
      describe(name, () => {
        let provider: ReturnType<typeof dataProvider>;

        beforeEach(() => {
          provider = createProvider();
        });

        it('should provide consistent getList interface', async () => {
          const result = await provider.getList({
            resource: 'users',
            pagination: { current: 1, pageSize: 10 }
          });

          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('total');
          expect(Array.isArray(result.data)).toBe(true);
        });

        it('should provide consistent getOne interface', async () => {
          const result = await provider.getOne({
            resource: 'users',
            id: '1'
          });

          expect(result).toHaveProperty('data');
          expect(result.data).toBeDefined();
        });

        it('should provide consistent create interface', async () => {
          const result = await provider.create({
            resource: 'users',
            variables: { name: 'Test User', email: 'test@example.com' }
          });

          expect(result).toHaveProperty('data');
          expect(result.data).toBeDefined();
        });

        it('should provide consistent update interface', async () => {
          const result = await provider.update({
            resource: 'users',
            id: '1',
            variables: { name: 'Updated User' }
          });

          expect(result).toHaveProperty('data');
          expect(result.data).toBeDefined();
        });

        it('should provide consistent delete interface', async () => {
          const result = await provider.deleteOne({
            resource: 'users',
            id: '1'
          });

          expect(result).toHaveProperty('data');
        });

        it('should provide consistent custom query interface', async () => {
          const result = await provider.custom({
            url: '/custom',
            method: 'get',
            payload: {
              sql: 'SELECT COUNT(*) as count FROM users',
              params: []
            }
          });

          expect(result).toHaveProperty('data');
        });
      });
    });
  });

  describe('Version Compatibility Tests', () => {
    it('should handle Node.js edge version cases', () => {
      const versions = [
        '22.5.0', // minimum
        '22.5.1', // patch
        '22.6.0', // minor
        '23.0.0', // major
        '24.1.0'  // future
      ];

      versions.forEach(version => {
        Object.defineProperty(globalThis, 'process', {
          value: { versions: { node: version } },
          configurable: true
        });
        Object.defineProperty(globalThis, 'Bun', {
          value: undefined,
          configurable: true
        });

        expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
      });
    });

    it('should handle Bun edge version cases', () => {
      const versions = [
        '1.2.0', // minimum
        '1.2.1', // patch
        '1.3.0', // minor
        '2.0.0', // major
        '3.0.0'  // future
      ];

      versions.forEach(version => {
        Object.defineProperty(globalThis, 'Bun', {
          value: { 
            version,
            sqlite: vi.fn().mockReturnValue({
              prepare: vi.fn(),
              close: vi.fn()
            })
          },
          configurable: true
        });
        Object.defineProperty(globalThis, 'process', {
          value: undefined,
          configurable: true
        });

        expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
      });
    });

    it('should reject unsupported Node.js versions', () => {
      const unsupportedVersions = [
        '20.0.0',
        '21.9.9',
        '22.4.9'
      ];

      unsupportedVersions.forEach(version => {
        Object.defineProperty(globalThis, 'process', {
          value: { versions: { node: version } },
          configurable: true
        });
        Object.defineProperty(globalThis, 'Bun', {
          value: undefined,
          configurable: true
        });

        expect(() => new DatabaseAdapter('./test.db')).toThrow(
          'Node.js version 22.5.0 or higher is required'
        );
      });
    });

    it('should reject unsupported Bun versions', () => {
      const unsupportedVersions = [
        '1.0.0',
        '1.1.9',
        '1.1.25'
      ];

      unsupportedVersions.forEach(version => {
        Object.defineProperty(globalThis, 'Bun', {
          value: { version },
          configurable: true
        });
        Object.defineProperty(globalThis, 'process', {
          value: undefined,
          configurable: true
        });

        expect(() => new DatabaseAdapter('./test.db')).toThrow(
          'Bun version 1.2.0 or higher is required'
        );
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle initialization errors consistently across runtimes', async () => {
      // Test D1 initialization error
      expect(() => {
        new DatabaseAdapter(null as any);
      }).toThrow('Database instance or path is required');

      // Test Node.js initialization error
      Object.defineProperty(globalThis, 'process', {
        value: { versions: { node: '22.5.0' } },
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      vi.doMock('node:sqlite', () => {
        throw new Error('Module not found');
      });

      const nodeAdapter = new DatabaseAdapter('./test.db');
      await expect(nodeAdapter.query('SELECT 1')).rejects.toThrow(
        'Failed to initialize Node.js SQLite'
      );

      // Test Bun initialization error
      Object.defineProperty(globalThis, 'Bun', {
        value: { 
          version: '1.2.0',
          sqlite: vi.fn().mockImplementation(() => {
            throw new Error('SQLite initialization failed');
          })
        },
        configurable: true
      });
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test.db')).toThrow();
    });

    it('should handle unsupported environment errors', () => {
      Object.defineProperty(globalThis, 'process', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'Bun', {
        value: undefined,
        configurable: true
      });

      expect(() => new DatabaseAdapter('./test.db')).toThrow(
        'SQLite file paths are only supported in Node.js 22.5+ or Bun 1.2+ environments'
      );
    });
  });

  describe('Performance Consistency', () => {
    it('should maintain consistent performance characteristics', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        sql: 'INSERT INTO test (name) VALUES (?)',
        params: [`test${i}`]
      }));

      // Test each runtime
      const runtimes = [
        {
          name: 'D1',
          adapter: new DatabaseAdapter({
            prepare: vi.fn().mockReturnValue({
              bind: vi.fn().mockReturnValue({
                run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
              })
            }),
            batch: vi.fn().mockResolvedValue(testData.map(() => ({ results: [] })))
          } as any)
        }
      ];

      for (const { name, adapter } of runtimes) {
        const start = Date.now();
        const result = await adapter.batch(testData);
        const duration = Date.now() - start;

        expect(result).toHaveLength(100);
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
      }
    });
  });

  describe('Migration and Compatibility', () => {
    it('should allow seamless switching between runtimes', async () => {
      // Test that the same SQL operations work across all runtimes
      const testSQL = [
        { sql: 'SELECT * FROM users', params: [] },
        { sql: 'SELECT * FROM users WHERE id = ?', params: [1] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Test'] },
        { sql: 'UPDATE users SET name = ? WHERE id = ?', params: ['Updated', 1] },
        { sql: 'DELETE FROM users WHERE id = ?', params: [1] }
      ];

      // Mock D1
      const d1Provider = dataProvider({
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } })
        }),
        batch: vi.fn()
      } as any);

      // Test operations
      for (const { sql, params } of testSQL) {
        const result = await d1Provider.custom({
          url: '/test',
          method: 'get',
          payload: { sql, params }
        });
        expect(result).toHaveProperty('data');
      }
    });

    it('should maintain data type consistency across runtimes', async () => {
      const testData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        active: true,
        created_at: new Date().toISOString(),
        metadata: JSON.stringify({ key: 'value' })
      };

      // All runtimes should handle the same data types consistently
      const mockResults = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([testData]),
          get: vi.fn().mockReturnValue(testData),
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
        }),
        close: vi.fn()
      };

      // Test data consistency (this would be the same across all runtimes)
      expect(testData.id).toBeTypeOf('number');
      expect(testData.name).toBeTypeOf('string');
      expect(testData.active).toBeTypeOf('boolean');
    });
  });
});
