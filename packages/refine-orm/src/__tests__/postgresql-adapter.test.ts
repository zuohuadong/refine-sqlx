import { describe, it, expect } from 'vitest';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import {
  createPostgreSQLProviderWithPostgresJs,
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
  it('should create adapter instance', async () => {
    const connectionString = 'postgresql://test:test@localhost:5432/test';
    const adapter = await createPostgreSQLProviderWithPostgresJs(connectionString, schema);

    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });

  it('should get adapter info without connection', async () => {
    const connectionString = 'postgresql://test:test@localhost:5432/test';
    
    // Create adapter but don't connect
    const adapter = new PostgreSQLAdapter({
      type: 'postgresql',
      connection: connectionString,
      schema
    });

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
      new PostgreSQLAdapter({
        type: 'postgresql',
        connection: '',
        schema
      });
    }).toThrow();
  });

  it('should handle connection string format', async () => {
    const connectionString = 'postgresql://user:pass@localhost:5432/db';
    const adapter = await createPostgreSQLProviderWithPostgresJs(connectionString, schema);

    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });

  it('should handle connection options format', async () => {
    const connectionOptions = {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'testdb',
    };

    const adapter = await createPostgreSQLProviderWithPostgresJs(connectionOptions, schema);
    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });
});
