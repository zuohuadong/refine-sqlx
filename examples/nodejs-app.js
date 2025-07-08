// Example: Node.js application with native SQLite
import { dataProvider } from '../src/index.js';
import { Refine } from '@refinedev/core';

// For Node.js 22.5+, use a file path
const provider = dataProvider('./database.db');

async function setupDatabase() {
  // Create tables if they don't exist
  await provider.custom({
    url: '/setup',
    method: 'post',
    payload: {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
      params: []
    }
  });
  
  console.log('✅ Database tables created');
}

async function exampleOperations() {
  try {
    // Setup database
    await setupDatabase();
    
    // Create a user
    const newUser = await provider.create({
      resource: 'users',
      variables: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    console.log('✅ Created user:', newUser.data);
    
    // Get all users
    const allUsers = await provider.getList({
      resource: 'users',
      pagination: { current: 1, pageSize: 10 }
    });
    console.log('✅ All users:', allUsers.data);
    
    // Update user
    const updatedUser = await provider.update({
      resource: 'users',
      id: newUser.data.lastInsertRowid.toString(),
      variables: { name: 'Jane Doe' }
    });
    console.log('✅ Updated user:', updatedUser.data);
    
    // Get user by ID
    const user = await provider.getOne({
      resource: 'users',
      id: newUser.data.lastInsertRowid.toString()
    });
    console.log('✅ Found user:', user.data);
    
    // Delete user
    const deletedUser = await provider.deleteOne({
      resource: 'users',
      id: newUser.data.lastInsertRowid.toString()
    });
    console.log('✅ Deleted user:', deletedUser.data);
    
    console.log(`\n🟢 All operations completed successfully on Node.js ${process.version}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
if (require.main === module) {
  exampleOperations().catch(console.error);
}

export { provider, exampleOperations };
