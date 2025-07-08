// Example: Universal cross-platform implementation
import { dataProvider } from '../src/index.js';

/**
 * Universal data provider that works across all supported runtimes:
 * - Cloudflare Workers (D1)
 * - Node.js 22.5+ (native SQLite)
 * - Bun 1.2+ (native SQLite)
 */
export function createUniversalProvider(dbInput) {
  return dataProvider(dbInput);
}

/**
 * Environment-aware provider factory
 */
export function createProvider() {
  // Detect environment and create appropriate provider
  if (typeof globalThis.Bun !== 'undefined') {
    // Bun environment
    console.log('🟠 Detected Bun environment');
    return dataProvider('./bun-database.db');
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js environment
    console.log('🟢 Detected Node.js environment');
    return dataProvider('./nodejs-database.db');
  } else if (typeof caches !== 'undefined') {
    // Likely Cloudflare Workers environment
    console.log('🔶 Detected Cloudflare Workers environment');
    // In real usage, you'd get the D1 database from env
    throw new Error('D1 database must be provided in Cloudflare Workers environment');
  } else {
    throw new Error('Unsupported environment');
  }
}

/**
 * Example of a complete CRUD service that works everywhere
 */
export class UserService {
  constructor(dbInput) {
    this.provider = createUniversalProvider(dbInput);
  }

  async initialize() {
    // Create users table if it doesn't exist
    await this.provider.custom({
      url: '/setup',
      method: 'post',
      payload: {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'user',
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `,
        params: []
      }
    });
  }

  async createUser(userData) {
    return await this.provider.create({
      resource: 'users',
      variables: userData
    });
  }

  async getUsers(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = null,
      active = null
    } = options;

    const filters = [];
    
    if (search) {
      filters.push({
        field: 'name',
        operator: 'contains',
        value: search
      });
    }
    
    if (role) {
      filters.push({
        field: 'role',
        operator: 'eq',
        value: role
      });
    }
    
    if (active !== null) {
      filters.push({
        field: 'active',
        operator: 'eq',
        value: active
      });
    }

    return await this.provider.getList({
      resource: 'users',
      pagination: { current: page, pageSize: limit },
      filters,
      sorters: [{ field: 'created_at', order: 'desc' }]
    });
  }

  async getUserById(id) {
    return await this.provider.getOne({
      resource: 'users',
      id: id.toString()
    });
  }

  async updateUser(id, userData) {
    return await this.provider.update({
      resource: 'users',
      id: id.toString(),
      variables: userData
    });
  }

  async deleteUser(id) {
    return await this.provider.deleteOne({
      resource: 'users',
      id: id.toString()
    });
  }

  async getUserStats() {
    return await this.provider.custom({
      url: '/stats',
      method: 'get',
      payload: {
        sql: `
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN active = 1 THEN 1 END) as active_users,
            COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
          FROM users
        `,
        params: []
      }
    });
  }
}

// Example usage for different environments
export async function runExample(dbInput) {
  const userService = new UserService(dbInput);
  
  try {
    // Initialize database
    await userService.initialize();
    console.log('✅ Database initialized');
    
    // Create some users
    const users = [
      { name: 'Alice Admin', email: 'alice@example.com', role: 'admin' },
      { name: 'Bob User', email: 'bob@example.com', role: 'user' },
      { name: 'Charlie Manager', email: 'charlie@example.com', role: 'manager' }
    ];
    
    const createdUsers = [];
    for (const userData of users) {
      const user = await userService.createUser(userData);
      createdUsers.push(user);
      console.log(`✅ Created user: ${userData.name}`);
    }
    
    // Get all users
    const allUsers = await userService.getUsers();
    console.log(`✅ Retrieved ${allUsers.data.length} users (total: ${allUsers.total})`);
    
    // Search for specific users
    const adminUsers = await userService.getUsers({ role: 'admin' });
    console.log(`✅ Found ${adminUsers.data.length} admin users`);
    
    // Get user statistics
    const stats = await userService.getUserStats();
    console.log('✅ User statistics:', stats.data[0]);
    
    // Update a user
    if (createdUsers.length > 0) {
      const firstUser = createdUsers[0];
      await userService.updateUser(firstUser.data.lastInsertRowid, {
        active: false
      });
      console.log('✅ Updated user status');
    }
    
    // Clean up
    for (const user of createdUsers) {
      await userService.deleteUser(user.data.lastInsertRowid);
    }
    console.log('✅ Cleaned up test data');
    
    console.log('\n🎉 Universal example completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in universal example:', error);
    throw error;
  }
}

// Auto-run example if this is the main module
if (typeof require !== 'undefined' && require.main === module) {
  const provider = createProvider();
  runExample(provider).catch(console.error);
}
