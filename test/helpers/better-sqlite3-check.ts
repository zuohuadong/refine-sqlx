/**
 * Helper to check if better-sqlite3 is available
 * and skip tests if it's not compiled for the current environment
 */

let _isBetterSqlite3Available: boolean | null = null;

export function isBetterSqlite3Available(): boolean {
  if (_isBetterSqlite3Available !== null) {
    return _isBetterSqlite3Available;
  }

  try {
    // Try to require and instantiate better-sqlite3
    const Database = require('better-sqlite3');
    // Try to create a test database to verify the native module works
    const db = new Database(':memory:');
    db.close();
    _isBetterSqlite3Available = true;
    return true;
  } catch (error) {
    // If it fails, better-sqlite3 is not available or not compatible
    // This catches both module not found and native binding errors
    if (error instanceof Error) {
      console.log(
        `[better-sqlite3-check] Skipping better-sqlite3 tests: ${error.message}`,
      );
    }
    _isBetterSqlite3Available = false;
    return false;
  }
}

/**
 * Skip describe block if better-sqlite3 is not available
 */
export function describeIfBetterSqlite3Available(
  name: string,
  fn: () => void,
): void {
  if (isBetterSqlite3Available()) {
    describe(name, fn);
  } else {
    describe.skip(`${name} (better-sqlite3 not available)`, fn);
  }
}
