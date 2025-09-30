/**
 * Tests for user-friendly factory functions
 */

import { describe, it, expect, beforeEach, vi } from './test-utils.js';
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
} from '../factory';
import { MockDatabaseAdapter, TestDataGenerators } from './utils/mock-client';
import { ConfigurationError, ConnectionError } from '../types/errors';

// Mock schemas for testing different databases
const sqliteUsers = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});

const pgUsers = pgTable('users', {
  id: serial('id').primaryKey(),
  name: pgText('name').notNull(),
  email: pgText('email').notNull().unique(),
});

const mysqlUsers = mysqlTable('users', {
  id: mysqlSerial('id').primaryKey(),
  name: mysqlText('name').notNull(),
  email: mysqlText('email').notNull().unique(),
});

const sqliteSchema = { users: sqliteUsers };
const pgSchema = { users: pgUsers };
const mysqlSchema = { users: mysqlUsers };

// Mock runtime detection
jest.mock('../utils/runtime-detection.ts', () => ({
  detectBunRuntime: jest.fn(() => false),
  detectNodeRuntime: jest.fn(() => true),
  detectCloudflareD1: jest.fn(() => false),
  getRuntimeInfo: jest.fn(() => ({
    runtime: 'node',
    version: '18.0.0',
    platform: 'linux',
  })),
  getRuntimeConfig: jest.fn(() => ({
    runtime: 'node',
    version: '18.0.0',
    platform: 'linux',
    supports: { fs: true, crypto: true, streams: true },
  })),
  getRecommendedDriver: jest.fn((dbType: string) => {
    const drivers: Record<string, string> = {
      postgresql: 'postgres',
      mysql: 'mysql2',
      sqlite: 'better-sqlite3',
    };
    return drivers[dbType] || 'unknown';
  }),
  checkDriverAvailability: jest.fn(() => ({ available: true, reason: null })),
  detectBunSqlSupport: jest.fn(() => false),
}));

describe('Factory Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(typeof pgSupport).toBe('boolean');
      expect(typeof mysqlSupport).toBe('boolean');
      expect(typeof sqliteSupport).toBe('boolean');
    });
  });
});
