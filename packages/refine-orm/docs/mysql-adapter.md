# MySQL Adapter

The MySQL adapter provides comprehensive MySQL database support for refine-orm using drizzle-orm as the underlying ORM. It supports both Bun and Node.js runtime environments with automatic driver selection.

## Features

- ✅ **Multi-runtime support**: Works in both Bun and Node.js environments
- ✅ **mysql2 driver**: Uses mysql2 for all environments (most stable and feature-complete)
- ✅ **Connection pooling**: Built-in connection pool support for production environments
- ✅ **SSL support**: Full SSL/TLS configuration support
- ✅ **Type safety**: Complete TypeScript type inference with drizzle-orm
- ✅ **bun:sql support**: Uses Bun's native SQL driver for MySQL since Bun 1.2.21
- ✅ **Error handling**: Comprehensive error handling and logging
- ✅ **Transaction support**: Full transaction management capabilities

## Installation

```bash
# Install the core package
npm install refine-orm drizzle-orm

# Install MySQL driver
npm install mysql2

# Install drizzle MySQL adapter
npm install drizzle-orm/mysql2

# Optional: Install types for development
npm install -D @types/mysql2
```

## Basic Usage

### 1. Define Your Schema

```typescript
import { mysqlTable, serial, varchar, timestamp } from 'drizzle-orm/mysql-core';

const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

const posts = mysqlTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: varchar('content', { length: 1000 }),
  userId: serial('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users, posts };
```

### 2. Create MySQL Provider

#### With Connection Object

```typescript
import { createMySQLProvider, createRefine } from 'refine-orm';

const adapter = createMySQLProvider(
  {
    host: 'localhost',
    port: 3306,
    user: 'myuser',
    password: 'mypassword',
    database: 'mydatabase',
  },
  schema,
  { debug: true, pool: { min: 2, max: 10, acquireTimeoutMillis: 30000 } }
);

// Connect to database
await adapter.connect();

// Create data provider for Refine
const dataProvider = createRefine(adapter);
```

#### With Connection String

```typescript
const adapter = createMySQLProvider(
  'mysql://myuser:mypassword@localhost:3306/mydatabase',
  schema,
  {
    debug: false,
    logger: (query, params) => {
      console.log('Query:', query);
      console.log('Params:', params);
    },
  }
);
```

### 3. Use with Refine

```typescript
import { Refine } from '@refinedev/core';

function App() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[
        {
          name: 'users',
          list: '/users',
          create: '/users/create',
          edit: '/users/edit/:id',
        },
        {
          name: 'posts',
          list: '/posts',
          create: '/posts/create',
          edit: '/posts/edit/:id',
        },
      ]}
    />
  );
}
```

## Configuration Options

### Connection Configuration

```typescript
interface ConnectionOptions {
  host?: string; // Default: 'localhost'
  port?: number; // Default: 3306
  user?: string; // Required
  password?: string; // Required
  database?: string; // Required
  ssl?: boolean | SSLConfig;
  connectionString?: string; // Alternative to individual options
}
```

### MySQL-Specific Options

```typescript
interface MySQLOptions {
  // Connection pool settings
  pool?: {
    min?: number; // Minimum connections
    max?: number; // Maximum connections
    acquireTimeoutMillis?: number; // Connection acquire timeout
    idleTimeoutMillis?: number; // Idle connection timeout
  };

  // SSL configuration
  ssl?:
    | boolean
    | {
        rejectUnauthorized?: boolean;
        ca?: string; // Certificate Authority
        cert?: string; // Client certificate
        key?: string; // Client key
      };

  // MySQL-specific settings
  timezone?: string; // Default: 'local'
  charset?: string; // Default: 'utf8mb4'

  // Logging and debugging
  debug?: boolean; // Enable debug logging
  logger?: boolean | ((query: string, params: any[]) => void);
}
```

## Advanced Usage

### Connection Pooling

```typescript
import { createMySQLProviderWithPool } from 'refine-orm';

const adapter = createMySQLProviderWithPool(
  'mysql://user:pass@localhost:3306/db',
  schema,
  { min: 5, max: 20, acquireTimeoutMillis: 60000, idleTimeoutMillis: 300000 },
  { debug: true, timezone: 'UTC' }
);
```

### SSL Configuration

```typescript
const adapter = createMySQLProvider(
  {
    host: 'secure-mysql-server.com',
    port: 3306,
    user: 'myuser',
    password: 'mypassword',
    database: 'mydatabase',
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync('ca-cert.pem'),
      cert: fs.readFileSync('client-cert.pem'),
      key: fs.readFileSync('client-key.pem'),
    },
  },
  schema
);
```

### Transaction Management

```typescript
// Using the adapter directly
await adapter.beginTransaction();
try {
  await adapter.executeRaw('INSERT INTO users (name, email) VALUES (?, ?)', [
    'John',
    'john@example.com',
  ]);
  await adapter.executeRaw('INSERT INTO posts (title, user_id) VALUES (?, ?)', [
    'Hello World',
    1,
  ]);
  await adapter.commitTransaction();
} catch (error) {
  await adapter.rollbackTransaction();
  throw error;
}

// Using the data provider (future implementation)
await dataProvider.transaction(async tx => {
  const user = await tx.create('users', {
    name: 'John',
    email: 'john@example.com',
  });
  await tx.create('posts', { title: 'Hello World', userId: user.data.id });
});
```

### Raw Query Execution

```typescript
// Execute raw SQL queries
const results = await adapter.executeRaw<{ id: number; name: string }>(
  'SELECT id, name FROM users WHERE created_at > ?',
  [new Date('2024-01-01')]
);

console.log('Users:', results);
```

## Runtime Detection

The MySQL adapter automatically detects the runtime environment and chooses the appropriate driver:

```typescript
const adapter = createMySQLProvider(connectionString, schema);
const info = adapter.getAdapterInfo();

console.log('Runtime:', info.runtime); // 'bun' or 'node'
console.log('Driver:', info.driver); // 'mysql2'
console.log('Native support:', info.supportsNativeDriver); // false (mysql2 used)
console.log('Future bun:sql:', info.futureSupport.bunSql); // true (available since Bun 1.2.21)
```

### Current Driver Strategy

| Runtime | Driver | Reason                            |
| ------- | ------ | --------------------------------- |
| Bun 1.2.21+ | bun:sql | Native MySQL support available  |
| Bun < 1.2.21 | mysql2 | Fallback for older Bun versions |
| Node.js | mysql2 | Standard, stable MySQL driver     |

### bun:sql MySQL Support

Since Bun 1.2.21, MySQL support is available through bun:sql. The adapter automatically detects and uses it:

```typescript
// Works with Bun 1.2.21+ - automatically uses bun:sql
import { createMySQLProviderWithBunSql } from 'refine-orm';

const adapter = createMySQLProviderWithBunSql(
  'mysql://user:pass@localhost:3306/db',
  schema
);
```

## Error Handling

The MySQL adapter provides comprehensive error handling:

```typescript
import { ConnectionError, QueryError, ConfigurationError } from 'refine-orm';

try {
  await adapter.connect();
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Failed to connect to MySQL:', error.message);
  } else if (error instanceof ConfigurationError) {
    console.error('Invalid configuration:', error.message);
  }
}
```

## Testing Connection

```typescript
import { testMySQLConnection } from 'refine-orm';

const result = await testMySQLConnection({
  host: 'localhost',
  user: 'test',
  password: 'test',
  database: 'test_db',
});

if (result.success) {
  console.log('Connection successful!');
  console.log('MySQL version:', result.info?.version);
  console.log('Driver:', result.info?.driver);
} else {
  console.error('Connection failed:', result.error);
}
```

## Performance Optimization

### Connection Pool Tuning

```typescript
const adapter = createMySQLProvider(connectionString, schema, {
  pool: {
    min: 10, // Keep minimum connections open
    max: 50, // Maximum concurrent connections
    acquireTimeoutMillis: 30000, // Wait up to 30s for connection
    idleTimeoutMillis: 600000, // Close idle connections after 10min
  },
});
```

### Query Optimization

```typescript
// Enable query logging for optimization
const adapter = createMySQLProvider(connectionString, schema, {
  debug: true,
  logger: (query, params) => {
    const duration = Date.now();
    console.log(`[${duration}ms] ${query}`, params);
  },
});
```

## Migration from Other Providers

### From mysql2 directly

```typescript
// Before (using mysql2 directly)
import mysql from 'mysql2/promise';
const connection = await mysql.createConnection(config);

// After (using refine-orm)
import { createMySQLProvider } from 'refine-orm';
const adapter = createMySQLProvider(config, schema);
await adapter.connect();
```

### From other ORMs

The MySQL adapter is designed to be a drop-in replacement for other MySQL data providers in Refine applications. Simply replace your existing data provider with the refine-orm MySQL provider.

## Troubleshooting

### Common Issues

1. **Connection timeout**: Increase `acquireTimeoutMillis` in pool configuration
2. **SSL errors**: Verify SSL certificate paths and configuration
3. **Character encoding**: Set appropriate `charset` option
4. **Timezone issues**: Configure `timezone` option explicitly

### Debug Mode

Enable debug mode to see detailed connection and query information:

```typescript
const adapter = createMySQLProvider(connectionString, schema, {
  debug: true,
  logger: true,
});
```

## API Reference

### MySQLAdapter Class

#### Methods

- `connect(): Promise<void>` - Establish database connection
- `disconnect(): Promise<void>` - Close database connection
- `healthCheck(): Promise<boolean>` - Check connection health
- `executeRaw<T>(sql: string, params?: any[]): Promise<T[]>` - Execute raw SQL
- `beginTransaction(): Promise<void>` - Begin transaction
- `commitTransaction(): Promise<void>` - Commit transaction
- `rollbackTransaction(): Promise<void>` - Rollback transaction
- `getAdapterInfo()` - Get adapter information
- `isConnectionActive(): boolean` - Check if connected

### Factory Functions

- `createMySQLProvider(connection, schema, options?)` - Create MySQL provider
- `createMySQLProviderWithMySQL2(connection, schema, options?)` - Explicit mysql2 driver
- `createMySQLProviderWithPool(connection, schema, poolOptions?, options?)` - With pool config
- `createMySQLProviderWithBunSql(connection, schema, options?)` - Bun 1.2.21+ MySQL support
- `testMySQLConnection(connection, options?)` - Test connection utility

## Examples

See the [examples directory](../examples/mysql-example.ts) for complete working examples.
