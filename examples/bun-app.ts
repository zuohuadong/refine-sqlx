// Example: Bun application with native SQLite
import { dataProvider } from '../src/index.ts';

// For Bun 1.2+, use a file path
const provider = dataProvider('./bun-database.db');

async function setupDatabase() {
  // Create tables if they don't exist
  await provider.custom({
    url: '/setup',
    method: 'post',
    payload: {
      sql: `
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          category TEXT,
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
    
    // Create multiple products
    const products = await provider.createMany({
      resource: 'products',
      variables: [
        { name: 'Laptop', price: 999.99, category: 'Electronics' },
        { name: 'Smartphone', price: 599.99, category: 'Electronics' },
        { name: 'Coffee Mug', price: 15.99, category: 'Kitchen' }
      ]
    });
    console.log('✅ Created products:', products.data.length);
    
    // Get products with filtering and sorting
    const electronicsProducts = await provider.getList({
      resource: 'products',
      filters: [
        { field: 'category', operator: 'eq', value: 'Electronics' }
      ],
      sorters: [
        { field: 'price', order: 'desc' }
      ],
      pagination: { current: 1, pageSize: 10 }
    });
    console.log('✅ Electronics products:', electronicsProducts.data);
    
    // Update product prices
    const productIds = products.data.map(p => p.lastInsertRowid.toString());
    await provider.updateMany({
      resource: 'products',
      ids: productIds.slice(0, 2), // Update first 2 products
      variables: { price: 899.99 } // Sale price
    });
    console.log('✅ Updated product prices');
    
    // Get total product count
    const totalCount = await provider.custom({
      url: '/stats',
      method: 'get',
      payload: {
        sql: 'SELECT COUNT(*) as total, AVG(price) as avg_price FROM products',
        params: []
      }
    });
    console.log('✅ Product statistics:', totalCount.data);
    
    // Clean up - delete all products
    await provider.deleteMany({
      resource: 'products',
      ids: productIds
    });
    console.log('✅ Cleaned up products');
    
    console.log(`\n🟠 All operations completed successfully on Bun ${Bun.version}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
if (import.meta.main) {
  await exampleOperations();
}

export { provider, exampleOperations };
