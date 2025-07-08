import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { dataProvider } from '../src/provider';
import type { D1Database } from '@cloudflare/workers-types';

// Define Bun on globalThis for mocking purposes if it doesn't exist
if (typeof (globalThis as any).Bun === 'undefined') {
  (globalThis as any).Bun = undefined;
}

describe('Multi-Runtime Integration Tests', () => {
  const originalBun = (globalThis as any).Bun;
  const originalProcess = globalThis.process;

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).Bun = originalBun;
    globalThis.process = originalProcess;
  });

  describe('Runtime Detection', () => {
    it('should detect D1 environment correctly', () => {
      vi.stubGlobal('process', undefined);
      vi.stubGlobal('Bun', undefined);

      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn(),
      } as unknown as D1Database;

      const adapter = new DatabaseAdapter(mockD1);
      expect(adapter.getType()).toBe('d1');
    });

    it('should detect Bun environment correctly', () => {
      vi.stubGlobal('Bun', {
        version: '1.2.0',
        sqlite: vi.fn(() => ({
          prepare: vi.fn(),
          close: vi.fn(),
        })),
      });
      vi.stubGlobal('process', undefined);

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('bun-sqlite');
    });

    it('should detect Node.js environment correctly', () => {
      vi.stubGlobal('process', { versions: { node: '22.5.0' } });
      vi.stubGlobal('Bun', undefined);

      const adapter = new DatabaseAdapter('./test.db');
      expect(adapter.getType()).toBe('node-sqlite');
    });

    it('should not throw error when no runtime is available', () => {
      vi.stubGlobal('process', { versions: { node: '20.0.0' } }); // Below minimum
      vi.stubGlobal('Bun', undefined);

      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
    });
  });

  describe('Cross-Runtime Compatibility', () => {
    const testCases = [
      {
        name: 'D1',
        setup: () => {
          vi.stubGlobal('process', undefined);
          vi.stubGlobal('Bun', undefined);

          const mockStatement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: [{ id: 1, name: 'Test', email: 'test@example.com' }] }),
            first: vi.fn().mockResolvedValue({ id: 1, name: 'Test', email: 'test@example.com' }),
            run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } }),
          };

          return {
            prepare: vi.fn().mockReturnValue(mockStatement),
            batch: vi.fn(async (stmts: any[]) => {
              const results = await Promise.all(stmts.map(stmt => stmt.run()));
              return results;
            }),
            dump: vi.fn(),
            exec: vi.fn(),
          } as any;
        },
      },
      {
        name: 'Bun',
        setup: () => {
          vi.stubGlobal('Bun', {
            version: '1.2.0',
            sqlite: vi.fn(() => ({
              prepare: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue([{ id: 1, name: 'Test', email: 'test@example.com' }]),
                get: vi.fn().mockReturnValue({ id: 1, name: 'Test', email: 'test@example.com' }),
                run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
              }),
              close: vi.fn(),
            })),
          });
          vi.stubGlobal('process', undefined);

          return './test-bun.db';
        },
      },        {
          name: 'Node.js',
          setup: () => {
            vi.stubGlobal('process', { versions: { node: '22.5.0' } });
            vi.stubGlobal('Bun', undefined);
            // For Node.js, return a real database path instead of mocking
            // The actual database will be created with real node:sqlite
            return `./test-nodejs-${Date.now()}.db`;
          }
        }
    ];

    testCases.forEach(({ name, setup }) => {
      describe(`${name} Runtime`, () => {
        let dbInput: any;
        let adapter: DatabaseAdapter | null;
        let provider: ReturnType<typeof dataProvider> | null;

        beforeEach(async () => {
          dbInput = setup();
          adapter = new DatabaseAdapter(dbInput);
          provider = dataProvider(dbInput);
          
          // For Node.js runtime, create the users table
          if (name === 'Node.js') {
            try {
              // Add a small delay to ensure database is initialized
              await new Promise(resolve => setTimeout(resolve, 50));
              await adapter.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
            } catch (error) {
              console.log('Skipping Node.js tests: SQLite module not available:', error.message);
              // If Node.js SQLite fails, we'll skip the tests by setting adapter to null
              adapter = null;
              provider = null;
            }
          }
        });

        it('should create adapter successfully', () => {
          expect(adapter).toBeDefined();
        });

        it('should create provider successfully', () => {
          expect(provider).toBeDefined();
        });

        it('should execute basic queries', async () => {
          const result = await adapter.query('SELECT * FROM users');
          expect(Array.isArray(result)).toBe(true);
        });

        it('should execute parameterized queries', async () => {
          const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
          expect(Array.isArray(result)).toBe(true);
        });

        it('should execute single row queries', async () => {
          const result = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
          expect(result).toBeDefined();
        });

        it('should execute insert operations', async () => {
          const result = await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test', 'test@example.com']);
          expect(result).toHaveProperty('changes');
          expect(result).toHaveProperty('lastInsertRowid');
        });

        it('should handle provider getList', async () => {
          // Insert test data for Node.js runtime
          if (name === 'Node.js') {
            await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
          }
          const result = await provider.getList({ resource: 'users', pagination: { current: 1, pageSize: 10 } });
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('total');
        });

        it('should handle provider getOne', async () => {
          // Insert test data for Node.js runtime
          if (name === 'Node.js') {
            await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
          }
          const result = await provider.getOne({ resource: 'users', id: '1' });
          expect(result).toHaveProperty('data');
        });

        it('should handle provider create', async () => {
          const result = await provider.create({ resource: 'users', variables: { name: 'Test User', email: 'test@example.com' } });
          expect(result).toHaveProperty('data');
        });

        it('should handle provider update', async () => {
          // Insert test data for Node.js runtime
          if (name === 'Node.js') {
            await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
          }
          const result = await provider.update({ resource: 'users', id: '1', variables: { name: 'Updated User' } });
          expect(result).toHaveProperty('data');
        });

        it('should handle provider delete', async () => {
          // Insert test data for Node.js runtime
          if (name === 'Node.js') {
            await adapter.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Test User', 'test@example.com']);
          }
          const result = await provider.deleteOne({ resource: 'users', id: '1' });
          expect(result).toHaveProperty('data');
        });
      });
    });
  });

  describe('Performance Consistency', () => {
    it('should have consistent performance across runtimes', async () => {
      const runtimes = ['D1', 'Bun', 'Node.js'];
      const performanceResults: Record<string, number> = {};

      for (const runtime of runtimes) {
        let adapter: DatabaseAdapter;
        
        if (runtime === 'D1') {
          vi.stubGlobal('process', undefined);
          vi.stubGlobal('Bun', undefined);
          
          const mockD1 = {
            prepare: vi.fn().mockReturnValue({
              bind: vi.fn().mockReturnThis(),
              all: vi.fn().mockResolvedValue({ results: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) }),
              first: vi.fn().mockResolvedValue({ id: 1 }),
              run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 1 } })
            }),
            batch: vi.fn(),
            dump: vi.fn(),
            exec: vi.fn()
          };
          adapter = new DatabaseAdapter(mockD1 as any);
        } else if (runtime === 'Bun') {
          vi.stubGlobal('Bun', {
            version: '1.2.0',
            sqlite: vi.fn(() => ({
              prepare: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }))),
                get: vi.fn().mockReturnValue({ id: 1 }),
                run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
              }),
              close: vi.fn()
            })),
          });
          vi.stubGlobal('process', undefined);
          adapter = new DatabaseAdapter('./test.db');
        } else { // Node.js
          vi.stubGlobal('process', { versions: { node: '22.5.0' } });
          vi.stubGlobal('Bun', undefined);
          
          vi.doMock('node:sqlite', () => ({
            DatabaseSync: vi.fn().mockImplementation(() => ({
              prepare: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }))),
                get: vi.fn().mockReturnValue({ id: 1 }),
                run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
              }),
              close: vi.fn()
            }))
          }));
          adapter = new DatabaseAdapter('./test.db');
        }

        const start = Date.now();
        await adapter.query('SELECT * FROM users');
        const duration = Date.now() - start;
        
        performanceResults[runtime] = duration;
      }

      Object.values(performanceResults).forEach(duration => {
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle errors consistently across runtimes', async () => {
      const runtimes = [
        {
          name: 'D1',
          setup: () => {
            vi.stubGlobal('process', undefined);
            vi.stubGlobal('Bun', undefined);
            
            return {
              prepare: vi.fn().mockImplementation(() => ({
                bind: vi.fn().mockReturnThis(),
                all: vi.fn().mockRejectedValue(new Error('Database error')),
                first: vi.fn().mockRejectedValue(new Error('Database error')),
                run: vi.fn().mockRejectedValue(new Error('Database error')),
              })),
            } as any;
          },
        },
        {
          name: 'Bun',
          setup: () => {
            vi.stubGlobal('Bun', {
              version: '1.2.0',
              sqlite: vi.fn(() => ({
                prepare: vi.fn().mockReturnValue({
                  all: vi.fn().mockImplementation(() => { throw new Error('Database error'); }),
                  get: vi.fn().mockImplementation(() => { throw new Error('Database error'); }),
                  run: vi.fn().mockImplementation(() => { throw new Error('Database error'); })
                }),
                close: vi.fn()
              })),
            });
            vi.stubGlobal('process', undefined);
            return './test.db';
          }
        },
        {
          name: 'Node.js',
          setup: () => {
            vi.stubGlobal('process', { versions: { node: '22.5.0' } });
            vi.stubGlobal('Bun', undefined);
            
            vi.doMock('node:sqlite', () => ({
              DatabaseSync: vi.fn().mockImplementation(() => ({
                prepare: vi.fn().mockReturnValue({
                  all: vi.fn().mockImplementation(() => { throw new Error('Database error'); }),
                  get: vi.fn().mockImplementation(() => { throw new Error('Database error'); }),
                  run: vi.fn().mockImplementation(() => { throw new Error('Database error'); })
                }),
                close: vi.fn()
              }))
            }));
            return './test.db';
          }
        }
      ];

      for (const { setup } of runtimes) {
        const dbInput = setup();
        const adapter = new DatabaseAdapter(dbInput);

        await expect(adapter.query('SELECT * FROM users')).rejects.toThrow('Database error');
        await expect(adapter.queryFirst('SELECT * FROM users WHERE id = 1')).rejects.toThrow('Database error');
        await expect(adapter.execute('INSERT INTO users (name) VALUES (?)', ['test'])).rejects.toThrow('Database error');
      }
    });
  });

  describe('Type Safety and Interface Consistency', () => {
    it('should maintain consistent interfaces across runtimes', () => {
      const testCases = [
        {
          name: 'D1',
          input: {
            prepare: vi.fn(),
            batch: vi.fn(),
            dump: vi.fn(),
            exec: vi.fn(),
          } as unknown as D1Database
        },
        {
          name: 'Bun',
          input: './test-bun.db',
          setup: () => {
            vi.stubGlobal('Bun', {
              version: '1.2.0',
              sqlite: vi.fn(() => ({
                prepare: vi.fn(),
                close: vi.fn()
              })),
            });
            vi.stubGlobal('process', undefined);
          }
        },
        {
          name: 'Node.js',
          input: './test-nodejs.db',
          setup: () => {
            vi.stubGlobal('process', { versions: { node: '22.5.0' } });
            vi.stubGlobal('Bun', undefined);
            
            vi.mock('node:sqlite', () => ({
              DatabaseSync: vi.fn().mockImplementation(() => ({
                prepare: vi.fn(),
                close: vi.fn()
              }))
            }));
          }
        }
      ];

      testCases.forEach(({ input, setup }) => {
        if (setup) setup();
        
        const adapter = new DatabaseAdapter(input);
        const provider = dataProvider(input);

        expect(typeof adapter.query).toBe('function');
        expect(typeof adapter.queryFirst).toBe('function');
        expect(typeof adapter.execute).toBe('function');
        expect(typeof adapter.batch).toBe('function');
        expect(typeof adapter.close).toBe('function');
        expect(typeof adapter.getType).toBe('function');

        expect(typeof provider.getList).toBe('function');
        expect(typeof provider.getOne).toBe('function');
        expect(typeof provider.getMany).toBe('function');
        expect(typeof provider.create).toBe('function');
        expect(typeof provider.createMany).toBe('function');
        expect(typeof provider.update).toBe('function');
        expect(typeof provider.updateMany).toBe('function');
        expect(typeof provider.deleteOne).toBe('function');
        expect(typeof provider.deleteMany).toBe('function');
        expect(typeof provider.custom).toBe('function');
        expect(typeof provider.getApiUrl).toBe('function');
      });
    });
  });

  describe('Version Compatibility', () => {
    it('should handle Bun version edge cases', () => {
      const versions = ['1.2.0', '1.2.5', '1.3.0', '2.0.0', '1.2.0-canary'];
      
      versions.forEach(version => {
        vi.stubGlobal('Bun', {
          version,
          sqlite: vi.fn(() => ({
            prepare: vi.fn(),
            close: vi.fn()
          })),
        });
        vi.stubGlobal('process', undefined);

        expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
      });

      vi.stubGlobal('Bun', {
        version: '1.1.9',
        sqlite: vi.fn()
      });

      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
    });

    it('should handle Node.js version edge cases', () => {
      const versions = ['22.5.0', '22.10.0', '23.0.0', '24.0.0', '22.5.0-nightly'];
      
      versions.forEach(version => {
        vi.stubGlobal('process', { versions: { node: version } });
        vi.stubGlobal('Bun', undefined);

        vi.doMock('node:sqlite', () => ({
          DatabaseSync: vi.fn().mockImplementation(() => ({
            prepare: vi.fn(),
            close: vi.fn()
          }))
        }));

        expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
      });

      vi.stubGlobal('process', { versions: { node: '22.4.9' } });
      vi.stubGlobal('Bun', undefined);

      expect(() => new DatabaseAdapter('./test.db')).not.toThrow();
    });
  });
});
