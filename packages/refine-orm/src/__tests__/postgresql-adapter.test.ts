import { describe, it, expect } from 'vitest';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import {
  createPostgreSQLProvider,
  PostgreSQLAdapter,
} from '../adapters/postgresql.js';
import {
  getRuntimeConfig,
  detectBunRuntime,
} from '../utils/runtime-detection.js';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

describe('PostgreSQL Adapter', () => {
  it('should create adapter instance', () => {
    const connectionString = 'postgresql://test:test@localhost:5432/test';
    const adapter = createPostgreSQLProvider(connectionString, schema);

    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });

  it('should get adapter info without connection', () => {
    const connectionString = 'postgresql://test:test@localhost:5432/test';
    const adapter = createPostgreSQLProvider(connectionString, schema);

    const info = adapter.getAdapterInfo();
    expect(info.type).toBe('postgresql');
    expect(info.isConnected).toBe(false);
    expect(['bun:sql', 'postgres']).toContain(info.driver);
  });

  it('should detect runtime configuration', () => {
    const runtimeConfig = getRuntimeConfig('postgresql');

    expect(runtimeConfig.database).toBe('postgresql');
    expect(['bun', 'node']).toContain(runtimeConfig.runtime);
    expect(['bun:sql', 'postgres']).toContain(runtimeConfig.driver);
  });

  it('should validate configuration', () => {
    expect(() => {
      createPostgreSQLProvider('', schema);
    }).toThrow();
  });

  it('should handle connection string format', () => {
    const connectionString = 'postgresql://user:pass@localhost:5432/db';
    const adapter = createPostgreSQLProvider(connectionString, schema);

    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });

  it('should handle connection options format', () => {
    const connectionOptions = {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'testdb',
    };

    const adapter = createPostgreSQLProvider(connectionOptions, schema);
    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });
});
