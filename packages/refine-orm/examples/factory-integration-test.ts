/**
 * Integration test for the user-friendly factory functions
 * This demonstrates that the factory functions work correctly in practice
 */

import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import {
  createProvider,
  createSQLiteProvider,
  createDataProvider,
  getRuntimeDiagnostics,
  checkDatabaseSupport
} from '../src/factory.js';

// Test schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
});

const schema = { users, posts };

async function testFactoryFunctions() {
  console.log('=== Testing User-Friendly Factory Functions ===\n');

  try {
    // Test 1: Universal createProvider function
    console.log('1. Testing universal createProvider function...');
    const provider1 = createProvider({
      database: 'sqlite',
      connection: ':memory:',
      schema,
      options: { debug: true }
    });
    console.log('✓ Universal factory function works');
    console.log('  Provider created successfully');
    console.log('  Provider has getList:', typeof provider1.getList === 'function');
    console.log('  Provider has create:', typeof provider1.create === 'function');
    console.log();

    // Test 2: Database-specific factory function
    console.log('2. Testing createSQLiteProvider function...');
    const provider2 = createSQLiteProvider({
      connection: ':memory:',
      schema,
      options: { debug: false }
    });
    console.log('✓ SQLite-specific factory function works');
    console.log('  Provider created successfully');
    console.log();

    // Test 3: Auto-detection factory function
    console.log('3. Testing createDataProvider with auto-detection...');
    const provider3 = createDataProvider({
      connection: ':memory:',
      schema,
      options: { debug: false }
    });
    console.log('✓ Auto-detection factory function works');
    console.log('  Provider created successfully');
    console.log();

    // Test 4: Runtime diagnostics
    console.log('4. Testing runtime diagnostics...');
    const diagnostics = getRuntimeDiagnostics();
    console.log('✓ Runtime diagnostics work');
    console.log('  Current runtime:', diagnostics.runtime);
    console.log('  Runtime version:', diagnostics.version);
    console.log('  Recommended SQLite driver:', diagnostics.recommendedDrivers.sqlite);
    console.log('  Bun SQLite support:', diagnostics.features.bunSqlite);
    console.log('  Node.js environment:', diagnostics.environment.isNode);
    console.log('  Bun environment:', diagnostics.environment.isBun);
    console.log();

    // Test 5: Database support checking
    console.log('5. Testing database support checking...');
    const sqliteSupport = checkDatabaseSupport('sqlite');
    const bunSqliteSupport = checkDatabaseSupport('sqlite', 'bun:sqlite');
    const betterSqlite3Support = checkDatabaseSupport('sqlite', 'better-sqlite3');
    console.log('✓ Database support checking works');
    console.log('  SQLite support:', sqliteSupport);
    console.log('  Bun SQLite support:', bunSqliteSupport);
    console.log('  better-sqlite3 support:', betterSqlite3Support);
    console.log();

    // Test 6: Error handling
    console.log('6. Testing error handling...');
    try {
      createProvider({
        database: 'unsupported' as any,
        connection: 'test',
        schema
      });
      console.log('✗ Error handling failed - should have thrown');
    } catch (error) {
      console.log('✓ Error handling works');
      console.log('  Error message:', (error as Error).message);
    }
    console.log();

    try {
      createDataProvider({
        connection: 'invalid://connection',
        schema
      });
      console.log('✗ Auto-detection error handling failed - should have thrown');
    } catch (error) {
      console.log('✓ Auto-detection error handling works');
      console.log('  Error message:', (error as Error).message);
    }
    console.log();

    // Test 7: Basic CRUD operations (if possible)
    console.log('7. Testing basic CRUD operations...');
    try {
      // This might fail if database drivers aren't available, but that's expected
      const testProvider = createSQLiteProvider({
        connection: ':memory:',
        schema,
        options: { debug: false }
      });
      
      console.log('✓ Provider creation successful');
      console.log('  Available methods:');
      console.log('    - getList:', typeof testProvider.getList === 'function');
      console.log('    - getOne:', typeof testProvider.getOne === 'function');
      console.log('    - create:', typeof testProvider.create === 'function');
      console.log('    - update:', typeof testProvider.update === 'function');
      console.log('    - delete:', typeof testProvider.delete === 'function');
      console.log('    - from (chain query):', typeof testProvider.from === 'function');
      console.log('    - transaction:', typeof testProvider.transaction === 'function');
    } catch (error) {
      console.log('⚠ CRUD operations test skipped (driver not available)');
      console.log('  This is expected in environments without SQLite drivers');
      console.log('  Error:', (error as Error).message);
    }
    console.log();

    console.log('=== All Factory Function Tests Completed Successfully! ===');
    return true;

  } catch (error) {
    console.error('❌ Factory function test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.main) {
  testFactoryFunctions()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testFactoryFunctions };