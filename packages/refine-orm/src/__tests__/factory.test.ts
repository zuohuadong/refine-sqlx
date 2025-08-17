/**
 * Tests for user-friendly factory functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { pgTable, serial, text as pgText } from 'drizzle-orm/pg-core';
import {
  mysqlTable,
  serial as mysqlSerial,
  text as mysqlText,
} from 'drizzle-orm/mysql-core';
import {
  createProvider,
  createPostgreSQLProvider,
  createMySQLProvider,
  createSQLiteProvider,
  createDataProvider,
  getRuntimeDiagnostics,
  checkDatabaseSupport,
} from '../factory.js';
import {
  MockDatabaseAdapter,
  TestDataGenerators,
} from './utils/mock-client.js';
import { ConfigurationError, ConnectionError } from '../types/errors.js';

// Mock schemas for testing different databases
const sqliteUsers = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name', { length: 255 }).notNull(),
  email: text('email', { length: 255 }).notNull().unique(),
});

const pgUsers = pgTable('users', {
  id: serial('id').primaryKey(),
  name: pgText('name', { length: 255 }).notNull(),
  email: pgText('email', { length: 255 }).notNull().unique(),
});

const mysqlUsers = mysqlTable('users', {
  id: mysqlSerial('id').primaryKey(),
  name: mysqlText('name', { length: 255 }).notNull(),
  email: mysqlText('email', { length: 255 }).notNull().unique(),
});

const sqliteSchema = { users: sqliteUsers };
const pgSchema = { users: pgUsers };
const mysqlSchema = { users: mysqlUsers };

// Mock runtime detection
vi.mock('../utils/runtime-detection.js', () => ({
  detectBunRuntime: vi.fn(() => false),
  detectNodeRuntime: vi.fn(() => true),
  detectCloudflareD1: vi.fn(() => false),
  getRuntimeInfo: vi.fn(() => ({
    runtime: 'node',
    version: '18.0.0',
    platform: 'linux',
  })),
  getRecommendedDriver: vi.fn((dbType: string) => {
    const drivers: Record<string, string> = {
      postgresql: 'postgres',
      mysql: 'mysql2',
      sqlite: 'better-sqlite3',
    };
    return drivers[dbType] || 'unknown';
  }),
  detectBunSqlSupport: vi.fn(() => false),
}));

describe('Factory Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Universal createProvider', () => {
    it('should create PostgreSQL provider with connection string', async () => {
      const config = {
        database: 'postgresql' as const,
        connection: 'postgresql://user:pass@localhost:5432/testdb',
        schema: pgSchema,
      };

      const provider = await createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.client).toBeDefined();
      expect(provider.schema).toBe(pgSchema);
    });

    it('should create MySQL provider with connection object', async () => {
      const config = {
        database: 'mysql' as const,
        connection: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'password',
          database: 'testdb',
        },
        schema: mysqlSchema,
      };

      const provider = await createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.client).toBeDefined();
      expect(provider.schema).toBe(mysqlSchema);
    });

    it('should create SQLite provider with file path', async () => {
      const config = {
        database: 'sqlite' as const,
        connection: './test.db',
        schema: sqliteSchema,
      };

      const provider = await createProvider(config);

      expect(provider).toBeDefined();
      expect(provider.client).toBeDefined();
      expect(provider.schema).toBe(sqliteSchema);
    });

    it('should throw error for unsupported database type', async () => {
      const config = {
        database: 'unsupported' as any,
        connection: 'test://connection',
        schema: sqliteSchema,
      };

      await expect(createProvider(config)).rejects.toThrow(ConfigurationError);
    });
  });

  describe('getRuntimeDiagnostics', () => {
    it('should return runtime diagnostics', () => {
      const diagnostics = getRuntimeDiagnostics();

      expect(diagnostics).toHaveProperty('runtime');
      expect(diagnostics).toHaveProperty('recommendedDrivers');
      expect(diagnostics).toHaveProperty('features');
      expect(diagnostics).toHaveProperty('environment');
    });
  });

  describe('checkDatabaseSupport', () => {
    it('should check database support', () => {
      const pgSupport = checkDatabaseSupport('postgresql');
      const mysqlSupport = checkDatabaseSupport('mysql');
      const sqliteSupport = checkDatabaseSupport('sqlite');

      expect(pgSupport).toHaveProperty('supported');
      expect(mysqlSupport).toHaveProperty('supported');
      expect(sqliteSupport).toHaveProperty('supported');
    });
  });
});
