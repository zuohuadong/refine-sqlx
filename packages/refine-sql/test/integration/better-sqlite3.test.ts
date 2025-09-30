import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest, test } from '../test-utils.js';
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
    (() => {
      let currentDb: any = null;

      return createIntegrationTestSuite(
        'better-sqlite3',
        async (): Promise<SqlClient> => {
          // Create in-memory database
          currentDb = new Database(':memory:');
          return createBetterSQLite3Adapter(currentDb);
        },
        async () => {
          // Close the underlying database connection
          if (currentDb && typeof currentDb.close === 'function') {
            try {
              currentDb.close();
            } catch {
              // Ignore cleanup errors in tests
            }
          }
          currentDb = null;
        }
      );
    })()
  : () => {
      it.skip('better-sqlite3 integration tests skipped (better-sqlite3 not installed)', () => {
        // This test will be skipped when better-sqlite3 is not available
      });
    };

describe('better-sqlite3 Integration Tests', testSuite);
