# User-Friendly API Guide

RefineORM provides several factory functions designed to make it as easy as possible to create data providers for your Refine applications. These functions handle runtime detection, driver selection, and provide sensible defaults while still allowing for customization when needed.

## Quick Start

### Universal Factory Function

The simplest way to create a data provider is using the universal `createRefine` function:

```typescript
import { createRefine } from 'refine-sqlx';
import { schema } from './schema'; // Your Drizzle schema

// PostgreSQL
const provider = createRefine({
  database: 'postgresql',
  connection: process.env.DATABASE_URL!,
  schema,
});

// MySQL
const provider = createRefine({
  database: 'mysql',
  connection: 'mysql://user:pass@localhost:3306/mydb',
  schema,
});

// SQLite
const provider = createRefine({
  database: 'sqlite',
  connection: './database.db',
  schema,
});
```

### Auto-Detection Factory

For even simpler usage, use `createDataProvider` which auto-detects the database type from your connection string:

```typescript
import { createDataProvider } from 'refine-sqlx';

// Auto-detects PostgreSQL
const pgProvider = createDataProvider({
  connection: 'postgresql://user:pass@localhost:5432/mydb',
  schema,
});

// Auto-detects MySQL
const mysqlProvider = createDataProvider({
  connection: 'mysql://user:pass@localhost:3306/mydb',
  schema,
});

// Auto-detects SQLite
const sqliteProvider = createDataProvider({
  connection: './database.db',
  schema,
});
```

## Database-Specific Factory Functions

For more control, use database-specific factory functions:

### PostgreSQL

```typescript
import { createPostgreSQLProvider } from 'refine-sqlx';

// Simple connection string
const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
});

// Detailed configuration
const provider = createPostgreSQLProvider({
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
    ssl: true,
  },
  schema,
  options: { pool: { min: 2, max: 10 }, debug: true },
});
```

**Runtime Detection**: Automatically uses `bun:sql` in Bun environments and `postgres-js` in Node.js environments.

### MySQL

```typescript
import { createMySQLProvider } from 'refine-sqlx';

// Simple connection string
const provider = createMySQLProvider({
  connection: 'mysql://root:password@localhost:3306/mydb',
  schema,
});

// Detailed configuration
const provider = createMySQLProvider({
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
  },
  schema,
  options: { pool: { min: 5, max: 20 }, timezone: 'Z', charset: 'utf8mb4' },
});
```

**Runtime Detection**: Currently uses `mysql2` for all environments. Will automatically switch to `bun:sql` when MySQL support is added.

### SQLite

```typescript
import { createSQLiteProvider } from 'refine-sqlx';

// File-based SQLite
const provider = createSQLiteProvider({ connection: './database.db', schema });

// In-memory SQLite
const provider = createSQLiteProvider({ connection: ':memory:', schema });

// Cloudflare D1
const provider = createSQLiteProvider({
  connection: { d1Database: env.DB },
  schema,
});

// Detailed configuration
const provider = createSQLiteProvider({
  connection: { filename: './app.db', readonly: false, fileMustExist: false },
  schema,
  options: {
    debug: true,
    logger: (query, params) => console.log('Query:', query, params),
  },
});
```

**Runtime Detection**: Automatically uses `bun:sqlite` in Bun, `better-sqlite3` in Node.js, and `d1` in Cloudflare Workers.

## Configuration Options

### Common Options

All factory functions accept these common options:

```typescript
interface RefineOrmOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Custom logger function or enable default logging */
  logger?: boolean | ((query: string, params: any[]) => void);

  /** Connection pool configuration */
  pool?: {
    min?: number;
    max?: number;
    acquireTimeoutMillis?: number;
    // ... other pool options
  };
}
```

### Database-Specific Options

#### PostgreSQL Options

```typescript
interface PostgreSQLOptions extends RefineOrmOptions {
  /** SSL configuration */
  ssl?:
    | boolean
    | {
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        key?: string;
      };

  /** PostgreSQL search path */
  searchPath?: string[];
}
```

#### MySQL Options

```typescript
interface MySQLOptions extends RefineOrmOptions {
  /** SSL configuration */
  ssl?: boolean | SSLConfig;

  /** Timezone setting */
  timezone?: string;

  /** Character set */
  charset?: string;
}
```

#### SQLite Options

```typescript
interface SQLiteOptions extends RefineOrmOptions {
  /** Open database in read-only mode */
  readonly?: boolean;

  /** Require database file to exist */
  fileMustExist?: boolean;

  /** Query timeout in milliseconds */
  timeout?: number;

  /** Enable verbose logging */
  verbose?: boolean;
}
```

## Runtime Detection and Diagnostics

### Check Runtime Support

```typescript
import { getRuntimeDiagnostics, checkDatabaseSupport } from 'refine-sqlx';

// Get comprehensive runtime information
const diagnostics = getRuntimeDiagnostics();
console.log(diagnostics);
// Output:
// {
//   runtime: 'bun',
//   version: '1.0.0',
//   recommendedDrivers: {
//     postgresql: 'bun:sql',
//     mysql: 'mysql2',
//     sqlite: 'bun:sqlite'
//   },
//   features: {
//     bunSqlPostgreSQL: true,
//     bunSqlMySQL: false,
//     bunSqlite: true,
//     cloudflareD1: false
//   },
//   environment: {
//     isBun: true,
//     isNode: false,
//     isCloudflareD1: false
//   }
// }

// Check if a database is supported
const isPostgreSQLSupported = checkDatabaseSupport('postgresql');
const isBunSqlSupported = checkDatabaseSupport('postgresql', 'bun:sql');
```

### Environment-Based Configuration

```typescript
function createProviderForEnvironment() {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    return createPostgreSQLProvider({
      connection: process.env.DATABASE_URL!,
      schema,
      options: { pool: { min: 5, max: 20 }, debug: false },
    });
  } else if (env === 'test') {
    return createSQLiteProvider({
      connection: ':memory:',
      schema,
      options: { debug: false },
    });
  } else {
    return createSQLiteProvider({
      connection: './dev.db',
      schema,
      options: { debug: true, logger: true },
    });
  }
}
```

## Error Handling and Fallbacks

```typescript
function createProviderWithFallback() {
  try {
    // Try PostgreSQL first
    if (process.env.DATABASE_URL) {
      return createPostgreSQLProvider({
        connection: process.env.DATABASE_URL,
        schema,
      });
    }
  } catch (error) {
    console.warn('PostgreSQL failed, trying MySQL:', error);
  }

  try {
    // Fallback to MySQL
    if (process.env.MYSQL_URL) {
      return createMySQLProvider({ connection: process.env.MYSQL_URL, schema });
    }
  } catch (error) {
    console.warn('MySQL failed, using SQLite:', error);
  }

  // Final fallback to SQLite
  return createSQLiteProvider({ connection: './fallback.db', schema });
}
```

## Integration with Refine

```typescript
import { Refine } from '@refinedev/core';
import { createPostgreSQLProvider } from 'refine-sqlx';
import { schema } from './schema';

const dataProvider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
  options: {
    debug: process.env.NODE_ENV === 'development',
    pool: { min: 2, max: process.env.NODE_ENV === 'production' ? 20 : 10 },
  },
});

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
      ]}
    />
  );
}
```

## Best Practices

### 1. Use Environment Variables

```typescript
// Good: Use environment variables for sensitive data
const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
});

// Avoid: Hardcoding credentials
const provider = createPostgreSQLProvider({
  connection: 'postgresql://user:password@localhost:5432/db',
  schema,
});
```

### 2. Configure Connection Pools for Production

```typescript
const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
  options: { pool: { min: 5, max: 20, acquireTimeoutMillis: 30000 } },
});
```

### 3. Enable Debug Mode in Development

```typescript
const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
  options: {
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  },
});
```

### 4. Use Auto-Detection for Prototyping

```typescript
// Perfect for quick prototypes and demos
const provider = createDataProvider({
  connection: process.env.DATABASE_URL!,
  schema,
});
```

### 5. Handle Runtime Differences

```typescript
import { getRuntimeInfo } from 'refine-sqlx';

const runtime = getRuntimeInfo();
const poolSize = runtime.runtime === 'bun' ? 15 : 10;

const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
  options: { pool: { min: 2, max: poolSize } },
});
```

## Migration from Advanced APIs

If you're currently using the advanced adapter APIs, migration is straightforward:

```typescript
// Before (advanced API)
import { PostgreSQLAdapter, createRefine } from 'refine-sqlx';

const adapter = new PostgreSQLAdapter({
  type: 'postgresql',
  connection: process.env.DATABASE_URL!,
  schema,
});
const provider = createRefine(adapter);

// After (user-friendly API)
import { createPostgreSQLProvider } from 'refine-sqlx';

const provider = createPostgreSQLProvider({
  connection: process.env.DATABASE_URL!,
  schema,
});
```

The user-friendly API provides the same functionality with less boilerplate and better defaults.
