import { createRefineSQL } from 'refine-sqlx';
import { Database as BunDatabase } from 'bun:sqlite';
import { DatabaseSync as NodeDatabase } from 'node:sqlite';
import { D1Database } from '@cloudflare/workers-types';
import BetterSqlite3 from 'better-sqlite3';

//---------- Detect SQLite, Auto matching supported
const provider = createRefineSQL(':memory:');

provider.getOne({ resource: 'users', id: 1 });

//------------ Detect SQLite with bun only
const db1 = new BunDatabase(':memory:');
const provider1 = createRefineSQL(db1);

provider1.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with Node only
const db2 = new NodeDatabase(':memory:');
const provider2 = createRefineSQL(db2);

provider2.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with D1 only
const db3 = {} as D1Database;
const provider3 = createRefineSQL(db3);

provider3.getOne({ resource: 'users', id: 1 });

//----------- Detect SQLite with better-sqlite3 only
const db4 = new BetterSqlite3(':memory:');
const provider4 = createRefineSQL(db4);

provider4.getOne({ resource: 'users', id: 1 });
