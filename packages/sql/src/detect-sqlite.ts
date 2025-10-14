import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type {
  DatabaseSync as NodeDatabase,
  DatabaseSyncOptions as NodeDatabaseOptions,
} from 'node:sqlite';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import type { SqlClient, SqlClientFactory } from './client';
import type { SQLiteOptions } from './types/config';
import { withErrorHandling } from './utils';
// Adapters will be dynamically imported to reduce bundle size

// Re-export SQLiteOptions from types for consistency
export type { SQLiteOptions } from './types/config';

export default function (
  db: ':memory:',
  options?: SQLiteOptions
): SqlClientFactory;
export default function (db: string, options?: SQLiteOptions): SqlClientFactory;
export default function (db: D1Database): SqlClientFactory;
export default function (db: BunDatabase): SqlClientFactory;
export default function (db: NodeDatabase): SqlClientFactory;
export default function (db: BetterSqlite3Database): SqlClientFactory;
export default function (
  db: string | D1Database | BunDatabase | NodeDatabase | BetterSqlite3Database,
  options?: SQLiteOptions | undefined
): SqlClientFactory {
  let client: SqlClient;

  const connect = withErrorHandling(async (): Promise<SqlClient> => {
    if (client != null) return client;

    const supportedRuntime = detectSupportRuntime();
    if (supportedRuntime === 'cloudflare-worker') {
      if (typeof db === 'object' && 'prepare' in db) {
        const createCloudflareD1Adapter = (
          await import('./adapters/cloudflare-d1')
        ).default;
        const connectedClient = createCloudflareD1Adapter(db as D1Database);
        // eslint-disable-next-line require-atomic-updates
        client = connectedClient;
        return client;
      }

      throw new Error('Cloudflare D1 must provide a D1Database instance');
    } else if (supportedRuntime === 'bun') {
      if (typeof db === 'object' && 'prepare' in db) {
        const createBunSQLiteAdapter = (await import('./adapters/bun-sqlite'))
          .default;
        const connectedClient = createBunSQLiteAdapter(db as BunDatabase);
        // eslint-disable-next-line require-atomic-updates
        client = connectedClient;
        return client;
      }

      const { Database } = await import('bun:sqlite');
      const instance = new Database(db, options?.bun);
      const createBunSQLiteAdapter = (await import('./adapters/bun-sqlite'))
        .default;
      const connectedClient = createBunSQLiteAdapter(instance);
      // eslint-disable-next-line require-atomic-updates
      client = connectedClient;
      return client;
    } else if (supportedRuntime === 'node') {
      try {
        if (typeof db === 'object' && 'prepare' in db) {
          const createNodeSQLiteAdapter = (
            await import('./adapters/node-sqlite')
          ).default;
          const connectedClient = createNodeSQLiteAdapter(db as NodeDatabase);
          // eslint-disable-next-line require-atomic-updates
          client = connectedClient;
          return client;
        }

        const { DatabaseSync } = await import('node:sqlite');
        const instance = new DatabaseSync(
          db,
          options?.node as NodeDatabaseOptions
        );
        const createNodeSQLiteAdapter = (await import('./adapters/node-sqlite'))
          .default;
        const connectedClient = createNodeSQLiteAdapter(instance);
        // eslint-disable-next-line require-atomic-updates
        client = connectedClient;
        return client;
      } catch {
        // Fallback to generic SQLite client
      }
    }

    try {
      if (typeof db === 'object' && 'prepare' in db) {
        const createBetterSQLite3Adapter = (
          await import('./adapters/better-sqlite3')
        ).default;
        const connectedClient = createBetterSQLite3Adapter(
          db as BetterSqlite3Database
        );
        // eslint-disable-next-line require-atomic-updates
        client = connectedClient;
        return client;
      }

      const Database = await import('better-sqlite3');
      const instance = new (Database as any).default(
        db,
        options?.['better-sqlite3']
      );
      const createBetterSQLite3Adapter = (
        await import('./adapters/better-sqlite3')
      ).default;
      const connectedClient = createBetterSQLite3Adapter(instance);
      // eslint-disable-next-line require-atomic-updates
      client = connectedClient;
      return client;
    } catch {
      throw new Error(
        'Current runtime not supported SQLite, Please use [bun](https://bun.sh)/[Node.JS](https://nodejs.org/) >= 24 or install [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)'
      );
    }
  }, 'Failed to connect to SQLite database');

  return { connect };
}

export function detectSupportRuntime() {
  if (
    typeof navigator != 'undefined' &&
    navigator?.userAgent.toLowerCase().includes('cloudflare')
  ) {
    return 'cloudflare-worker';
  } else if (
    'Bun' in globalThis &&
    typeof globalThis?.Bun?.sql === 'function'
  ) {
    return 'bun';
  } else if (
    'process' in globalThis &&
    process?.versions?.node &&
    process?.version?.toLowerCase()?.startsWith('v24')
  ) {
    return 'node';
  }

  return 'unknown';
}
