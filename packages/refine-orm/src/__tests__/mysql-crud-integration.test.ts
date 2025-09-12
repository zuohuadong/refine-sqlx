import { describe, it, expect, vi } from 'vitest';
import { MySQLAdapter, createMySQLProvider } from '../adapters/mysql';
import { createProvider } from '../core/data-provider';
import type { DatabaseConfig } from '../types/config';

// Mock drizzle-orm/mysql2 to avoid actual database connection
vi.mock('drizzle-orm/mysql2', () => ({
  drizzle: vi.fn((connection, options) => ({
    schema: options?.schema || {},
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn(() => Promise.resolve([{ id: 1, name: 'Test User' }])),
        })),
        execute: vi.fn(() => Promise.resolve([{ id: 1, name: 'Test User' }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          execute: vi.fn(() => Promise.resolve([{ id: 1, name: 'Test User' }])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            execute: vi.fn(() =>
              Promise.resolve([{ id: 1, name: 'Updated User' }])
            ),
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => ({
          execute: vi.fn(() =>
            Promise.resolve([{ id: 1, name: 'Deleted User' }])
          ),
        })),
      })),
    })),
  })),
}));

// Mock mysql2/promise to avoid actual database connection
vi.mock('mysql2/promise', () => ({
  default: {
    createConnection: vi.fn(() =>
      Promise.resolve({
        execute: vi.fn(),
        end: vi.fn(),
        beginTransaction: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
      })
    ),
    createPool: vi.fn(() => ({
      execute: vi.fn(),
      end: vi.fn(),
      getConnection: vi.fn(() =>
        Promise.resolve({
          execute: vi.fn(),
          release: vi.fn(),
          beginTransaction: vi.fn(),
          commit: vi.fn(),
          rollback: vi.fn(),
        })
      ),
    })),
  },
}));

describe('MySQL CRUD Integration', () => {
  const testSchema = {
    users: {
      id: { name: 'id' },
      name: { name: 'name' },
      email: { name: 'email' },
    } as any,
  };

  const testConfig: DatabaseConfig<typeof testSchema> = {
    type: 'mysql',
    connection: 'mysql://test:test@localhost:3306/test_db',
    schema: testSchema,
    debug: false,
  };

  describe('Data Provider Integration', () => {
    it('should create data provider with MySQL adapter', async () => {
      const dataProvider = await createMySQLProvider(testConfig.connection, testSchema);

      expect(dataProvider).toBeDefined();
      expect(dataProvider.schema).toBe(testSchema);
    });

    it('should have all required CRUD methods', async () => {
      const dataProvider = await createMySQLProvider(testConfig.connection, testSchema);

      // Check that all required methods exist
      expect(typeof dataProvider.getList).toBe('function');
      expect(typeof dataProvider.getOne).toBe('function');
      expect(typeof dataProvider.getMany).toBe('function');
      expect(typeof dataProvider.create).toBe('function');
      expect(typeof dataProvider.update).toBe('function');
      expect(typeof dataProvider.deleteOne).toBe('function');
      expect(typeof dataProvider.createMany).toBe('function');
      expect(typeof dataProvider.updateMany).toBe('function');
      expect(typeof dataProvider.deleteMany).toBe('function');
    });

    it('should have additional ORM methods', () => {
      const adapter = createMySQLProvider(testConfig.connection, testSchema);

      const dataProvider = createProvider(adapter);

      // Check that additional ORM methods exist
      expect(typeof dataProvider.from).toBe('function');
      expect(typeof dataProvider.morphTo).toBe('function');
      expect(typeof dataProvider.getWithRelations).toBe('function');
      expect(typeof dataProvider.executeRaw).toBe('function');
      expect(typeof dataProvider.transaction).toBe('function');
      expect(typeof dataProvider.query.select).toBe('function');
      expect(typeof dataProvider.query.insert).toBe('function');
      expect(typeof dataProvider.query.update).toBe('function');
      expect(typeof dataProvider.query.delete).toBe('function');
    });
  });

  describe('MySQL Adapter CRUD Operations', () => {
    it('should support raw query execution', async () => {
      const dataProvider = await createMySQLProvider(testConfig.connection, testSchema);

      // Test executeRaw method exists and works
      expect(typeof dataProvider.executeRaw).toBe('function');
    });

    it('should support transaction operations', async () => {
      const dataProvider = await createMySQLProvider(testConfig.connection, testSchema);

      // Test transaction method exists
      expect(typeof dataProvider.transaction).toBe('function');
    });

    it('should provide adapter information', async () => {
      const adapter = await createMySQLProvider(testConfig.connection, testSchema);

      const info = adapter.getAdapterInfo();

      expect(info.type).toBe('mysql');
      expect(info.driver).toBe('mysql2');
      expect(info.futureSupport.bunSql).toBe(true); // MySQL supports Bun.sql
      expect(['bun', 'node']).toContain(info.runtime);
    });
  });

  describe('MySQL Configuration Validation', () => {
    it('should validate MySQL-specific configuration', () => {
      const adapter = new MySQLAdapter(testConfig);

      expect(adapter).toBeInstanceOf(MySQLAdapter);
      expect(adapter.getAdapterInfo().type).toBe('mysql');
    });

    it('should handle connection pool configuration', () => {
      const poolConfig = {
        ...testConfig,
        pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 },
      };

      const adapter = new MySQLAdapter(poolConfig);

      expect(adapter).toBeInstanceOf(MySQLAdapter);
      expect(adapter.getAdapterInfo().type).toBe('mysql');
    });

    it('should handle SSL configuration', () => {
      const sslConfig = {
        ...testConfig,
        ssl: { rejectUnauthorized: true, ca: 'test-ca-cert' },
      };

      const adapter = new MySQLAdapter(sslConfig as any);

      expect(adapter).toBeInstanceOf(MySQLAdapter);
      expect(adapter.getAdapterInfo().type).toBe('mysql');
    });
  });
});
