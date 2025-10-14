/**
 * @refine-sqlx/sql Basic Usage Example
 * 
 * @refine-sqlx/sql is a lightweight package for SQLite and Cloudflare D1 environments
 * Fully compatible with @refine-sqlx/orm API, making migration from @refine-sqlx/orm easy
 */

import { createRefineSQL } from '../packages/@refine-sqlx/sql/src/index.js';

async function main() {
  console.log('🚀 @refine-sqlx/sql - SQLite/D1 精简包示例\n');

  try {
    // ========== Auto-detect Runtime Environment ==========
    console.log('1️⃣ Auto-detect SQLite Environment (Recommended)');
    const provider = createRefineSQL(':memory:');
    
    console.log('   ✅ Auto-detect and create adapter');
    console.log('   🔧 Supports: Bun SQLite, Node.js better-sqlite3, Cloudflare D1');
    console.log('   📝 Usage: provider.getOne({ resource: "users", id: 1 })\n');

    // ========== @refine-sqlx/orm Compatible API ==========
    console.log('2️⃣ @refine-sqlx/orm Compatible API (Fully Compatible)');
    
    // Standard Refine DataProvider API
    console.log('   📋 Standard CRUD Operations:');
    console.log('     - getList: await provider.getList({ resource: "users" })');
    console.log('     - getOne: await provider.getOne({ resource: "users", id: 1 })');
    console.log('     - create: await provider.create({ resource: "users", variables: {...} })');
    console.log('     - update: await provider.update({ resource: "users", id: 1, variables: {...} })');
    console.log('     - deleteOne: await provider.deleteOne({ resource: "users", id: 1 })\n');

    // ========== Chain Query API (Compatible with @refine-sqlx/orm) ==========
    console.log('3️⃣ Chain Query API (Compatible with @refine-sqlx/orm)');
    const chainQuery = provider.from('users')
      .where('status', 'eq', 'active')   // New generic method
      .where('age', 'gt', 18)            // New generic method
      .orderBy('created_at', 'desc')     // New generic method
      .limit(10);
    
    console.log('   ✅ Chain query built successfully (using new generic API)');
    console.log('   📝 Execute: await chainQuery.get()\n');

    // ========== Relationship Queries (Compatible with @refine-sqlx/orm) ==========
    console.log('4️⃣ Relationship Queries (Compatible with @refine-sqlx/orm)');
    console.log('   📝 belongsTo: provider.from("posts").withBelongsTo("author", "users")');
    console.log('   📝 hasMany: provider.from("users").withHasMany("posts", "posts")');
    console.log('   📝 Execute: await query.getWithRelations()\n');

    // ========== Environment-Specific Optimizations ==========
    console.log('5️⃣ Environment-Specific Optimizations');
    console.log('   ⚡ Bun: Uses built-in bun:sqlite, zero configuration');
    console.log('   ⚡ Node.js: Uses better-sqlite3, high performance');
    console.log('   ⚡ Cloudflare D1: Edge computing optimized, low latency\n');

    console.log('🎉 @refine-sqlx/sql example completed!');
    console.log('💡 Tip: Fully compatible with @refine-sqlx/orm API, zero-cost migration');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run example if this file is executed directly
if (import.meta.main) {
  main();
}