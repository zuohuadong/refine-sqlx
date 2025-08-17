import { describe, it } from 'vitest';
import { createIntegrationTestSuite } from '../integration';
import type { SqlClient } from '../../src/client';

// Check if we're running in Bun environment
const isBunRuntime = typeof Bun !== 'undefined';

let Database: any;
let createBunSQLiteAdapter: any;

if (isBunRuntime) {
  try {
    // Dynamic imports for Bun-specific modules
    const bunSqlite = await import('bun:sqlite');
    Database = bunSqlite.Database;
    const adapters = await import('../../src/adapters');
    createBunSQLiteAdapter = adapters.createBunSQLiteAdapter;
  } catch (error) {
    console.warn('Failed to import Bun SQLite modules:', error);
  }
}

const testSuite = isBunRuntime && Database && createBunSQLiteAdapter
  ? createIntegrationTestSuite(
      'Bun SQLite',
      async (): Promise<SqlClient> => {
        // Create in-memory database
        const db = new Database(':memory:');
        return createBunSQLiteAdapter(db);
      },
      (client: any) => {
        // Close the underlying database connection
        if (client && typeof client === 'object') {
          // Access the underlying db through the adapter's closure
          // Note: This is implementation-specific cleanup
          try {
            // The adapter doesn't expose the db directly, so we rely on GC
            // In a real scenario, we might want to expose a cleanup method
          } catch {
            // Ignore cleanup errors in tests
          }
        }
      }
    )
  : () => {
      it.skip('Bun SQLite integration tests skipped (not running in Bun environment)', () => {
        // This test will be skipped when not in Bun environment
      });
    };

describe('Bun SQLite Integration Tests', testSuite);
