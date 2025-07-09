import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type {
  DatabaseSync as NodeDatabase,
  DatabaseSyncOptions as NodeDatabaseOptions,
} from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';
import type { SqlClient, SqlClientFactory } from './client';
import createBetterSQLite3 from './better-sqlite3';
import createBunSQLite from './bun-sqlite';
import createCloudflareD1 from './cloudflare-d1';
import createNodeSQLite from './node-sqlite';

const enum SqlitePkg {
  node = 'node:sqlite',
  bun = 'bun:sqlite',
  generic = 'better-sqlite3',
}

export type DetectSQLiteOptions = {
  bun?: ConstructorParameters<typeof BunDatabase>['1'];
  node?: NodeDatabaseOptions;
  'better-sqlite3'?: BetterSqlite3.Options;
};

export default function detectSQLite(
  db: ':memory:',
  options?: DetectSQLiteOptions,
): SqlClientFactory;
export default function detectSQLite(
  db: string,
  options?: DetectSQLiteOptions,
): SqlClientFactory;
export default function detectSQLite(db: D1Database): SqlClientFactory;
export default function detectSQLite(db: BunDatabase): SqlClientFactory;
export default function detectSQLite(db: NodeDatabase): SqlClientFactory;
export default function detectSQLite(
  db: BetterSqlite3.Database,
): SqlClientFactory;
export default function detectSQLite(
  db: string | D1Database | BunDatabase | NodeDatabase | BetterSqlite3.Database,
  options?: DetectSQLiteOptions | undefined,
): SqlClientFactory {
  let client: SqlClient;
  return { connect };

  async function connect(): Promise<SqlClient> {
    if (client != null) return client;
    if (
      typeof db === 'object' &&
      'prepare' in db &&
      typeof navigator != 'undefined' &&
      navigator.userAgent.toLowerCase().includes('cloudflare')
    ) {
      return (client = createCloudflareD1(db as D1Database));
    }

    const pkgIdentifer = deleteSqlitePkgIdentifer();
    if (pkgIdentifer === SqlitePkg.bun) {
      if (typeof db === 'object' && 'prepare' in db) {
        return (client = createBunSQLite(db as BunDatabase));
      }

      const { Database } = await import('bun:sqlite');
      const instance = new Database(db, options?.bun);
      return (client = createBunSQLite(instance));
    } else if (pkgIdentifer === SqlitePkg.node) {
      try {
        if (typeof db === 'object' && 'prepare' in db) {
          return (client = createNodeSQLite(db as NodeDatabase));
        }

        const { DatabaseSync } = await import('node:sqlite');
        const instance = new DatabaseSync(db, options?.node);
        return (client = createNodeSQLite(instance));
      } catch {
        // Fallback to generic SQLite client
      }
    }

    try {
      if (typeof db === 'object' && 'prepare' in db) {
        return (client = createBetterSQLite3(db as BetterSqlite3.Database));
      }

      const { default: Database } = await import('better-sqlite3');
      const instance = new Database(db, options?.['better-sqlite3']);
      return (client = createBetterSQLite3(instance));
    } catch {
      throw new Error(
        'Current runtime not supported SQLite, Please use [bun](https://bun.sh)/Node.JS >= 24 or install better-sqlite3',
      );
    }
  }
}

function deleteSqlitePkgIdentifer() {
  if ('Bun' in globalThis && typeof globalThis.Bun?.sql === 'function') {
    return SqlitePkg.bun;
  } else if ('process' in globalThis && process.versions.node) {
    return SqlitePkg.node;
  }
  return SqlitePkg.generic;
}
