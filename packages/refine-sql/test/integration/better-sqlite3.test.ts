import { describe, it } from 'vitest';
import { createBetterSQLite3Adapter } from '../../src/adapters';
import { createIntegrationTestSuite } from '../integration';
import type { SqlClient } from '../../src/client';

// Check if better-sqlite3 is available
let Database: any;
let isBetterSQLite3Available = false;

try {
  Database = await import('better-sqlite3');
  Database = Database.default || Database;
  isBetterSQLite3Available = true;
} catch (error) {
  // better-sqlite3 not available
  isBetterSQLite3Available = false;
}

const testSuite =
  isBetterSQLite3Available ?
    createIntegrationTestSuite(
      'better-sqlite3',
      async (): Promise<SqlClient> => {
        // Create in-memory database
        const db = new Database(':memory:');
        return createBetterSQLite3Adapter(db);
      },
      (client: any) => {
        // Close the underlying database connection
        if (client && typeof client === 'object') {
          try {
            // The adapter doesn't expose the db directly, but better-sqlite3
            // databases should be closed properly. For now, we rely on GC.
            // In a real scenario, we might want to expose a cleanup method
          } catch {
            // Ignore cleanup errors in tests
          }
        }
      }
    )
  : () => {
      it.skip('better-sqlite3 integration tests skipped (better-sqlite3 not installed)', () => {
        // This test will be skipped when better-sqlite3 is not available
      });
    };

describe('better-sqlite3 Integration Tests', testSuite);
