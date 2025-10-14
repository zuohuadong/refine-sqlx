# Refine ORM API Reference

## Table of Contents

- [Core Functions](#core-functions)
- [Database Providers](#database-providers)
- [Chain Query API](#chain-query-api)
- [Polymorphic Relationships](#polymorphic-relationships)
- [Transaction Management](#transaction-management)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Utility Functions](#utility-functions)

## Core Functions

### createRefine

Creates a Refine ORM data provider from a database adapter.

```typescript
function createRefine<TSchema extends Record<string, Table>>(
  adapter: DatabaseAdapter<TSchema>,
  options?: RefineOrmOptions
): RefineOrmDataProvider<TSchema>;
```

**Parameters:**

- `adapter`: Database adapter instance (PostgreSQL, MySQL, or SQLite)
- `options`: Optional configuration object

**Returns:** RefineOrmDataProvider instance

**Example:**

```typescript
import { createPostgreSQLAdapter, createRefine } from '@refine-sqlx/orm';

const adapter = createPostgreSQLAdapter(connectionString, schema);
const dataProvider = createRefine(adapter, {
  debug: true,
  logger: (query, params) => console.log(query, params),
});
```

## Database Providers

### createPostgreSQLProvider

Creates a PostgreSQL data provider with automatic runtime detection.

```typescript
function createPostgreSQLProvider<TSchema extends Record<string, Table>>(
  connection: string | ConnectionConfig,
  schema: TSchema,
  options?: PostgreSQLOptions
): Promise<RefineOrmDataProvider<TSchema>>;
```

**Parameters:**

- `connection`: Connection string or configuration object
- `schema`: Drizzle schema definition
- `options`: Optional PostgreSQL-specific configuration

**Runtime Detection:**

- **Bun**: Uses `bun:sql` for native performance
- **Node.js**: Uses `postgres` driver

**Example:**

````typescript
// Connection string
const dataProvider = await createPostgreSQLProvider(
  'postgresql://user:pass@localhost:5432/mydb',
  schema
);

// Connection object
const dataProvider = await createPostgreSQLProvider(
  {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'mydb',
    ssl: true
  },
  schema,
  {
    pool: { max: 10, min: 2 },
    debug: true
  }
);
```### cr
eateMySQLProvider

Creates a MySQL data provider.

```typescript
function createMySQLProvider<TSchema extends Record<string, Table>>(
  connection: string | MySQLConnectionConfig,
  schema: TSchema,
  options?: MySQLOptions
): Promise<RefineOrmDataProvider<TSchema>>
````

**Parameters:**

- `connection`: MySQL connection string or configuration
- `schema`: Drizzle schema definition
- `options`: Optional MySQL-specific configuration

**Runtime Support:**

- **All environments**: Uses `mysql2` driver (bun:sql MySQL support pending)

**Example:**

```typescript
const dataProvider = await createMySQLProvider(
  'mysql://user:pass@localhost:3306/mydb',
  schema,
  { pool: { connectionLimit: 10, acquireTimeout: 60000, timeout: 60000 } }
);
```

### createSQLiteProvider

Creates a SQLite data provider with multi-runtime support.

```typescript
function createSQLiteProvider<TSchema extends Record<string, Table>>(
  database: string | Database,
  schema: TSchema,
  options?: SQLiteOptions
): Promise<RefineOrmDataProvider<TSchema>>;
```

**Parameters:**

- `database`: Database file path, `:memory:`, or database instance
- `schema`: Drizzle schema definition
- `options`: Optional SQLite-specific configuration

**Runtime Detection:**

- **Bun**: Uses `bun:sqlite` for native performance
- **Node.js**: Uses `better-sqlite3`
- **Cloudflare Workers**: Uses D1 Database

**Example:**

```typescript
// File database
const dataProvider = await createSQLiteProvider('./app.db', schema);

// In-memory database
const dataProvider = await createSQLiteProvider(':memory:', schema);

// Cloudflare D1
const dataProvider = await createSQLiteProvider(env.DB, schema);

// With options
const dataProvider = await createSQLiteProvider('./app.db', schema, {
  debug: true,
  options: { readonly: false, timeout: 5000 },
});
```

## Chain Query API

The chain query API provides a fluent interface for building complex queries.

### Basic Chain Query

```typescript
const users = await dataProvider
  .from('users')
  .where('age', 'gte', 18)
  .where('status', 'eq', 'active')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();
```

### ChainQuery Methods

#### where

Add WHERE conditions to the query.

```typescript
where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
  column: TColumn,
  operator: FilterOperator,
  value: any
): this
```

**Supported Operators:**

- `eq`, `ne` - Equal, Not equal
- `gt`, `gte`, `lt`, `lte` - Comparison operators
- `in`, `notIn` - Array membership
- `like`, `ilike`, `notLike` - Pattern matching
- `isNull`, `isNotNull` - Null checks
- `between`, `notBetween` - Range checks

**Example:**

```typescript
const query = dataProvider
  .from('users')
  .where('age', 'between', [18, 65])
  .where('email', 'like', '%@example.com')
  .where('status', 'in', ['active', 'pending']);
```

#### orderBy

Add ORDER BY clauses.

```typescript
orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
  column: TColumn,
  direction?: 'asc' | 'desc'
): this
```

**Example:**

```typescript
const query = dataProvider
  .from('posts')
  .orderBy('createdAt', 'desc')
  .orderBy('title', 'asc');
```

#### limit / offset

Set LIMIT and OFFSET for pagination.

```typescript
limit(count: number): this
offset(count: number): this
```

#### paginate

Convenient pagination method.

```typescript
paginate(page: number, pageSize?: number): this
```

**Example:**

```typescript
const users = await dataProvider
  .from('users')
  .where('active', 'eq', true)
  .paginate(2, 20) // Page 2, 20 items per page
  .get();
```

### Execution Methods

#### get

Execute query and return all results.

```typescript
async get(): Promise<InferSelectModel<TSchema[TTable]>[]>
```

#### first

Execute query and return first result.

```typescript
async first(): Promise<InferSelectModel<TSchema[TTable]> | null>
```

#### count

Get count of matching records.

```typescript
async count(): Promise<number>
```

#### Aggregation Methods

```typescript
async sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
  column: TColumn
): Promise<number>

async avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
  column: TColumn
): Promise<number>
```

**Example:**

````typescript
const totalAge = await dataProvider
  .from('users')
  .where('active', 'eq', true)
  .sum('age');

const averageAge = await dataProvider
  .from('users')
  .where('active', 'eq', true)
  .avg('age');
```##
 Polymorphic Relationships

Polymorphic relationships allow a model to belong to more than one other model on a single association.

### morphTo

Create a polymorphic query.

```typescript
morphTo<TTable extends keyof TSchema>(
  resource: TTable,
  morphConfig: MorphConfig<TSchema>
): MorphQuery<TSchema, TTable>
````

**MorphConfig Interface:**

```typescript
interface MorphConfig<TSchema extends Record<string, Table>> {
  typeField: string; // Field storing the related model type
  idField: string; // Field storing the related model ID
  relationName: string; // Name for the loaded relation
  types: Record<string, keyof TSchema>; // Mapping of type names to tables
}
```

**Example:**

```typescript
// Schema with polymorphic comments
const comments = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  commentableType: text('commentable_type').notNull(), // 'post' or 'user'
  commentableId: integer('commentable_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// Query polymorphic relationships
const commentsWithRelations = await dataProvider
  .morphTo('comments', {
    typeField: 'commentableType',
    idField: 'commentableId',
    relationName: 'commentable',
    types: { post: 'posts', user: 'users' },
  })
  .where('approved', 'eq', true)
  .get();

// Result includes the related model
console.log(commentsWithRelations[0].commentable); // Post or User object
```

### MorphQuery Methods

MorphQuery extends ChainQuery with additional polymorphic-specific methods:

```typescript
interface MorphQuery<TSchema, TTable> extends ChainQuery<TSchema, TTable> {
  withMorphRelations(): this;
  morphWhere(type: string, callback: (query: ChainQuery) => ChainQuery): this;
}
```

**Example:**

```typescript
const comments = await dataProvider
  .morphTo('comments', morphConfig)
  .withMorphRelations()
  .morphWhere('post', query => query.where('published', 'eq', true))
  .morphWhere('user', query => query.where('active', 'eq', true))
  .get();
```

## Transaction Management

### transaction

Execute multiple operations within a transaction.

```typescript
async transaction<T>(
  fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
): Promise<T>
```

**Example:**

```typescript
const result = await dataProvider.transaction(async tx => {
  // Create user
  const user = await tx.create({
    resource: 'users',
    variables: { name: 'John', email: 'john@example.com' },
  });

  // Create posts for the user
  const posts = await tx.createMany({
    resource: 'posts',
    variables: [
      { title: 'Post 1', userId: user.data.id },
      { title: 'Post 2', userId: user.data.id },
    ],
  });

  return { user, posts };
});
```

### TransactionManager

For more complex transaction management:

```typescript
import { TransactionManager } from '@refine-sqlx/orm';

const transactionManager = new TransactionManager(dataProvider);

await transactionManager.execute(async tx => {
  // Transaction operations
  await tx.create({ resource: 'users', variables: userData });
  await tx.update({ resource: 'posts', id: 1, variables: postData });
});
```

## Type Definitions

### Core Types

```typescript
// Main data provider interface
interface RefineOrmDataProvider<TSchema extends Record<string, Table>> {
  // Standard Refine methods
  getList<TTable extends keyof TSchema>(
    params: GetListParams
  ): Promise<GetListResponse>;
  getOne<TTable extends keyof TSchema>(
    params: GetOneParams
  ): Promise<GetOneResponse>;
  create<TTable extends keyof TSchema>(
    params: CreateParams
  ): Promise<CreateResponse>;
  update<TTable extends keyof TSchema>(
    params: UpdateParams
  ): Promise<UpdateResponse>;
  deleteOne<TTable extends keyof TSchema>(
    params: DeleteOneParams
  ): Promise<DeleteOneResponse>;

  // Batch operations
  createMany<TTable extends keyof TSchema>(
    params: CreateManyParams
  ): Promise<CreateManyResponse>;
  updateMany<TTable extends keyof TSchema>(
    params: UpdateManyParams
  ): Promise<UpdateManyResponse>;
  deleteMany<TTable extends keyof TSchema>(
    params: DeleteManyParams
  ): Promise<DeleteManyResponse>;

  // Enhanced methods
  from<TTable extends keyof TSchema>(
    resource: TTable
  ): ChainQuery<TSchema, TTable>;
  morphTo<TTable extends keyof TSchema>(
    resource: TTable,
    config: MorphConfig
  ): MorphQuery<TSchema, TTable>;
  transaction<T>(
    fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
  ): Promise<T>;
}

// Configuration types
interface RefineOrmOptions {
  debug?: boolean;
  logger?: boolean | ((query: string, params: any[]) => void);
}

interface PostgreSQLOptions extends RefineOrmOptions {
  pool?: { min?: number; max?: number; acquireTimeoutMillis?: number };
}

interface MySQLOptions extends RefineOrmOptions {
  pool?: {
    connectionLimit?: number;
    acquireTimeout?: number;
    timeout?: number;
  };
}

interface SQLiteOptions extends RefineOrmOptions {
  options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number };
}
```

### Filter and Sort Types

````typescript
type FilterOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'notIn' | 'like' | 'ilike' | 'notLike'
  | 'isNull' | 'isNotNull' | 'between' | 'notBetween';

interface ChainQuery<TSchema, TTable> {
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;

  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction?: 'asc' | 'desc'
  ): this;

  // ... other methods
}
```## Err
or Handling

### Error Types

```typescript
// Base error class
abstract class RefineOrmError extends Error {
  abstract code: string;
  abstract statusCode: number;

  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Connection errors
class ConnectionError extends RefineOrmError {
  code = 'CONNECTION_ERROR';
  statusCode = 500;
}

// Query execution errors
class QueryError extends RefineOrmError {
  code = 'QUERY_ERROR';
  statusCode = 400;
}

// Data validation errors
class ValidationError extends RefineOrmError {
  code = 'VALIDATION_ERROR';
  statusCode = 422;
}

// Transaction errors
class TransactionError extends RefineOrmError {
  code = 'TRANSACTION_ERROR';
  statusCode = 500;
}
````

### Error Handling Example

```typescript
import {
  ConnectionError,
  QueryError,
  ValidationError,
  TransactionError,
} from '@refine-sqlx/orm';

try {
  const result = await dataProvider.getList({ resource: 'users' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Database connection failed:', error.message);
    // Handle connection issues
  } else if (error instanceof QueryError) {
    console.error('Query execution failed:', error.message);
    // Handle query issues
  } else if (error instanceof ValidationError) {
    console.error('Data validation failed:', error.message);
    // Handle validation issues
  } else if (error instanceof TransactionError) {
    console.error('Transaction failed:', error.message);
    // Handle transaction issues
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Utility Functions

### Connection Testing

```typescript
// Test database connection
async function testConnection(
  connectionString: string,
  dbType: 'postgresql' | 'mysql' | 'sqlite'
): Promise<boolean>;
```

**Example:**

```typescript
import { testConnection } from '@refine-sqlx/orm';

const isConnected = await testConnection(
  'postgresql://user:pass@localhost:5432/mydb',
  'postgresql'
);

if (isConnected) {
  console.log('Database connection successful');
} else {
  console.log('Database connection failed');
}
```

### Schema Validation

```typescript
// Validate Drizzle schema
function validateSchema<TSchema extends Record<string, Table>>(
  schema: TSchema
): ValidationResult;
```

**Example:**

```typescript
import { validateSchema } from '@refine-sqlx/orm';

const validation = validateSchema(schema);

if (validation.isValid) {
  console.log('Schema is valid');
} else {
  console.log('Schema validation errors:', validation.errors);
}
```

### Runtime Information

```typescript
// Get runtime and driver information
function getRuntimeInfo(): RuntimeInfo;

interface RuntimeInfo {
  runtime: 'bun' | 'node' | 'cloudflare' | 'unknown';
  version: string;
  supportedDrivers: { postgresql: string[]; mysql: string[]; sqlite: string[] };
}
```

**Example:**

```typescript
import { getRuntimeInfo } from '@refine-sqlx/orm';

const info = getRuntimeInfo();
console.log('Runtime:', info.runtime);
console.log('Supported PostgreSQL drivers:', info.supportedDrivers.postgresql);
```

### Performance Utilities

```typescript
// Query performance monitoring
interface QueryMetrics {
  query: string;
  params: any[];
  duration: number;
  timestamp: Date;
}

// Enable query metrics collection
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  debug: true,
  logger: (query, params, metrics) => {
    console.log(`Query took ${metrics.duration}ms:`, query);
  },
});
```

### Migration Helpers

```typescript
// Helper for migrating from other data providers
interface MigrationHelper {
  convertFilters(filters: any[]): CrudFilters;
  convertSorters(sorters: any[]): CrudSorting;
  validateMigration(
    oldProvider: any,
    newProvider: RefineOrmDataProvider
  ): Promise<boolean>;
}

// Usage
import { createMigrationHelper } from '@refine-sqlx/orm';

const migrationHelper = createMigrationHelper();
const convertedFilters = migrationHelper.convertFilters(oldFilters);
```

## Advanced Usage Examples

### Custom Query Builder

```typescript
// Access the underlying Drizzle client for custom queries
const client = dataProvider.getClient();

// Raw Drizzle query
const customQuery = await client
  .select({
    id: users.id,
    name: users.name,
    postCount: sql<number>`count(${posts.id})`.as('post_count'),
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId))
  .groupBy(users.id)
  .having(gt(sql`count(${posts.id})`, 5));
```

### Batch Operations

```typescript
// Efficient batch processing
const batchSize = 1000;
const totalUsers = await dataProvider.from('users').count();

for (let offset = 0; offset < totalUsers; offset += batchSize) {
  const batch = await dataProvider
    .from('users')
    .limit(batchSize)
    .offset(offset)
    .get();

  // Process batch
  await processBatch(batch);
}
```

### Connection Pooling Configuration

```typescript
// Advanced connection pool configuration
const dataProvider = await createPostgreSQLProvider(connectionString, schema, {
  pool: {
    min: 2, // Minimum connections
    max: 20, // Maximum connections
    acquireTimeoutMillis: 30000, // Connection acquire timeout
    createTimeoutMillis: 30000, // Connection creation timeout
    destroyTimeoutMillis: 5000, // Connection destruction timeout
    idleTimeoutMillis: 600000, // Idle connection timeout
    reapIntervalMillis: 1000, // Cleanup interval
    createRetryIntervalMillis: 200, // Retry interval for failed connections
  },
});
```

This completes the comprehensive API reference for Refine ORM. The documentation covers all major features, types, and usage patterns with practical examples.
