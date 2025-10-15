import type { RuntimeEnvironment } from './types';

/**
 * Detect the current runtime environment
 * Priority: D1 > Bun > Node.js >= 24 > better-sqlite3
 */
export function detectRuntime(): RuntimeEnvironment {
  // Check for Cloudflare Workers / D1
  if (
    typeof (globalThis as any).caches !== 'undefined' &&
    'default' in (globalThis as any).caches
  ) {
    return 'd1';
  }

  // Check for Bun runtime
  if (typeof Bun !== 'undefined') {
    return 'bun';
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);

    // Node.js 24+ has native SQLite support
    if (nodeVersion >= 24) {
      try {
        // Try to import node:sqlite to check if it's available
        // In ESM, we can't use require, so we assume it's available for Node.js 24+
        return 'node';
      } catch {
        // Fall back to better-sqlite3
        return 'better-sqlite3';
      }
    }

    // Node.js < 24 uses better-sqlite3
    return 'better-sqlite3';
  }

  // Default to better-sqlite3
  return 'better-sqlite3';
}

/**
 * Check if the database instance is a Drizzle database
 */
export function isDrizzleDatabase(db: any): boolean {
  if (!db || typeof db !== 'object') {
    return false;
  }
  return 'query' in db && 'select' in db;
}

/**
 * Check if the database instance is a D1 database
 */
export function isD1Database(db: any): boolean {
  if (!db || typeof db !== 'object') {
    return false;
  }
  return (
    'prepare' in db &&
    'dump' in db &&
    'batch' in db &&
    'exec' in db
  );
}

/**
 * Check if the database instance is a Bun SQLite database
 */
export function isBunDatabase(db: any): boolean {
  if (!db || typeof db !== 'object') {
    return false;
  }
  return (
    'prepare' in db &&
    'query' in db &&
    typeof Bun !== 'undefined'
  );
}

/**
 * Check if the database instance is a Node.js native SQLite database
 */
export function isNodeDatabase(db: any): boolean {
  if (!db || typeof db !== 'object') {
    return false;
  }
  return (
    'prepare' in db &&
    typeof process !== 'undefined' &&
    !!process.versions?.node &&
    !isBetterSqlite3Database(db) &&
    !isBunDatabase(db)
  );
}

/**
 * Check if the database instance is a better-sqlite3 database
 */
export function isBetterSqlite3Database(db: any): boolean {
  if (!db || typeof db !== 'object') {
    return false;
  }
  return (
    'prepare' in db &&
    'transaction' in db &&
    'pragma' in db
  );
}
