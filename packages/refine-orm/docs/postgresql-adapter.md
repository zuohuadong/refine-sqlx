# PostgreSQL Adapter

The PostgreSQL adapter provides multi-runtime support for PostgreSQL databases, automatically detecting whether you're running in Bun or Node.js and using the appropriate driver.

## Features

- **Runtime Detection**: Automatically uses `bun:sql` in Bun environments and `postgres` in Node.js
- **Connection Pooling**: Built-in connection pool management
- **Type Safety**: Full TypeScript support with Drizzle ORM schema inference
- **SSL Support**: Configurable SSL connections
- **Error Handling**: Comprehensive error handling with detailed error messages

## Installation

```bash
# Install the core package
npm install refine-orm drizzle-orm

# Install PostgreSQL driver (choose based on your runtime)
npm install postgres          # For Node.js
# Bun users: bun:sql is built-in, no additional installation needed
```

## Basic Usage

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { createPostgreSQLProvider, createRefine } from 'refine-orm';

// Define your schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

// Create adapter (automatically detects runtime)
const adapter = createPostgreSQLProvider(
  process.env.DATABASE_URL!, // Connection string
  schema,
  { debug: true, pool: { max: 10, min: 2 } }
);

// Connect to database
await adapter.connect();

// Create Refine data provider
const dataProvider = createRefine(adapter);

// Use with Refine
export default function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[{ name: 'users', list: '/users' }]}
    />
  );
}
```

## Configuration Options

### Connection String

```typescript
const adapter = createPostgreSQLProvider(
  'postgresql://user:password@localhost:5432/database',
  schema
);
```

### Connection Object

```typescript
const adapter = createPostgreSQLProvider(
  {
    host: 'localhost',
    port: 5432,
    user: 'myuser',
    password: 'mypassword',
    database: 'mydatabase',
    ssl: true,
  },
  schema
);
```

### Advanced Options

```typescript
const adapter = createPostgreSQLProvider(connectionString, schema, {
  // Enable debug logging
  debug: true,

  // Custom logger function
  logger: (query, params) => {
    console.log('Query:', query, 'Params:', params);
  },

  // Connection pool configuration
  pool: {
    max: 20, // Maximum connections
    min: 5, // Minimum connections
    acquireTimeoutMillis: 30000, // Connection timeout
    idleTimeoutMillis: 20000, // Idle timeout
  },

  // SSL configuration
  ssl: {
    rejectUnauthorized: false,
    ca: fs.readFileSync('ca-cert.pem'),
    cert: fs.readFileSync('client-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
  },
});
```

## Runtime-Specific Usage

### Force Bun SQL Driver

```typescript
import { createPostgreSQLProviderWithBunSql } from 'refine-orm';

const adapter = createPostgreSQLProviderWithBunSql(
  connectionString,
  schema,
  options
);
```

### Force postgres-js Driver

```typescript
import { createPostgreSQLProviderWithPostgresJs } from 'refine-orm';

const adapter = createPostgreSQLProviderWithPostgresJs(
  connectionString,
  schema,
  options
);
```

## Error Handling

The adapter provides detailed error information:

```typescript
try {
  await adapter.connect();
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
    console.error('Cause:', error.cause);
  }
}
```

## Health Checks

```typescript
// Check if connection is active
const isActive = adapter.isConnectionActive();

// Perform health check (executes test query)
const isHealthy = await adapter.healthCheck();

// Get adapter information
const info = adapter.getAdapterInfo();
console.log('Runtime:', info.runtime);
console.log('Driver:', info.driver);
console.log('Connected:', info.isConnected);
```

## Best Practices

1. **Environment Variables**: Store connection strings in environment variables
2. **Connection Pooling**: Configure appropriate pool sizes for your workload
3. **SSL in Production**: Always use SSL connections in production
4. **Error Handling**: Implement proper error handling for connection failures
5. **Health Checks**: Use health checks for monitoring and load balancing

## Troubleshooting

### Common Issues

1. **Driver Not Found**: Make sure you have the appropriate driver installed
   - Node.js: `npm install postgres`
   - Bun: Built-in `bun:sql` should be available

2. **Connection Timeout**: Increase `acquireTimeoutMillis` in pool configuration

3. **SSL Errors**: Check SSL configuration and certificate paths

4. **Schema Errors**: Ensure your Drizzle schema matches your database structure

### Debug Mode

Enable debug mode to see detailed query information:

```typescript
const adapter = createPostgreSQLProvider(connectionString, schema, {
  debug: true,
  logger: true,
});
```
