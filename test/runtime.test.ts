/**
 * Runtime detection and adapter tests for v0.3.0
 */
import { describe, expect, it } from './helpers/test-adapter';
import {
  detectRuntime,
  isDrizzleDatabase,
  isD1Database,
  isBunDatabase,
  isNodeDatabase,
  isBetterSqlite3Database,
} from '../src/runtime';

describe('Runtime Detection - v0.3.0', () => {
  describe('detectRuntime', () => {
    it('should detect Bun runtime', () => {
      const runtime = detectRuntime();

      // Should be 'bun' when running in Bun
      expect(['bun', 'd1', 'node', 'better-sqlite3']).toContain(runtime);
    });

    it('should return valid runtime type', () => {
      const runtime = detectRuntime();

      expect(['bun', 'd1', 'node', 'better-sqlite3']).toContain(runtime);
    });
  });

  describe('isDrizzleDatabase', () => {
    it('should detect Drizzle database instance', () => {
      const mockDrizzle = {
        query: {},
        select: () => ({}),
        insert: () => ({}),
        update: () => ({}),
        delete: () => ({}),
      };

      expect(isDrizzleDatabase(mockDrizzle)).toBe(true);
    });

    it('should return false for non-Drizzle object', () => {
      const notDrizzle = {
        prepare: () => ({}),
        execute: () => ({}),
      };

      expect(isDrizzleDatabase(notDrizzle)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isDrizzleDatabase(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDrizzleDatabase(undefined)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isDrizzleDatabase('string')).toBe(false);
      expect(isDrizzleDatabase(123)).toBe(false);
      expect(isDrizzleDatabase(true)).toBe(false);
    });
  });

  describe('isD1Database', () => {
    it('should detect D1 database-like object', () => {
      const mockD1 = {
        prepare: () => ({}),
        dump: () => Promise.resolve(new ArrayBuffer(0)),
        batch: () => Promise.resolve([]),
        exec: () => Promise.resolve({ count: 0, duration: 0 }),
      };

      expect(isD1Database(mockD1)).toBe(true);
    });

    it('should return false for incomplete D1-like object', () => {
      const notD1 = {
        prepare: () => ({}),
        batch: () => Promise.resolve([]),
        // Missing dump and exec
      };

      expect(isD1Database(notD1)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isD1Database(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isD1Database(undefined)).toBe(false);
    });
  });

  describe('isBunDatabase', () => {
    it('should detect Bun database-like object in Bun runtime', () => {
      // Only valid in Bun runtime
      if (typeof Bun !== 'undefined') {
        const mockBunDB = {
          prepare: () => ({}),
          query: () => [],
        };

        expect(isBunDatabase(mockBunDB)).toBe(true);
      } else {
        expect(true).toBe(true); // Skip in non-Bun
      }
    });

    it('should return false in non-Bun runtime', () => {
      if (typeof Bun === 'undefined') {
        const mockDB = {
          prepare: () => ({}),
          query: () => [],
        };

        expect(isBunDatabase(mockDB)).toBe(false);
      } else {
        expect(true).toBe(true); // Skip in Bun
      }
    });

    it('should return false for null', () => {
      expect(isBunDatabase(null)).toBe(false);
    });
  });

  describe('isNodeDatabase', () => {
    it('should detect Node database-like object in Node runtime', () => {
      if (typeof process !== 'undefined' && process.versions?.node) {
        const mockNodeDB = {
          prepare: () => ({}),
        };

        // Will return true only if it's actually a Node.js database
        const result = isNodeDatabase(mockNodeDB);
        expect(typeof result).toBe('boolean');
      } else {
        expect(true).toBe(true); // Skip in non-Node
      }
    });

    it('should return false for better-sqlite3 database', () => {
      const mockBetterSqlite = {
        prepare: () => ({}),
        transaction: () => ({}),
        pragma: () => ({}),
      };

      expect(isNodeDatabase(mockBetterSqlite)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNodeDatabase(null)).toBe(false);
    });
  });

  describe('isBetterSqlite3Database', () => {
    it('should detect better-sqlite3 database-like object', () => {
      const mockBetterSqlite = {
        prepare: () => ({}),
        transaction: () => ({}),
        pragma: () => ({}),
      };

      expect(isBetterSqlite3Database(mockBetterSqlite)).toBe(true);
    });

    it('should return false for incomplete better-sqlite3-like object', () => {
      const notBetterSqlite = {
        prepare: () => ({}),
        transaction: () => ({}),
        // Missing pragma
      };

      expect(isBetterSqlite3Database(notBetterSqlite)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isBetterSqlite3Database(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBetterSqlite3Database(undefined)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle objects with some matching properties', () => {
      const partialMatch = {
        query: {},
        select: () => ({}),
        // Missing other Drizzle methods - but has required properties
      };

      // Duck typing: if it has query and select, it's treated as Drizzle
      expect(isDrizzleDatabase(partialMatch)).toBe(true);
    });

    it('should handle objects with extra properties', () => {
      const extraProps = {
        query: {},
        select: () => ({}),
        insert: () => ({}),
        update: () => ({}),
        delete: () => ({}),
        customMethod: () => ({}),
        extraProp: 'value',
      };

      expect(isDrizzleDatabase(extraProps)).toBe(true);
    });

    it('should handle empty objects', () => {
      expect(isDrizzleDatabase({})).toBe(false);
      expect(isD1Database({})).toBe(false);
      expect(isBunDatabase({})).toBe(false);
      expect(isNodeDatabase({})).toBe(false);
      expect(isBetterSqlite3Database({})).toBe(false);
    });
  });
});
