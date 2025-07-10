import { describe, beforeEach, afterEach } from 'vitest';
import { Database } from 'bun:sqlite';
import { createBunSQLiteAdapter } from '../../src/adapters';
import { createIntegrationTestSuite } from '../integration';
import type { SqlClient } from '../../src/client';

describe('Bun SQLite Integration Tests', createIntegrationTestSuite(
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
));