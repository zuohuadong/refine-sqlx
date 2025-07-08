# Refine-SQL Documentation

## Overview

Refine-SQL is a multi-runtime data provider for Refine that supports Cloudflare D1, Node.js SQLite, and Bun SQLite. It provides a consistent API across different runtime environments while maintaining high performance and type safety.

## Features

- **Multi-Runtime Support**: Works seamlessly with Cloudflare D1, Node.js SQLite, and Bun SQLite
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Flexible Queries**: Support for both standard CRUD operations and custom SQL queries
- **Auto Parameter Binding**: Automatic conversion between different parameter placeholder formats
- **Performance Optimized**: Efficient query generation and execution
- **Refine Integration**: Seamless integration with Refine's data provider interface

## Installation

```bash
npm install refine-sql
# or
yarn add refine-sql
# or
pnpm add refine-sql
```

## Quick Start

### Cloudflare D1 (Workers)

```typescript
import { createDataProvider } from 'refine-sql';

// In Cloudflare Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataProvider = createDataProvider({
      database: env.DB, // D1 Database binding
      type: 'd1'
    });
    
    // Use with Refine
    return handleRefineRequest(dataProvider);
  }
};
```

### Node.js SQLite

```typescript
import { createDataProvider } from 'refine-sql';
import Database from 'better-sqlite3';

const db = new Database('database.db');
const dataProvider = createDataProvider({
  database: db,
  type: 'sqlite'
});
```

### Bun SQLite

```typescript
import { createDataProvider } from 'refine-sql';
import { Database } from 'bun:sqlite';

const db = new Database('database.db');
const dataProvider = createDataProvider({
  database: db,
  type: 'bun-sqlite'
});
```

## API Reference

### createDataProvider(config)

Creates a data provider instance for the specified database type.

**Parameters:**
- `config.database`: Database instance (D1Database | Database)
- `config.type`: Database type ('d1' | 'sqlite' | 'bun-sqlite')

**Returns:** DataProvider instance compatible with Refine

### DataProvider Methods

#### getList(params)

Retrieves a paginated list of records.

```typescript
const result = await dataProvider.getList({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  sorters: [{ field: 'name', order: 'asc' }],
  filters: [{ field: 'status', operator: 'eq', value: 'active' }]
});
```

**Parameters:**
- `resource`: Table name
- `pagination`: Pagination settings
- `sorters`: Array of sort configurations
- `filters`: Array of filter configurations

**Returns:**
```typescript
{
  data: T[],
  total: number
}
```

#### getOne(params)

Retrieves a single record by ID.

```typescript
const result = await dataProvider.getOne({
  resource: 'users',
  id: '123'
});
```

**Parameters:**
- `resource`: Table name
- `id`: Record ID

**Returns:**
```typescript
{
  data: T
}
```

#### getMany(params)

Retrieves multiple records by IDs.

```typescript
const result = await dataProvider.getMany({
  resource: 'users',
  ids: ['1', '2', '3']
});
```

**Parameters:**
- `resource`: Table name
- `ids`: Array of record IDs

**Returns:**
```typescript
{
  data: T[]
}
```

#### create(params)

Creates a new record.

```typescript
const result = await dataProvider.create({
  resource: 'users',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active'
  }
});
```

**Parameters:**
- `resource`: Table name
- `variables`: Record data

**Returns:**
```typescript
{
  data: T
}
```

#### createMany(params)

Creates multiple records in a single transaction.

```typescript
const result = await dataProvider.createMany({
  resource: 'users',
  variables: [
    { name: 'John', email: 'john@example.com' },
    { name: 'Jane', email: 'jane@example.com' }
  ]
});
```

**Parameters:**
- `resource`: Table name
- `variables`: Array of record data

**Returns:**
```typescript
{
  data: T[]
}
```

#### update(params)

Updates an existing record.

```typescript
const result = await dataProvider.update({
  resource: 'users',
  id: '123',
  variables: {
    name: 'John Smith',
    status: 'inactive'
  }
});
```

**Parameters:**
- `resource`: Table name
- `id`: Record ID
- `variables`: Updated data

**Returns:**
```typescript
{
  data: T
}
```

#### updateMany(params)

Updates multiple records.

```typescript
const result = await dataProvider.updateMany({
  resource: 'users',
  ids: ['1', '2'],
  variables: {
    status: 'inactive'
  }
});
```

**Parameters:**
- `resource`: Table name
- `ids`: Array of record IDs
- `variables`: Updated data

**Returns:**
```typescript
{
  data: number[] // Updated IDs
}
```

#### deleteOne(params)

Deletes a single record.

```typescript
const result = await dataProvider.deleteOne({
  resource: 'users',
  id: '123'
});
```

**Parameters:**
- `resource`: Table name
- `id`: Record ID

**Returns:**
```typescript
{
  data: T
}
```

#### deleteMany(params)

Deletes multiple records.

```typescript
const result = await dataProvider.deleteMany({
  resource: 'users',
  ids: ['1', '2', '3']
});
```

**Parameters:**
- `resource`: Table name
- `ids`: Array of record IDs

**Returns:**
```typescript
{
  data: number[] // Deleted IDs
}
```

#### customFlexible(params)

Executes custom SQL queries with flexible parameter binding.

```typescript
// String-based query
const result = await dataProvider.customFlexible({
  query: 'SELECT * FROM users WHERE status = ? AND age > ?',
  params: ['active', 25],
  method: 'getList'
});

// Function-based query (ORM-style)
const result = await dataProvider.customFlexible({
  query: (sql, params) => ({
    sql: `SELECT u.*, p.name as profile_name 
          FROM users u 
          LEFT JOIN profiles p ON u.id = p.user_id 
          WHERE u.status = ${params.placeholder()} 
          AND u.created_at > ${params.placeholder()}`,
    params: ['active', '2023-01-01']
  }),
  method: 'getList'
});
```

**Parameters:**
- `query`: SQL string or function that returns SQL and parameters
- `params`: Parameters for string queries (optional for function queries)
- `method`: Expected return type ('getList' | 'getOne' | 'getMany')

**Returns:** Based on the specified method type

### Filter Operators

Refine-SQL supports comprehensive filtering with the following operators:

- `eq`: Equals
- `ne`: Not equals
- `lt`: Less than
- `lte`: Less than or equal
- `gt`: Greater than
- `gte`: Greater than or equal
- `in`: In array
- `nin`: Not in array
- `contains`: String contains (LIKE %value%)
- `ncontains`: String not contains
- `containss`: Case-sensitive contains
- `ncontainss`: Case-sensitive not contains
- `null`: Is null
- `nnull`: Is not null
- `between`: Between two values
- `nbetween`: Not between two values
- `startswith`: String starts with
- `nstartswith`: String not starts with
- `startswiths`: Case-sensitive starts with
- `nstartswiths`: Case-sensitive not starts with
- `endswith`: String ends with
- `nendswith`: String not ends with
- `endswiths`: Case-sensitive ends with
- `nendswiths`: Case-sensitive not ends with

### Sort Orders

- `asc`: Ascending order
- `desc`: Descending order

## Advanced Usage

### Custom Query Examples

#### Complex Joins

```typescript
const result = await dataProvider.customFlexible({
  query: (sql, params) => ({
    sql: `
      SELECT 
        u.id,
        u.name,
        u.email,
        p.bio,
        COUNT(po.id) as post_count
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN posts po ON u.id = po.author_id
      WHERE u.status = ${params.placeholder()}
      AND u.created_at > ${params.placeholder()}
      GROUP BY u.id, u.name, u.email, p.bio
      HAVING COUNT(po.id) > ${params.placeholder()}
      ORDER BY post_count DESC
    `,
    params: ['active', '2023-01-01', 5]
  }),
  method: 'getList'
});
```

#### Aggregation Queries

```typescript
const stats = await dataProvider.customFlexible({
  query: `
    SELECT 
      status,
      COUNT(*) as count,
      AVG(age) as avg_age,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM users 
    GROUP BY status
  `,
  method: 'getList'
});
```

#### Conditional Logic

```typescript
const result = await dataProvider.customFlexible({
  query: (sql, params) => ({
    sql: `
      SELECT *,
        CASE 
          WHEN age < 18 THEN 'minor'
          WHEN age < 65 THEN 'adult'
          ELSE 'senior'
        END as age_group
      FROM users
      WHERE status = ${params.placeholder()}
      AND (
        (age < ${params.placeholder()} AND verified = true) OR
        (age >= ${params.placeholder()} AND status = ${params.placeholder()})
      )
    `,
    params: ['active', 18, 18, 'premium']
  }),
  method: 'getList'
});
```

### Transaction Support

While transactions are handled differently across runtimes, you can use database-specific transaction methods:

#### D1 Transactions

```typescript
// D1 batch operations
const results = await env.DB.batch([
  env.DB.prepare('INSERT INTO users (name, email) VALUES (?, ?)').bind('John', 'john@example.com'),
  env.DB.prepare('INSERT INTO profiles (user_id, bio) VALUES (?, ?)').bind(1, 'Bio')
]);
```

#### SQLite Transactions

```typescript
// better-sqlite3 transactions
const insertUser = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
const insertProfile = db.prepare('INSERT INTO profiles (user_id, bio) VALUES (?, ?)');

const transaction = db.transaction((userData) => {
  const result = insertUser.run(userData.name, userData.email);
  insertProfile.run(result.lastInsertRowid, userData.bio);
  return result.lastInsertRowid;
});

const userId = transaction({ name: 'John', bio: 'Bio' });
```

### Error Handling

```typescript
try {
  const result = await dataProvider.getList({
    resource: 'users',
    pagination: { current: 1, pageSize: 10 }
  });
} catch (error) {
  if (error.message.includes('table does not exist')) {
    // Handle table not found
  } else if (error.message.includes('syntax error')) {
    // Handle SQL syntax error
  } else {
    // Handle other errors
  }
}
```

### Performance Optimization

#### Efficient Filtering

```typescript
// Use indexed columns for filtering
const result = await dataProvider.getList({
  resource: 'users',
  filters: [
    { field: 'user_id', operator: 'eq', value: userId }, // Indexed
    { field: 'status', operator: 'in', value: ['active', 'pending'] }
  ]
});
```

#### Optimized Pagination

```typescript
// Use cursor-based pagination for large datasets
const result = await dataProvider.customFlexible({
  query: (sql, params) => ({
    sql: `
      SELECT * FROM users 
      WHERE id > ${params.placeholder()}
      ORDER BY id 
      LIMIT ${params.placeholder()}
    `,
    params: [lastId, pageSize]
  }),
  method: 'getList'
});
```

## Best Practices

### 1. Use Prepared Statements

Always use parameter placeholders to prevent SQL injection:

```typescript
// ✅ Good
const result = await dataProvider.customFlexible({
  query: 'SELECT * FROM users WHERE email = ?',
  params: [userEmail],
  method: 'getOne'
});

// ❌ Bad
const result = await dataProvider.customFlexible({
  query: `SELECT * FROM users WHERE email = '${userEmail}'`,
  method: 'getOne'
});
```

### 2. Optimize Database Schema

Ensure proper indexing for frequently queried columns:

```sql
-- Create indexes for common query patterns
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_email ON users(email);
```

### 3. Handle Edge Cases

```typescript
// Handle empty results gracefully
const result = await dataProvider.getList({
  resource: 'users',
  filters: [{ field: 'status', operator: 'eq', value: 'active' }]
});

if (result.data.length === 0) {
  // Handle no results case
}
```

### 4. Use Appropriate Data Types

Ensure your database schema uses appropriate data types:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  age INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

## Runtime-Specific Considerations

### Cloudflare D1

- Supports SQL prepared statements
- Limited to 1000 parameters per query
- No support for user-defined functions
- Transactions via batch operations

### Node.js SQLite (better-sqlite3)

- Synchronous API with high performance
- Full transaction support
- User-defined functions supported
- Memory and file databases

### Bun SQLite

- Native SQLite integration
- Similar API to Node.js but with Bun optimizations
- Fast startup and execution
- Modern JavaScript features

## Migration Guide

### From Other Data Providers

If you're migrating from other Refine data providers:

1. Update your data provider initialization
2. Review custom query implementations
3. Test filtering and sorting behavior
4. Validate pagination results

### Database Schema Migration

Use appropriate migration tools for your runtime:

```typescript
// Example migration script
const migrations = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)',
  'CREATE INDEX idx_users_email ON users(email)',
  'ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
];

for (const migration of migrations) {
  await db.exec(migration);
}
```

## Troubleshooting

### Common Issues

1. **Parameter Placeholder Mismatch**: Ensure you're using the correct placeholder format for your runtime
2. **Table Not Found**: Verify table names and schema
3. **Type Mismatches**: Check TypeScript types match database schema
4. **Performance Issues**: Review indexing and query patterns

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const dataProvider = createDataProvider({
  database: db,
  type: 'sqlite',
  debug: true // Enable debug logging
});
```

## Examples

Check the `/examples` directory for complete working examples:

- `cloudflare-worker.ts`: Cloudflare Worker implementation
- `nodejs-app.js`: Node.js application
- `bun-app.ts`: Bun application
- `universal.js`: Universal/isomorphic usage

## Contributing

Contributions are welcome! Please read our contributing guide and submit pull requests for any improvements.

## License

MIT License - see LICENSE.md for details.
