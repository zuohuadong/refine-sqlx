# Cloudflare D1 Support

This version of refine-d1 is specifically designed for Cloudflare D1 database and runs in Cloudflare Workers.

## Features

- 🚀 Cloudflare D1 Database Support
- � Edge-optimized for Workers
- 📝 Full CRUD Operations Support
- 🛡️ TypeScript Type Safety

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

### dataProvider(dbOrPath)

Creates a data provider instance.

**Parameters:**
- `dbOrPath`: `string | D1Database` - Can be:
  - SQLite database file path (Node.js environment)
  - D1Database instance (Cloudflare Workers environment)

**Returns:** Data provider object with the following methods:

- `getList(params)` - Get list of records
- `getOne(params)` - Get single record
- `getMany(params)` - Get multiple records
- `create(params)` - Create new record
- `update(params)` - Update record
- `deleteOne(params)` - Delete record

## Deploy to Cloudflare Workers

```bash
# Development mode
npm run dev:worker

# Deploy to production
npm run deploy:worker
```

## Environment Detection

The library automatically detects the runtime environment:
- Cloudflare Workers: Uses D1Database
- Node.js: Uses better-sqlite3
- Other environments: Throws error

## Important Notes

1. **Async Operations**: All methods are now async to support D1's async API
2. **Parameterized Queries**: Automatically uses parameterized queries to prevent SQL injection
3. **Error Handling**: Improved error handling and logging
4. **Type Safety**: Full TypeScript support

## Example Project

See `src/worker.ts` file for a complete Cloudflare Workers example.
