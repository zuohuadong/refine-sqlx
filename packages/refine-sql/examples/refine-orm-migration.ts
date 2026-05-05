/**
 * Complete migration example from refine-orm to refine-sql
 * Shows before/after code and step-by-step migration process
 */

// ===== BEFORE (refine-orm) =====
/*
import { createSQLiteProvider } from 'refine-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Drizzle schema definition (refine-orm requires Drizzle)
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  status: text('status').notNull(),
  age: integer('age'),
  created_at: text('created_at'),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  published: integer('published', { mode: 'boolean' }),
  created_at: text('created_at'),
});

const schema = { users, posts };

// Create provider (refine-orm)
const dataProvider = createSQLiteProvider('./database.db', schema);
*/

// ===== AFTER (refine-sql with refine-orm compatibility) =====

import { 
  createSQLiteProvider,
  type RefineOrmCompatibleProvider,
  type SQLiteProviderConfig,
  MigrationHelpers,
  CodeTransformer
} from '../src/refine-orm-compat';

// Simple TypeScript schema definition (no Drizzle needed)
interface MySchema {
  users: {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'inactive';
    age?: number;
    created_at?: string;
  };
  posts: {
    id: number;
    title: string;
    content?: string;
    userId: number;
    published: boolean;
    created_at?: string;
  };
}

// Create provider with refine-orm compatible API
const config: SQLiteProviderConfig<MySchema> = {
  connection: './database.db',
  schema: {
    users: {} as MySchema['users'],
    posts: {} as MySchema['posts'],
  },
  options: {
    enablePerformanceMonitoring: true,
    debug: true,
  },
};

const dataProvider: RefineOrmCompatibleProvider<MySchema> = createSQLiteProvider(config);

// ===== MIGRATION EXAMPLES =====

async function demonstrateMigration() {
  console.log('🚀 refine-orm to refine-sql Migration Example');
  
  // 1. Check compatibility
  console.log('\n1️⃣ Checking compatibility...');
  const packageJson = {
    dependencies: {
      'refine-orm': '^1.0.0',
      'better-sqlite3': '^8.0.0',
    }
  };
  
  const compatibility = MigrationHelpers.checkCompatibility(packageJson);
  console.log('Compatibility:', compatibility);
  
  // 2. Get migration checklist
  console.log('\n2️⃣ Migration checklist:');
  const checklist = MigrationHelpers.generateChecklist();
  checklist.forEach((item, index) => {
    console.log(`   ${item}`);
  });
  
  // 3. Bundle size comparison
  console.log('\n3️⃣ Bundle size comparison:');
  const bundleComparison = MigrationHelpers.getBundleSizeComparison();
  console.log(`   refine-orm: ${bundleComparison.refineOrm}`);
  console.log(`   refine-sql: ${bundleComparison.refineSql}`);
  console.log(`   Savings: ${bundleComparison.savings}`);
  
  // 4. Code transformation example
  console.log('\n4️⃣ Code transformation example:');
  const oldCode = `
    import { createSQLiteProvider } from 'refine-orm';
    const provider = createSQLiteProvider('./db.sqlite', schema);
    const users = await provider.from('users')
      .whereEq('status', 'active')
      .whereGt('age', 18)
      .orderByDesc('created_at')
      .get();
  `;
  
  const newCode = CodeTransformer.transformCode(oldCode);
  console.log('   Old code:', oldCode.trim());
  console.log('   New code:', newCode.trim());
}

// ===== USAGE EXAMPLES (All refine-orm methods work) =====

async function demonstrateCompatibility() {
  console.log('\n🔄 Demonstrating refine-orm compatibility...');
  
  try {
    // Standard CRUD operations (same as refine-orm)
    console.log('\n📝 Standard CRUD operations:');
    
    const user = await dataProvider.create({
      resource: 'users',
      variables: {
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        age: 30,
      },
    });
    console.log('✅ User created:', user.data.name);
    
    // Chain queries (same as refine-orm)
    console.log('\n⛓️ Chain queries:');
    const activeUsers = await dataProvider
      .from('users')
      .where('status', 'eq', 'active')  // New generic method
      .where('age', 'gt', 18)           // New generic method
      .orderBy('created_at', 'desc')    // New generic method
      .limit(10)
      .get();
    console.log(`✅ Found ${activeUsers.length} active users`);
    
    // Relationship queries (same as refine-orm)
    console.log('\n🔗 Relationship queries:');
    const userWithPosts = await dataProvider.getWithRelations(
      'users',
      user.data.id,
      ['posts']
    );
    console.log('✅ User with posts loaded');
    
    // Batch operations (same as refine-orm)
    console.log('\n📦 Batch operations:');
    const batchUsers = await dataProvider.createMany({
      resource: 'users',
      variables: [
        { name: 'Alice', email: 'alice@example.com', status: 'active' },
        { name: 'Bob', email: 'bob@example.com', status: 'inactive' },
      ],
      batchSize: 100,
    });
    console.log(`✅ Created ${batchUsers.data.length} users in batch`);
    
    // Advanced utilities (same as refine-orm)
    console.log('\n🛠️ Advanced utilities:');
    const upsertResult = await dataProvider.upsert({
      resource: 'users',
      variables: {
        email: 'john@example.com',
        name: 'John Updated',
        status: 'active',
      },
      conflictColumns: ['email'],
    });
    console.log(`✅ Upsert result - created: ${upsertResult.created}`);
    
    const firstOrCreateResult = await dataProvider.firstOrCreate({
      resource: 'users',
      where: { email: 'jane@example.com' },
      defaults: { name: 'Jane Doe', status: 'active' },
    });
    console.log(`✅ FirstOrCreate result - created: ${firstOrCreateResult.created}`);
    
    // Raw SQL execution (same as refine-orm)
    console.log('\n🔧 Raw SQL execution:');
    const rawResults = await dataProvider.executeRaw(
      'SELECT COUNT(*) as count FROM users WHERE status = ?',
      ['active']
    );
    console.log('✅ Raw query result:', rawResults);
    
    // Transaction support (same as refine-orm)
    console.log('\n💾 Transaction support:');
    await dataProvider.transaction(async (tx) => {
      await tx.create({
        resource: 'users',
        variables: { name: 'Transactional User', email: 'tx@example.com', status: 'active' },
      });
      console.log('✅ Transaction completed successfully');
    });
    
    // Performance monitoring (same as refine-orm)
    console.log('\n📊 Performance monitoring:');
    dataProvider.enablePerformanceMonitoring();
    
    // Execute some operations to generate metrics
    await dataProvider.getList({
      resource: 'users',
      pagination: { currentPage: 1, pageSize: 10, mode: 'server' },
    });
    
    const metrics = dataProvider.getPerformanceMetrics();
    console.log('✅ Performance metrics:', {
      totalQueries: metrics.summary.totalQueries,
      averageDuration: `${metrics.summary.averageDuration.toFixed(2)}ms`,
      successRate: `${(metrics.summary.successRate * 100).toFixed(1)}%`,
    });
    
  } catch (error) {
    console.error('❌ Error during compatibility demonstration:', error);
  }
}

// ===== ADVANCED CHAIN QUERY FEATURES =====

async function demonstrateAdvancedChainQueries() {
  console.log('\n🔗 Advanced chain query features:');
  
  try {
    // Batch processing with chunks
    console.log('\n📦 Batch processing:');
    let totalProcessed = 0;
    for await (const userChunk of dataProvider.from('users').chunk(5)) {
      totalProcessed += userChunk.length;
      console.log(`   Processed chunk of ${userChunk.length} users`);
    }
    console.log(`✅ Total processed: ${totalProcessed} users`);
    
    // Functional operations
    console.log('\n🔧 Functional operations:');
    
    const userNames = await dataProvider
      .from('users')
      .where('status', 'eq', 'active')
      .map((user: any) => user.name);
    console.log(`✅ Active user names: ${userNames.join(', ')}`);
    
    const adultUsers = await dataProvider
      .from('users')
      .filter((user: any) => user.age && user.age >= 18);
    console.log(`✅ Found ${adultUsers.length} adult users`);
    
    const hasActiveUsers = await dataProvider
      .from('users')
      .some((user: any) => user.status === 'active');
    console.log(`✅ Has active users: ${hasActiveUsers}`);
    
    // Aggregation operations
    console.log('\n📊 Aggregation operations:');
    
    const distinctStatuses = await dataProvider
      .from('users')
      .distinct('status');
    console.log(`✅ Distinct statuses: ${distinctStatuses.join(', ')}`);
    
    const usersByStatus = await dataProvider
      .from('users')
      .groupBy('status');
    console.log(`✅ Users by status:`, Object.keys(usersByStatus).map(status => 
      `${status}: ${usersByStatus[status].length}`
    ).join(', '));
    
    const oldestUser = await dataProvider
      .from('users')
      .maxBy('age');
    console.log(`✅ Oldest user: ${oldestUser?.name} (${oldestUser?.age} years old)`);
    
    // Performance timing
    console.log('\n⏱️ Performance timing:');
    const timedResult = await dataProvider
      .from('users')
      .where('status', 'eq', 'active')
      .timed();
    console.log(`✅ Query executed in ${timedResult.executionTime}ms, returned ${timedResult.data.length} records`);
    
  } catch (error) {
    console.error('❌ Error during advanced chain query demonstration:', error);
  }
}

// ===== CLOUDFLARE WORKERS EXAMPLE =====

// Example for Cloudflare Workers deployment
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Create provider with D1 database (same API as refine-orm)
    const workerProvider = createSQLiteProvider({
      connection: env.DB, // D1 database
      schema: {
        users: {} as MySchema['users'],
        posts: {} as MySchema['posts'],
      },
      options: {
        debug: false, // Disable debug in production
      },
    });

    try {
      const url = new URL(request.url);
      
      if (url.pathname === '/api/users') {
        const users = await workerProvider
          .from('users')
          .where('status', 'eq', 'active')
          .limit(10)
          .get();
        
        return new Response(JSON.stringify(users), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/api/posts') {
        const posts = await workerProvider.getWithRelations('posts', 1, ['author']);
        
        return new Response(JSON.stringify(posts), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('API Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

// ===== MAIN EXECUTION =====

async function main() {
  await demonstrateMigration();
  await demonstrateCompatibility();
  await demonstrateAdvancedChainQueries();
  
  console.log('\n🎉 Migration demonstration completed!');
  console.log('\n💡 Key benefits of refine-sql:');
  console.log('   • 85% smaller bundle size');
  console.log('   • Same familiar API as refine-orm');
  console.log('   • Optimized for SQLite and Cloudflare D1');
  console.log('   • Zero-cost migration from refine-orm');
  console.log('   • Enhanced performance in edge environments');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runRefineOrmMigrationExample };