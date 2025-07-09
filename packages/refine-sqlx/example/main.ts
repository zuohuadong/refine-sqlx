import { createRefineSQLite, detectSQLite } from 'refine-sqlx';
import { Database as BunDatabase } from 'bun:sqlite';
import { DatabaseSync as NodeDatabase } from 'node:sqlite';
import { D1Database } from '@cloudflare/workers-types';
import BetterSqlite3 from 'better-sqlite3';

//---------- Detect SQLite, Auto matching supported
const db = detectSQLite(':memory:');
const provider = createRefineSQLite(db);

provider.getOne({ resource: 'users', id: 1 });

//------------ Detect SQLite with bun only
const bunDB = new BunDatabase(':memory:');
const db1 = detectSQLite(bunDB);
const provider1 = createRefineSQLite(db1);

provider1.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with Node only
const nodeDB = new NodeDatabase(':memory:');
const db2 = detectSQLite(nodeDB);
const provider2 = createRefineSQLite(db2);

provider2.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with D1 only
const d1 = {} as D1Database;
const db3 = detectSQLite(d1);
const provider3 = createRefineSQLite(db3);

provider3.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with better-sqlite3 only
const better = new BetterSqlite3(':memory:');
const db4 = detectSQLite(better);
const provider4 = createRefineSQLite(db4);

provider4.getOne({ resource: 'users', id: 1 });
