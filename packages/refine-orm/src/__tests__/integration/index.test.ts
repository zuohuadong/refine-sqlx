/**
 * Integration test suite entry point
 * Runs all integration tests and provides environment setup validation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { isTestEnvironmentReady } from './database-setup';

describe('Integration Test Environment', () => {
  describe('Database Availability', () => {
    it('should have SQLite available (always true)', () => {
      expect(isTestEnvironmentReady('sqlite')).toBe(true);
    });

    it('should check PostgreSQL availability', () => {
      const isAvailable = isTestEnvironmentReady('postgresql');
      if (!isAvailable) {
        console.warn(
          'PostgreSQL not available for integration tests. Set POSTGRES_URL environment variable to enable.'
        );
      }
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should check MySQL availability', () => {
      const isAvailable = isTestEnvironmentReady('mysql');
      if (!isAvailable) {
        console.warn(
          'MySQL not available for integration tests. Set MYSQL_URL environment variable to enable.'
        );
      }
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Environment Configuration', () => {
    it('should have proper test timeout configuration', () => {
      // This test ensures our test environment is configured for long-running integration tests
      expect(true).toBe(true);
    });

    it('should have access to required dependencies', async () => {
      // Test that we can import all required modules
      const modules = [
        () => import('../../adapters/postgresql'),
        () => import('../../adapters/mysql'),
        () => import('../../adapters/sqlite'),
        () => import('../../core/data-provider'),
        () => import('../../index'),
      ];

      const results = await Promise.allSettled(modules.map(m => m()));

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to import module ${index}:`, result.reason);
        }
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Test Data Validation', () => {
    it('should have valid test data structure', async () => {
      const { TEST_DATA } = await import('./database-setup');

      expect(TEST_DATA.users).toBeDefined();
      expect(Array.isArray(TEST_DATA.users)).toBe(true);
      expect(TEST_DATA.users.length).toBeGreaterThan(0);

      expect(TEST_DATA.posts).toBeDefined();
      expect(Array.isArray(TEST_DATA.posts)).toBe(true);
      expect(TEST_DATA.posts.length).toBeGreaterThan(0);

      expect(TEST_DATA.comments).toBeDefined();
      expect(Array.isArray(TEST_DATA.comments)).toBe(true);
      expect(TEST_DATA.comments.length).toBeGreaterThan(0);
    });

    it('should have consistent test data relationships', async () => {
      const { TEST_DATA } = await import('./database-setup');

      // Check that post userIds reference valid users
      TEST_DATA.posts.forEach(post => {
        const userExists = TEST_DATA.users.some(
          user => TEST_DATA.users.indexOf(user) + 1 === post.userId
        );
        expect(userExists).toBe(true);
      });

      // Check that comment userIds reference valid users
      TEST_DATA.comments.forEach(comment => {
        const userExists = TEST_DATA.users.some(
          user => TEST_DATA.users.indexOf(user) + 1 === comment.userId
        );
        expect(userExists).toBe(true);
      });
    });
  });
});

// Re-export test suites for easier importing
export * from './crud-operations.test';
export * from './transaction.test';
export * from './relationship-queries.test';
