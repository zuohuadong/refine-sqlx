import type { D1Database } from '@cloudflare/workers-types';
import type {
  SqlAffected,
  SqlClient,
  SqlClientFactory,
  SqlQuery,
  SqlResult,
} from './client';
import type {
  Database as BunDatabase,
  SQLQueryBindings as BunSQLQueryBindings,
} from 'bun:sqlite';
import type {
  DatabaseSync as NodeDatabase,
  DatabaseSyncOptions as NodeDatabaseOptions,
} from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';

const enum SqlitePkg {
  node = 'node:sqlite',
  bun = 'bun:sqlite',
  generic = 'better-sqlite3',
}

export type DetectSQLiteOptions = {
  db: string | D1Database;
  bun?: ConstructorParameters<typeof BunDatabase>['1'];
  node?: NodeDatabaseOptions;
  'better-sqlite3'?: BetterSqlite3.Options;
};

export default function detectSQLite({
  db,
  ...options
}: DetectSQLiteOptions): SqlClientFactory {
  let client: SqlQuery;
  return { connect };

  async function connect(): Promise<SqlClient> {
    // @ts-expect-error
    if (client != null) return client;
    if (typeof db === 'object' && 'prepare' in db) {
      // @ts-expect-error
      return (client = createD1Client(db));
    }

    const pkgIdentifer = deleteSqlitePkgIdentifer();
    if (pkgIdentifer === SqlitePkg.bun) {
      const { Database } = await import('bun:sqlite');
      const instance = new Database(db, options.bun);
      // @ts-expect-error
      return (client = createBunClient(instance));
    } else if (pkgIdentifer === SqlitePkg.node) {
      try {
        const { DatabaseSync } = await import('node:sqlite');
        const instance = new DatabaseSync(db, options.node);
        // @ts-expect-error
        return (client = createNodeClient(instance));
      } catch {
        // Fallback to generic SQLite client
      }
    }

    try {
      const { default: Database } = await import('better-sqlite3');
      const instance = new Database(db, options['better-sqlite3']);
      // @ts-expect-error
      return (client = createGenericClient(instance));
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

function createD1Client(d1: D1Database): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const [columnNames, ...rows] = await stmt.raw({ columnNames: true });
    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = d1.prepare(query.sql).bind(query.args);
    const result = await stmt.run();

    return {
      changes: result.meta.changes,
      lastInsertId: result.meta.last_row_id,
    };
  }
}

function createBunClient(db: BunDatabase): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const rows = stmt.values(...(query.args as BunSQLQueryBindings[]));

    return { columnNames: stmt.columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as BunSQLQueryBindings[]));
    return {
      changes: result.changes,
      lastInsertId: result.lastInsertRowid as number | undefined,
    };
  }
}

function createNodeClient(db: NodeDatabase): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql);
    const result = stmt.all(...(query.args as any[]));
    const columnNames = stmt
      .columns()
      .map((e) => e.column)
      .filter(Boolean) as string[];
    const rows: unknown[][] = [];
    for (const item of result) {
      const row: unknown[] = [];
      for (const key in item) row.push(item[key]);
      rows.push(row);
    }

    return { columnNames, rows };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql);
    const result = stmt.run(...(query.args as any[]));
    return {
      changes: result.changes as any,
      lastInsertId: result.lastInsertRowid as any,
    };
  }
}

function createGenericClient(db: BetterSqlite3.Database): SqlClient {
  return { query, execute };

  async function query(query: SqlQuery): Promise<SqlResult> {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const columns = stmt.columns();

    return {
      columnNames: columns.map((column) => column.name),
      rows: stmt.raw().all() as unknown[][],
    };
  }

  async function execute(query: SqlQuery): Promise<SqlAffected> {
    const stmt = db.prepare(query.sql).bind(...query.args);
    const result = stmt.run();
    return {
      changes: result.changes,
      lastInsertId: result.lastInsertRowid as any,
    };
  }
}
