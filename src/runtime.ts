import type { RuntimeEnvironment } from './types';

/**
 * Detect the current runtime environment
 * Priority: D1 > Bun > Node.js >= 24 > better-sqlite3
 */
export function detectRuntime(): RuntimeEnvironment {
  // Check for Cloudflare Workers / D1
  if (typeof globalThis.caches !== 'undefined' && 'default' in globalThis.caches) {
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
        // Check if node:sqlite is available
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('node:sqlite');
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
  return db && typeof db === 'object' && '$client' in db && 'query' in db;
}

/**
 * Check if the database instance is a D1 database
 */
export function isD1Database(db: any): boolean {
  return (
    db &&
    typeof db === 'object' &&
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
  return db && typeof db === 'object' && 'prepare' in db && 'query' in db && typeof Bun !== 'undefined';
}

/**
 * Check if the database instance is a Node.js native SQLite database
 */
export function isNodeDatabase(db: any): boolean {
  return (
    db &&
    typeof db === 'object' &&
    'prepare' in db &&
    typeof process !== 'undefined' &&
    process.versions?.node
  );
}

/**
 * Check if the database instance is a better-sqlite3 database
 */
export function isBetterSqlite3Database(db: any): boolean {
  return (
    db &&
    typeof db === 'object' &&
    'prepare' in db &&
    'transaction' in db &&
    'pragma' in db
  );
}
