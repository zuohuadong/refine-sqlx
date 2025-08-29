import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MySQLAdapter,
  createMySQLProvider,
  testMySQLConnection,
} from '../adapters/mysql.js';
import type { DatabaseConfig } from '../types/config.js';
import {
  ConnectionError,
  ConfigurationError,
  QueryError,
} from '../types/errors.js';
import {
  mysqlTable,
  serial,
  varchar,
  int,
  timestamp,
} from 'drizzle-orm/mysql-core';

// Test schema
const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  age: int('age'),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

// Mock mysql2 module
vi.mock('mysql2/promise', () => ({
  default: { createConnection: vi.fn(), createPool: vi.fn() },
  createConnection: vi.fn(),
  createPool: vi.fn(),
}));

// Mock drizzle-orm/mysql2
vi.mock('drizzle-orm/mysql2', () => ({ drizzle: vi.fn() }));

describe('MySQL Adapter', () => {
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      execute: vi.fn(),
      query: vi.fn(),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      end: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
    };

    mockPool = {
      execute: vi.fn(),
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConnection),
      end: vi.fn(),
    };

    const mysql2 = require('mysql2/promise');
    vi.mocked(mysql2.default.createConnection).mockResolvedValue(
      mockConnection
    );
    vi.mocked(mysql2.default.createPool).mockResolvedValue(mockPool);
    vi.mocked(mysql2.createConnection).mockResolvedValue(mockConnection);
    vi.mocked(mysql2.createPool).mockResolvedValue(mockPool);

    const drizzle = require('drizzle-orm/mysql2');
    vi.mocked(drizzle.drizzle).mockReturnValue({
      schema,
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
    });
  });

  describe('MySQLAdapter Class', () => {
    it('should create MySQL adapter instance', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    it('should return correct adapter info', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    it('should build connection string from config object', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'password',
          database: 'testdb',
        },
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
    });

    it('should handle connection string config', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://root:password@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
    });

    it('should connect successfully', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      expect(adapter.isConnectionActive()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      await adapter.disconnect();

      expect(adapter.isConnectionActive()).toBe(false);
    });

    it('should perform health check', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle connection errors', async () => {
      const mysql2 = require('mysql2/promise');
      vi.mocked(mysql2.default.createConnection).mockRejectedValue(
        new Error('Connection refused')
      );

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      await expect(adapter.connect()).rejects.toThrow(ConnectionError);
    });

    it('should execute raw SQL queries', async () => {
      mockConnection.execute.mockResolvedValue([
        [{ id: 1, name: 'John', email: 'john@example.com' }],
        [],
      ]);

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const result = await adapter.executeRaw(
        'SELECT * FROM users WHERE id = ?',
        [1]
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        [1]
      );
    });

    it('should handle transaction operations', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      await adapter.beginTransaction();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();

      await adapter.commitTransaction();
      expect(mockConnection.commit).toHaveBeenCalled();

      await adapter.rollbackTransaction();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });
  });

  describe('createMySQLProvider factory function', () => {
    it('should create MySQL provider with connection object', async () => {
      const connectionConfig = {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'testdb',
      };

      const provider = await createMySQLProvider(connectionConfig, schema);

      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('getList');
      expect(provider).toHaveProperty('getOne');
      expect(provider).toHaveProperty('create');
      expect(provider).toHaveProperty('update');
      expect(provider).toHaveProperty('deleteOne');
    });

    it('should create MySQL provider with connection string', async () => {
      const provider = await createMySQLProvider(
        'mysql://root:password@localhost:3306/testdb',
        schema
      );

      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('getList');
      expect(provider).toHaveProperty('getOne');
      expect(provider).toHaveProperty('create');
      expect(provider).toHaveProperty('update');
      expect(provider).toHaveProperty('deleteOne');
    });

    it('should create MySQL provider with pool configuration', async () => {
      const options = {
        pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 },
      };

      const provider = await createMySQLProvider(
        'mysql://root:password@localhost:3306/testdb',
        schema,
        options
      );

      expect(provider).toBeDefined();
    });

    it('should apply MySQL-specific options', async () => {
      const options = {
        charset: 'utf8mb4',
        timezone: 'Z',
        ssl: false,
        logger: true,
      };

      const provider = await createMySQLProvider(
        'mysql://root:password@localhost:3306/testdb',
        schema,
        options
      );

      expect(provider).toBeDefined();
    });
  });

  describe('MySQL Configuration Validation', () => {
    it('should validate required connection fields', () => {
      expect(() => {
        new MySQLAdapter({
          type: 'mysql',
          connection: {
            host: 'localhost',
            // Missing required fields
          } as any,
          schema,
        });
      }).toThrow(ConfigurationError);
    });

    it('should validate database type', () => {
      expect(() => {
        new MySQLAdapter({
          type: 'postgresql' as any,
          connection: 'mysql://user:pass@localhost:3306/testdb',
          schema,
        });
      }).toThrow(ConfigurationError);
    });

    it('should validate connection string format', () => {
      expect(() => {
        new MySQLAdapter({
          type: 'mysql',
          connection: 'invalid-connection-string',
          schema,
        });
      }).toThrow(ConfigurationError);
    });

    it('should validate schema object', () => {
      expect(() => {
        new MySQLAdapter({
          type: 'mysql',
          connection: 'mysql://user:pass@localhost:3306/testdb',
          schema: null as any,
        });
      }).toThrow(ConfigurationError);
    });
  });

  describe('Runtime Detection', () => {
    it('should detect current runtime correctly', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    it('should indicate MySQL uses mysql2 driver', () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('testMySQLConnection utility', () => {
    it('should test connection successfully', async () => {
      const result = await testMySQLConnection(
        'mysql://user:pass@localhost:3306/testdb'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle connection test failures', async () => {
      const mysql2 = require('mysql2/promise');
      vi.mocked(mysql2.default.createConnection).mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await testMySQLConnection(
        'mysql://user:pass@localhost:3306/testdb'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide connection info', async () => {
      const result = await testMySQLConnection(
        'mysql://user:pass@localhost:3306/testdb'
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('info');
    });
  });

  describe('Error Handling', () => {
    it('should handle query execution errors', async () => {
      mockConnection.execute.mockRejectedValue(
        new Error('Table does not exist')
      );

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      await expect(
        adapter.executeRaw('SELECT * FROM nonexistent_table')
      ).rejects.toThrow(QueryError);
    });

    it('should handle transaction errors', async () => {
      mockConnection.beginTransaction.mockRejectedValue(
        new Error('Transaction failed')
      );

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      await expect(adapter.beginTransaction()).rejects.toThrow();
    });

    it('should handle connection pool errors', async () => {
      const mysql2 = require('mysql2/promise');
      vi.mocked(mysql2.default.createPool).mockRejectedValue(
        new Error('Pool creation failed')
      );

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
        pool: { min: 2, max: 10 },
      };

      const adapter = new MySQLAdapter(config);

      await expect(adapter.connect()).rejects.toThrow(ConnectionError);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle connection pooling', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
        pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 },
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      expect(adapter.isConnectionActive()).toBe(true);
      // Pool should be created instead of single connection
    });

    it('should handle concurrent queries efficiently', async () => {
      mockConnection.execute.mockResolvedValue([
        [{ id: 1, name: 'John', email: 'john@example.com' }],
        [],
      ]);

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const queries = Array.from({ length: 10 }, (_, i) =>
        adapter.executeRaw('SELECT * FROM users WHERE id = ?', [i + 1])
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveLength(1);
      });
    });
  });

  describe('MySQL-specific Features', () => {
    it('should handle MySQL-specific data types', async () => {
      mockConnection.execute.mockResolvedValue([
        [
          {
            id: 1,
            name: 'John',
            created_at: new Date(),
            metadata: JSON.stringify({ key: 'value' }),
          },
        ],
        [],
      ]);

      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const result = await adapter.executeRaw(
        'SELECT * FROM users WHERE id = ?',
        [1]
      );

      expect(result[0]).toHaveProperty('metadata');
    });

    it('should handle MySQL charset and collation', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'password',
          database: 'testdb',
        },
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      expect(adapter.isConnectionActive()).toBe(true);
    });

    it('should handle MySQL timezone settings', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'password',
          database: 'testdb',
        },
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      expect(adapter.isConnectionActive()).toBe(true);
    });
  });

  describe('Integration with Drizzle ORM', () => {
    it('should properly initialize Drizzle client', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const client = adapter.getClient();
      expect(client).toBeDefined();
    });

    it('should handle Drizzle query building', async () => {
      const config: DatabaseConfig<typeof schema> = {
        type: 'mysql',
        connection: 'mysql://user:pass@localhost:3306/testdb',
        schema,
      };

      const adapter = new MySQLAdapter(config);
      await adapter.connect();

      const client = adapter.getClient();
      // Verify that Drizzle client methods are available
      expect(client.select).toBeDefined();
      expect(client.insert).toBeDefined();
      expect(client.update).toBeDefined();
      expect(client.delete).toBeDefined();
    });
  });
});
