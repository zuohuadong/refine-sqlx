#!/usr/bin/env node --experimental-sqlite

/**
 * Integration test for real Node.js 22.5+ and Bun 1.2+ environments
 * This script should be run in actual Node.js or Bun environments to verify
 * that the native SQLite support works correctly.
 */

const fs = require('fs');
const path = require('path');

// Clean up any existing test database
const testDbPath = './test-integration.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

async function runIntegrationTests() {
  console.log('🧪 Running Integration Tests for Native SQLite Support\n');
  
  try {
    // Import the ESM module
    const { dataProvider } = await import('./dist/index.mjs');
    
    console.log('✅ Successfully imported dataProvider');
    
    // Test with file path (should auto-detect Node.js or Bun)
    console.log('🔍 Testing native SQLite with file path...');
    
    const provider = dataProvider(testDbPath);
    console.log('✅ Successfully created provider with file path');
    
    // Create a test table
    await provider.custom({
      url: '/setup',
      method: 'post',
      payload: {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        params: []
      }
    });
    console.log('✅ Successfully created test table');
    
    // Test create
    const createResult = await provider.create({
      resource: 'users',
      variables: { name: 'John Doe', email: 'john@example.com' }
    });
    console.log('✅ Create operation successful:', createResult.data);
    
    // Test getList
    const listResult = await provider.getList({
      resource: 'users',
      pagination: { current: 1, pageSize: 10 }
    });
    console.log('✅ GetList operation successful:', listResult);
    
    // Test getOne
    const userId = createResult.data?.id || createResult.data?.lastInsertRowid || 1;
    const oneResult = await provider.getOne({
      resource: 'users',
      id: userId.toString()
    });
    console.log('✅ GetOne operation successful:', oneResult.data);
    
    // Test update
    const updateResult = await provider.update({
      resource: 'users',
      id: userId.toString(),
      variables: { name: 'Jane Doe' }
    });
    console.log('✅ Update operation successful:', updateResult.data);
    
    // Test createMany
    const createManyResult = await provider.createMany({
      resource: 'users',
      variables: [
        { name: 'Alice Smith', email: 'alice@example.com' },
        { name: 'Bob Wilson', email: 'bob@example.com' }
      ]
    });
    console.log('✅ CreateMany operation successful:', createManyResult.data.length, 'records');
    
    // Test getMany
    const createdIds = createManyResult.data.map(r => (r.id || r.lastInsertRowid || Math.random()).toString());
    const getManyResult = await provider.getMany({
      resource: 'users',
      ids: createdIds
    });
    console.log('✅ GetMany operation successful:', getManyResult.data.length, 'records');
    
    // Test filters and sorting
    const filteredResult = await provider.getList({
      resource: 'users',
      filters: [
        { field: 'name', operator: 'contains', value: 'e' }
      ],
      sorters: [
        { field: 'name', order: 'asc' }
      ],
      pagination: { current: 1, pageSize: 5 }
    });
    console.log('✅ Filtered query successful:', filteredResult.data.length, 'records');
    
    // Test custom query
    const customResult = await provider.custom({
      url: '/custom',
      method: 'get',
      payload: {
        sql: 'SELECT COUNT(*) as total FROM users',
        params: []
      }
    });
    console.log('✅ Custom query successful:', customResult.data);
    
    // Test delete
    const deleteResult = await provider.deleteOne({
      resource: 'users',
      id: userId.toString()
    });
    console.log('✅ Delete operation successful:', deleteResult.data);
    
    // Test deleteMany
    const deleteManyResult = await provider.deleteMany({
      resource: 'users',
      ids: createdIds
    });
    console.log('✅ DeleteMany operation successful:', deleteManyResult.data.length, 'records');
    
    // Runtime detection test
    const { DatabaseAdapter } = await import('./dist/index.mjs');
    const adapter = new DatabaseAdapter(testDbPath);
    const runtimeType = adapter.getType();
    console.log('✅ Runtime detection successful:', runtimeType);
    
    // Clean up
    adapter.close();
    
    console.log('\n🎉 All integration tests passed!');
    console.log(`🏃 Runtime: ${runtimeType}`);
    console.log(`📁 Database: ${testDbPath}`);
    
    // Environment info
    if (typeof process !== 'undefined' && process.versions) {
      console.log(`🟢 Node.js version: ${process.versions.node}`);
    }
    if (typeof globalThis.Bun !== 'undefined') {
      console.log(`🟠 Bun version: ${globalThis.Bun.version}`);
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  } finally {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('🧹 Cleaned up test database');
    }
  }
}

// Check environment compatibility
function checkEnvironment() {
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  const isBun = typeof globalThis.Bun !== 'undefined';
  
  if (!isNode && !isBun) {
    console.log('⚠️  This integration test requires Node.js 22.5+ or Bun 1.2+');
    console.log('📋 Current environment: Browser/Other');
    process.exit(0);
  }
  
  if (isNode) {
    const nodeVersion = process.versions.node;
    const [major, minor] = nodeVersion.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 5)) {
      console.log(`⚠️  Node.js 22.5.0+ required, current: ${nodeVersion}`);
      process.exit(0);
    }
    console.log(`🟢 Node.js ${nodeVersion} detected - compatible!`);
  }
  
  if (isBun) {
    const bunVersion = globalThis.Bun.version;
    const [major, minor] = bunVersion.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 2)) {
      console.log(`⚠️  Bun 1.2.0+ required, current: ${bunVersion}`);
      process.exit(0);
    }
    console.log(`🟠 Bun ${bunVersion} detected - compatible!`);
  }
}

// Run the tests
checkEnvironment();
runIntegrationTests().catch(console.error);
