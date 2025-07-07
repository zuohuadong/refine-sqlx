# Cloudflare D1 Data Provider

This package provides a data provider for Refine framework specifically designed for Cloudflare D1 database and Cloudflare Workers.

## Features

- 🚀 Cloudflare D1 Database Support
- ⚡ Optimized for Cloudflare Workers
- 📝 Full CRUD Operations Support
- 🛡️ TypeScript Type Safety
- 🔄 Complete Refine DataProvider Interface

## Installation

```bash
npm install refine-d1
```

## Usage

### Using with Cloudflare Workers

```typescript
import { dataProvider } from 'refine-d1';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create data provider with D1 database
    const provider = dataProvider(env.DB);
    
    // Use the data provider
    const result = await provider.getList({
      resource: "posts",
      pagination: { current: 1, pageSize: 10 }
    });
    
    return new Response(JSON.stringify(result));
  }
};
```

### Example Worker Implementation

```typescript
// worker.ts
import { dataProvider } from 'refine-d1';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    const provider = dataProvider(env.DB);
    
    // Handle API requests
    if (request.url.includes('/api/')) {
      // Your API logic here
      return new Response('API endpoint');
    }
    
    return new Response('Worker is running');
  }
};
```
## Cloudflare Workers Setup

### 1. Configure wrangler.toml

```toml
name = "your-worker-name"
main = "src/worker.ts"
compatibility_date = "2024-08-15"

[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"
```

### 2. Create D1 Database

```bash
# Create database
wrangler d1 create your-database-name

# Execute migration
wrangler d1 execute your-database-name --file=./schema.sql
```

### 3. Example Database Schema

```sql
-- schema.sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO posts (title, content) VALUES 
('First Post', 'This is the first post'),
('Second Post', 'This is the second post');
```

## API Reference

### dataProvider(database)

Creates a data provider instance for Cloudflare D1.

**Parameters:**
- `database`: `D1Database` - D1Database instance from Cloudflare Workers environment

**Returns:** Data provider object with the following methods:

- `getList(params)` - Get list of records with pagination and filtering
- `getOne(params)` - Get single record by ID
- `getMany(params)` - Get multiple records by IDs
- `create(params)` - Create new record
- `createMany(params)` - Create multiple records
- `update(params)` - Update record
- `updateMany(params)` - Update multiple records
- `deleteOne(params)` - Delete single record
- `deleteMany(params)` - Delete multiple records
- `getApiUrl()` - Get API URL
- `custom(params)` - Execute custom SQL queries

## Deploy to Cloudflare Workers

```bash
# Development mode
npm run start

# Deploy to production
npm run deploy
```

## Important Notes

1. **Async Operations**: All methods are async to support D1's async API
2. **Parameterized Queries**: Automatically uses parameterized queries to prevent SQL injection
3. **Error Handling**: Comprehensive error handling and logging
4. **Type Safety**: Full TypeScript support
5. **Edge Optimized**: Designed specifically for Cloudflare Workers and edge computing

## Example Project

See `src/worker.ts` file for a complete Cloudflare Workers example.
