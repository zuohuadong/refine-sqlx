// Mock for bun:sqlite module when running tests in Node.js
// This prevents Jest from trying to resolve the Bun-specific module

export class Database {
  constructor() {
    throw new Error('bun:sqlite is not available in Node.js environment');
  }
}

export default Database;
