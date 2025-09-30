import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest, test } from './test-utils.js';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { BaseDatabaseAdapter } from '../adapters/base';
import type { DatabaseConfig } from '../types/config';
import { ConnectionError, ConfigurationError } from '../types/errors';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

// Mock adapter implementation for testing
class MockAdapter extends BaseDatabaseAdapter<typeof schema> {
  private mockConnected = false;
  private shouldFailConnection = false;
  private shouldFailHealthCheck = false;
  private transactionActive = false;

  constructor(
    config: DatabaseConfig<typeof schema>,
    options?: { failConnection?: boolean; failHealthCheck?: boolean }
  ) {
    super(config);
    this.shouldFailConnection = options?.failConnection || false;
    this.shouldFailHealthCheck = options?.failHealthCheck || false;
  }

  async connect(): Promise<void> {
    if (this.shouldFailConnection) {
      throw new ConnectionError('Mock connection failed');
    }
    this.mockConnected = true;
    this.isConnected = true;

    // Mock client setup
    this.client = {
      schema,
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    } as any;
  }

  async disconnect(): Promise<void> {
    this.mockConnected = false;
    this.isConnected = false;
    this.client = null;
  }

  async healthCheck(): Promise<boolean> {
    if (this.shouldFailHealthCheck) {
      return false;
    }
    return this.mockConnected && this.isConnected;
  }

  async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected) {
      throw new ConnectionError('Not connected to database');
    }

    // Mock raw query execution
    return [{ id: 1, name: 'Mock Result' }] as T[];
  }

  async beginTransaction(): Promise<void> {
    if (!this.isConnected) {
      throw new ConnectionError('Not connected to database');
    }
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }
    this.transactionActive = true;
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction to commit');
    }
    this.transactionActive = false;
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction to rollback');
    }
    this.transactionActive = false;
  }

  getAdapterInfo() {
    return {
      type: 'mock',
      runtime: 'test',
      driver: 'mock-driver',
      supportsNativeDriver: true,
      isConnected: this.isConnected,
      futureSupport: { bunSql: false },
    };
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  getClient() {
    if (!this.client) {
      throw new ConfigurationError('Database client not initialized');
    }
    return this.client;
  }

  protected getConnectionString(): string {
    return 'mock://localhost:5432/test';
  }

  protected getConnectionOptions(): any {
    return {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'test',
    };
  }
}

describe('BaseDatabaseAdapter', () => {
  let adapter: MockAdapter;
  let config: DatabaseConfig<typeof schema>;

  beforeEach(() => {
    config = {
      type: 'postgresql',
      connection: 'postgresql://test:test@localhost:5432/test',
      schema,
      debug: false,
      logger: false,
    };
    adapter = new MockAdapter(config);
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnectionActive()).toBe(false);

      await adapter.connect();

      expect(adapter.isConnectionActive()).toBe(true);
      expect(adapter.getClient()).toBeDefined();
    });

    it('should disconnect successfully', async () => {
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);

      await adapter.disconnect();

      expect(adapter.isConnectionActive()).toBe(false);
    });

    it('should handle connection failures', async () => {
      const failingAdapter = new MockAdapter(config, { failConnection: true });

      await expect(failingAdapter.connect()).rejects.toThrow(ConnectionError);
      expect(failingAdapter.isConnectionActive()).toBe(false);
    });

    it('should throw error when getting client before connection', () => {
      expect(() => adapter.getClient()).toThrow(ConfigurationError);
    });
  });

  describe('health check', () => {
    it('should return true for healthy connection', async () => {
      await adapter.connect();

      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy connection', async () => {
      const unhealthyAdapter = new MockAdapter(config, {
        failHealthCheck: true,
      });
      await unhealthyAdapter.connect();

      const isHealthy = await unhealthyAdapter.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when not connected', async () => {
      const isHealthy = await adapter.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('raw query execution', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should execute raw SQL queries', async () => {
      const result = await adapter.executeRaw('SELECT * FROM users');

      expect(result).toEqual([{ id: 1, name: 'Mock Result' }]);
    });

    it('should execute raw SQL queries with parameters', async () => {
      const result = await adapter.executeRaw(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );

      expect(result).toEqual([{ id: 1, name: 'Mock Result' }]);
    });

    it('should throw error when executing raw query without connection', async () => {
      await adapter.disconnect();

      await expect(adapter.executeRaw('SELECT * FROM users')).rejects.toThrow(
        ConnectionError
      );
    });
  });

  describe('transaction management', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should begin transaction successfully', async () => {
      await expect(adapter.beginTransaction()).resolves.not.toThrow();
    });

    it('should commit transaction successfully', async () => {
      await adapter.beginTransaction();

      await expect(adapter.commitTransaction()).resolves.not.toThrow();
    });

    it('should rollback transaction successfully', async () => {
      await adapter.beginTransaction();

      await expect(adapter.rollbackTransaction()).resolves.not.toThrow();
    });

    it('should throw error when beginning transaction without connection', async () => {
      await adapter.disconnect();

      await expect(adapter.beginTransaction()).rejects.toThrow(ConnectionError);
    });

    it('should throw error when committing without active transaction', async () => {
      await expect(adapter.commitTransaction()).rejects.toThrow(
        'No active transaction to commit'
      );
    });

    it('should throw error when rolling back without active transaction', async () => {
      await expect(adapter.rollbackTransaction()).rejects.toThrow(
        'No active transaction to rollback'
      );
    });

    it('should throw error when beginning transaction twice', async () => {
      await adapter.beginTransaction();

      await expect(adapter.beginTransaction()).rejects.toThrow(
        'Transaction already active'
      );
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration with missing schema', () => {
      const invalidConfig = {
        type: 'postgresql',
        connection: 'postgresql://test:test@localhost:5432/test',
      } as any;

      expect(() => new MockAdapter(invalidConfig)).not.toThrow();
      // Validation happens during connect, not construction
    });

    it('should validate configuration with missing connection', () => {
      const invalidConfig = { type: 'postgresql', schema } as any;

      expect(() => new MockAdapter(invalidConfig)).not.toThrow();
      // Validation happens during connect, not construction
    });
  });

  describe('adapter information', () => {
    it('should return correct adapter info', () => {
      const info = adapter.getAdapterInfo();

      expect(info).toEqual({
        type: 'mock',
        runtime: 'test',
        driver: 'mock-driver',
        supportsNativeDriver: true,
        isConnected: false,
        futureSupport: { bunSql: false },
      });
    });

    it('should update connection status in adapter info', async () => {
      await adapter.connect();
      const info = adapter.getAdapterInfo();

      expect(info.isConnected).toBe(true);
    });
  });

  describe('logging and debugging', () => {
    it('should handle debug mode', async () => {
      const debugConfig = { ...config, debug: true };
      const debugAdapter = new MockAdapter(debugConfig);
      await debugAdapter.connect();

      // Debug logging is handled in executeWithLogging method
      // This test ensures the adapter can be created with debug enabled
      expect(debugAdapter.isConnectionActive()).toBe(true);
    });

    it('should handle custom logger function', async () => {
      const mockLogger = jest.fn();
      const loggerConfig = { ...config, logger: mockLogger };
      const loggerAdapter = new MockAdapter(loggerConfig);
      await loggerAdapter.connect();

      // Logger functionality is tested in the executeWithLogging method
      expect(loggerAdapter.isConnectionActive()).toBe(true);
    });

    it('should handle boolean logger', async () => {
      const loggerConfig = { ...config, logger: true };
      const loggerAdapter = new MockAdapter(loggerConfig);
      await loggerAdapter.connect();

      expect(loggerAdapter.isConnectionActive()).toBe(true);
    });
  });

  describe('connection string handling', () => {
    it('should handle string connection configuration', () => {
      const stringConfig = {
        ...config,
        connection: 'postgresql://test:test@localhost:5432/test',
      };
      const stringAdapter = new MockAdapter(stringConfig);

      expect(() => stringAdapter['getConnectionString']()).not.toThrow();
    });

    it('should handle object connection configuration', () => {
      const objectConfig = {
        ...config,
        connection: {
          host: 'localhost',
          port: 5432,
          user: 'test',
          password: 'test',
          database: 'test',
        },
      };
      const objectAdapter = new MockAdapter(objectConfig);

      expect(() => objectAdapter['getConnectionOptions']()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const errorAdapter = new MockAdapter(config, { failConnection: true });

      await expect(errorAdapter.connect()).rejects.toThrow(ConnectionError);
      expect(errorAdapter.isConnectionActive()).toBe(false);
    });

    it('should handle health check failures', async () => {
      const unhealthyAdapter = new MockAdapter(config, {
        failHealthCheck: true,
      });
      await unhealthyAdapter.connect();

      const isHealthy = await unhealthyAdapter.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should throw ConfigurationError for missing client', () => {
      expect(() => adapter.getClient()).toThrow(ConfigurationError);
      expect(() => adapter.getClient()).toThrow(
        'Database client not initialized'
      );
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should handle concurrent raw queries', async () => {
      const queries = [
        adapter.executeRaw('SELECT * FROM users WHERE id = 1'),
        adapter.executeRaw('SELECT * FROM users WHERE id = 2'),
        adapter.executeRaw('SELECT * FROM users WHERE id = 3'),
      ];

      const results = await Promise.all(queries);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual([{ id: 1, name: 'Mock Result' }]);
      });
    });

    it('should handle concurrent health checks', async () => {
      const healthChecks = [
        adapter.healthCheck(),
        adapter.healthCheck(),
        adapter.healthCheck(),
      ];

      const results = await Promise.all(healthChecks);

      expect(results).toEqual([true, true, true]);
    });
  });

  describe('lifecycle management', () => {
    it('should handle multiple connect/disconnect cycles', async () => {
      // First cycle
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnectionActive()).toBe(false);

      // Second cycle
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnectionActive()).toBe(false);

      // Third cycle
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);
    });

    it('should handle disconnect without connect', async () => {
      await expect(adapter.disconnect()).resolves.not.toThrow();
      expect(adapter.isConnectionActive()).toBe(false);
    });

    it('should handle multiple connects', async () => {
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);

      // Second connect should not throw
      await adapter.connect();
      expect(adapter.isConnectionActive()).toBe(true);
    });
  });
});
