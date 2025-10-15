import { describe, it } from '@jest/globals';
import { createNodeSQLiteAdapter } from '../../src/adapters';
import type { SqlClient } from '../../src/client';
import { createIntegrationTestSuite } from '../integration';

// Skip tests if Node.js version is not v24+ or if running in Bun
const nodeVersion = typeof process !== 'undefined' ? process.version : '';
const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
const isNodeV24Plus = majorVersion >= 24;
const isBunRuntime = typeof Bun !== 'undefined';

const testSuite =
  isNodeV24Plus && !isBunRuntime ?
    createIntegrationTestSuite(
      'Node.js SQLite',
      async (): Promise<SqlClient> => {
        try {
          // Dynamic import to avoid errors in older Node.js versions
          const { DatabaseSync } = await import('node:sqlite');
          const db = new DatabaseSync(':memory:');
          return createNodeSQLiteAdapter(db);
        } catch (error) {
          throw new Error(
            `Node.js SQLite not available: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
      async (client: any) => {
        // Close the underlying database connection
        if (client && typeof client === 'object') {
          try {
            // The adapter doesn't expose the db directly for cleanup
            // node:sqlite databases are automatically cleaned up
          } catch {
            // Ignore cleanup errors in tests
          }
        }
      },
    )
  : () => {
      it.skip(`Node.js SQLite integration tests skipped (requires Node.js v24+, current: ${nodeVersion || 'unknown'}, runtime: ${isBunRuntime ? 'Bun' : 'Node.js'})`, () => {
        // This test will be skipped in older Node.js versions or when running in Bun
      });
    };

describe('Node.js SQLite Integration Tests', testSuite);
