import type { D1Database } from '@cloudflare/workers-types';
import type BetterSqlite3 from 'better-sqlite3';
import type { Database as BunDatabase } from 'bun:sqlite';
import type {
  DatabaseSync as NodeDatabase,
  DatabaseSyncOptions as NodeDatabaseOptions,
} from 'node:sqlite';
import {
  createBetterSQLite3Adapter,
  createBunSQLiteAdapter,
  createCloudflareD1Adapter,
  createNodeSQLiteAdapter,
} from './adapters';
import type { SqlClient, SqlClientFactory } from './client';

export type SQLiteOptions = {
  bun?: ConstructorParameters<typeof BunDatabase>['1'];
  node?: NodeDatabaseOptions;
  'better-sqlite3'?: BetterSqlite3.Options;
};

export default function (
  db: ':memory:',
  options?: SQLiteOptions,
): SqlClientFactory;
export default function (db: string, options?: SQLiteOptions): SqlClientFactory;
export default function (db: D1Database): SqlClientFactory;
export default function (db: BunDatabase): SqlClientFactory;
export default function (db: NodeDatabase): SqlClientFactory;
export default function (db: BetterSqlite3.Database): SqlClientFactory;
export default function (
  db: string | D1Database | BunDatabase | NodeDatabase | BetterSqlite3.Database,
  options?: SQLiteOptions | undefined,
): SqlClientFactory {
  let client: SqlClient;
  return { connect };

  async function connect(): Promise<SqlClient> {
    if (client != null) return client;

    const supportedRuntime = detectSupportRuntime();
    if (supportedRuntime === 'cloudflare-worker') {
      if (typeof db === 'object' && 'prepare' in db) {
        return (client = createCloudflareD1Adapter(db as D1Database));
      }

      throw new Error('Cloudflare D1 must provide a D1Database instance');
    } else if (supportedRuntime === 'bun') {
      if (typeof db === 'object' && 'prepare' in db) {
        return (client = createBunSQLiteAdapter(db as BunDatabase));
      }

      const { Database } = await import('bun:sqlite');
      const instance = new Database(db, options?.bun);
      return (client = createBunSQLiteAdapter(instance));
    } else if (supportedRuntime === 'node') {
      try {
        if (typeof db === 'object' && 'prepare' in db) {
          return (client = createNodeSQLiteAdapter(db as NodeDatabase));
        }

        const { DatabaseSync } = await import('node:sqlite');
        const instance = new DatabaseSync(db, options?.node);
        return (client = createNodeSQLiteAdapter(instance));
      } catch {
        // Fallback to generic SQLite client
      }
    }

    try {
      if (typeof db === 'object' && 'prepare' in db) {
        return (client = createBetterSQLite3Adapter(
          db as BetterSqlite3.Database,
        ));
      }

      const { default: Database } = await import('better-sqlite3');
      const instance = new Database(db, options?.['better-sqlite3']);
      return (client = createBetterSQLite3Adapter(instance));
    } catch {
      throw new Error(
        'Current runtime not supported SQLite, Please use [bun](https://bun.sh)/[Node.JS](https://nodejs.org/) >= 24 or install [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)',
      );
    }
  }
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
}
