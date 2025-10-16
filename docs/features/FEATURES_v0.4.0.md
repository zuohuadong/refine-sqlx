# Refine SQLx v0.4.0 - Feature Roadmap

**Status**: Planned
**Target Release**: Q1 2025
**Refine Version**: 5.0+

## Overview

Version 0.4.0 focuses on core missing features (P0) and essential enhancements (P1) to make refine-sqlx a complete and production-ready data provider for Refine 5.0.

---

## Priority P0 - Core Missing Features

### 1. ✅ getApiUrl() Method

**Status**: ✅ Completed in v0.3.2

The `getApiUrl()` method is now implemented across all data providers.

```typescript
const dataProvider = await createRefineSQL({ connection: db, schema });

// Returns empty string for SQL databases (no REST API endpoint)
console.log(dataProvider.getApiUrl()); // ""
```

**Implementation Details**:

- Returns empty string as SQL databases don't have a traditional API URL
- Required by Refine 5.0 DataProvider interface
- Available in all implementations (provider.ts, d1.ts, data-provider.ts)

---

### 2. custom() Method ⭐

**Status**: ✅ Completed in v0.4.0

Execute custom SQL queries or complex database operations that go beyond standard CRUD.

#### API Design

```typescript
interface CustomParams {
  url: string;
  method: "get" | "delete" | "head" | "options" | "post" | "put" | "patch";
  payload?: {
    sql: string;
    args?: any[];
  };
  query?: Record<string, any>;
  headers?: Record<string, string>;
}

interface CustomResponse<T = any> {
  data: T;
}

// DataProvider signature
custom?: <T = any>(params: CustomParams) => Promise<CustomResponse<T>>;
```

#### Usage Examples

**Basic Raw SQL Query**:

```typescript
const result = await dataProvider.custom<User[]>({
  url: 'query',
  method: 'post',
  payload: {
    sql: 'SELECT * FROM users WHERE created_at > ?',
    args: [new Date('2024-01-01')],
  },
});
```

**Complex Aggregation**:

```typescript
const stats = await dataProvider.custom<{ total: number; avg: number }>({
  url: 'query',
  method: 'post',
  payload: {
    sql: `
      SELECT
        COUNT(*) as total,
        AVG(order_value) as avg
      FROM orders
      WHERE status = ?
      GROUP BY user_id
    `,
    args: ['completed'],
  },
});
```

**Execute Statement (INSERT/UPDATE/DELETE)**:

```typescript
const result = await dataProvider.custom({
  url: 'execute',
  method: 'post',
  payload: {
    sql: 'UPDATE users SET last_login = ? WHERE id = ?',
    args: [new Date(), 123],
  },
});
```

**Drizzle ORM Integration**:

```typescript
import { sql } from 'drizzle-orm';

const result = await dataProvider.custom({
  url: 'drizzle',
  method: 'post',
  payload: {
    query: db
      .select()
      .from(users)
      .where(sql`json_extract(metadata, '$.premium') = true`),
  },
});
```

#### Implementation Plan

```typescript
// src/provider.ts
async function custom<T = any>(
  params: CustomParams,
): Promise<CustomResponse<T>> {
  const { url, payload } = params;

  if (url === 'query' && payload?.sql) {
    // Execute SELECT queries
    const result = await db.execute(
      sql.raw(payload.sql, ...(payload.args || [])),
    );
    return { data: result.rows as T };
  }

  if (url === 'execute' && payload?.sql) {
    // Execute INSERT/UPDATE/DELETE
    const result = await db.execute(
      sql.raw(payload.sql, ...(payload.args || [])),
    );
    return { data: result as T };
  }

  if (url === 'drizzle' && payload?.query) {
    // Execute Drizzle query builder
    const result = await payload.query;
    return { data: result as T };
  }

  throw new UnsupportedOperatorError(`Unsupported custom operation: ${url}`);
}
```

**Benefits**:

- Flexibility for complex queries beyond CRUD
- Access to full SQL power
- Integration with Drizzle query builder
- Essential for real-world applications

---

## Priority P1 - Enhancement Features

### 3. Nested Relations Loading

**Status**: ✅ Completed in v0.4.0

Leverage Drizzle ORM's relational query API to load nested data in a single query.

#### Schema Definition

```typescript
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id),
  content: text('content').notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
}));
```

#### Usage Examples

**Basic Relation Loading**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: true, // Load all posts
    },
  },
});

// Result:
// {
//   id: 1,
//   name: "John Doe",
//   email: "john@example.com",
//   posts: [
//     { id: 1, title: "Post 1", content: "..." },
//     { id: 2, title: "Post 2", content: "..." }
//   ]
// }
```

**Nested Relations**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: {
        include: {
          comments: true, // Load comments for each post
        },
      },
    },
  },
});
```

**Selective Field Loading**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    include: {
      posts: {
        select: {
          id: true,
          title: true,
          // Exclude content field
        },
      },
    },
  },
});
```

**List with Relations**:

```typescript
const { data, total } = await dataProvider.getList<User>({
  resource: 'users',
  pagination: { current: 1, pageSize: 10 },
  meta: { include: { posts: true } },
});
```

#### Implementation

```typescript
async function getOne<T extends BaseRecord = BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';

  // Check if relations are requested
  if (params.meta?.include) {
    const [data] = await db.query[params.resource].findMany({
      where: eq(table[idColumn], params.id),
      with: params.meta.include,
    });

    if (!data) throw new RecordNotFoundError(params.resource, params.id);
    return { data: data as T };
  }

  // Standard query without relations
  const [data] = await db
    .select()
    .from(table)
    .where(eq(table[idColumn], params.id));

  if (!data) throw new RecordNotFoundError(params.resource, params.id);
  return { data: data as T };
}
```

---

### 4. Aggregation Query Support

**Status**: ✅ Completed in v0.4.0

Perform statistical analysis and reporting with built-in aggregation functions.

#### API Design

```typescript
interface AggregationMeta {
  aggregations?: {
    [key: string]: {
      sum?: string;
      avg?: string;
      count?: string;
      min?: string;
      max?: string;
    };
  };
  groupBy?: string[];
}
```

#### Usage Examples

**Basic Aggregations**:

```typescript
const result = await dataProvider.getList<OrderStats>({
  resource: 'orders',
  meta: {
    aggregations: {
      totalRevenue: { sum: 'amount' },
      avgOrderValue: { avg: 'amount' },
      orderCount: { count: '*' },
      minOrder: { min: 'amount' },
      maxOrder: { max: 'amount' },
    },
  },
});

// Result:
// {
//   data: [{
//     totalRevenue: 45000,
//     avgOrderValue: 150,
//     orderCount: 300,
//     minOrder: 10,
//     maxOrder: 999
//   }],
//   total: 1
// }
```

**Group By**:

```typescript
const result = await dataProvider.getList<OrderStatsByStatus>({
  resource: 'orders',
  meta: {
    aggregations: { total: { count: '*' }, revenue: { sum: 'amount' } },
    groupBy: ['status', 'created_at'],
  },
});

// Result:
// {
//   data: [
//     { status: 'completed', created_at: '2024-01', total: 150, revenue: 22500 },
//     { status: 'pending', created_at: '2024-01', total: 50, revenue: 7500 },
//     { status: 'completed', created_at: '2024-02', total: 200, revenue: 30000 }
//   ],
//   total: 3
// }
```

**With Filters**:

```typescript
const result = await dataProvider.getList<OrderStats>({
  resource: 'orders',
  filters: [
    { field: 'status', operator: 'eq', value: 'completed' },
    { field: 'created_at', operator: 'gte', value: new Date('2024-01-01') },
  ],
  meta: {
    aggregations: {
      totalRevenue: { sum: 'amount' },
      orderCount: { count: '*' },
    },
    groupBy: ['user_id'],
  },
});
```

#### Implementation

```typescript
import { avg, count, max, min, sql, sum } from 'drizzle-orm';

async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);

  // Check if aggregations are requested
  if (params.meta?.aggregations) {
    const aggregations: Record<string, any> = {};

    // Build aggregation select
    for (const [key, agg] of Object.entries(params.meta.aggregations)) {
      if (agg.sum) aggregations[key] = sum(table[agg.sum]);
      if (agg.avg) aggregations[key] = avg(table[agg.avg]);
      if (agg.count)
        aggregations[key] = count(
          agg.count === '*' ? undefined : table[agg.count],
        );
      if (agg.min) aggregations[key] = min(table[agg.min]);
      if (agg.max) aggregations[key] = max(table[agg.max]);
    }

    const query = db.select(aggregations).from(table).$dynamic();

    // Apply filters
    const where = filtersToWhere(params.filters, table);
    if (where) query.where(where);

    // Apply groupBy
    if (params.meta.groupBy) {
      const groupByColumns = params.meta.groupBy.map((field) => table[field]);
      query.groupBy(...groupByColumns);
    }

    const data = await query;
    return { data: data as T[], total: data.length };
  }

  // Standard query without aggregations
  // ... existing implementation
}
```

---

### 5. Field Selection (Select/Projection)

**Status**: ✅ Completed in v0.4.0

Optimize performance by selecting only the fields you need.

#### Usage Examples

**Select Specific Fields**:

```typescript
const { data } = await dataProvider.getList<User>({
  resource: 'users',
  meta: {
    select: ['id', 'name', 'email'], // Only fetch these fields
  },
});

// Result:
// [
//   { id: 1, name: "John", email: "john@example.com" },
//   { id: 2, name: "Jane", email: "jane@example.com" }
// ]
// Note: No other fields like created_at, updated_at, etc.
```

**Exclude Fields**:

```typescript
const { data } = await dataProvider.getList<User>({
  resource: 'users',
  meta: {
    exclude: ['password', 'secret_token'], // Exclude sensitive fields
  },
});
```

**With Relations**:

```typescript
const { data } = await dataProvider.getOne<User>({
  resource: 'users',
  id: 1,
  meta: {
    select: ['id', 'name'],
    include: {
      posts: {
        select: ['id', 'title'], // Only fetch post ID and title
      },
    },
  },
});
```

#### Implementation

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);

  let query;

  // Build select with specific fields
  if (params.meta?.select) {
    const selectFields = params.meta.select.reduce(
      (acc, field) => {
        acc[field] = table[field];
        return acc;
      },
      {} as Record<string, any>,
    );

    query = db.select(selectFields).from(table).$dynamic();
  } else if (params.meta?.exclude) {
    // Get all columns except excluded ones
    const allColumns = Object.keys(table).filter(
      (key) => !params.meta.exclude.includes(key),
    );
    const selectFields = allColumns.reduce(
      (acc, field) => {
        acc[field] = table[field];
        return acc;
      },
      {} as Record<string, any>,
    );

    query = db.select(selectFields).from(table).$dynamic();
  } else {
    query = db.select().from(table).$dynamic();
  }

  // ... rest of implementation (filters, sorting, pagination)
}
```

**Benefits**:

- Reduced network payload
- Better performance for large datasets
- Security: easily exclude sensitive fields
- Native Drizzle support

---

### 6. Soft Delete Support

**Status**: ✅ Completed in v0.4.0

Implement soft deletes for data safety and audit trails.

#### Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  softDelete: {
    enabled: true,
    field: 'deleted_at', // Default field name
  },
});
```

#### Usage Examples

**Soft Delete**:

```typescript
// This sets deleted_at = NOW() instead of actually deleting
const { data } = await dataProvider.deleteOne({
  resource: 'posts',
  id: 1,
  meta: { softDelete: true },
});
```

**Hard Delete (Override)**:

```typescript
const { data } = await dataProvider.deleteOne({
  resource: 'posts',
  id: 1,
  meta: {
    softDelete: false, // Force hard delete
  },
});
```

**Include Deleted Records**:

```typescript
const { data, total } = await dataProvider.getList({
  resource: 'posts',
  meta: {
    includeDeleted: true, // Show soft-deleted records
  },
});
```

**Only Deleted Records**:

```typescript
const { data, total } = await dataProvider.getList({
  resource: 'posts',
  meta: { onlyDeleted: true },
});
```

**Restore Deleted Record**:

```typescript
// Custom operation to restore
const { data } = await dataProvider.custom({
  url: 'restore',
  method: 'post',
  payload: { resource: 'posts', id: 1 },
});
```

#### Implementation

```typescript
async function deleteOne<T extends BaseRecord = BaseRecord>(
  params: DeleteOneParams,
): Promise<DeleteOneResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';
  const softDeleteField =
    params.meta?.deletedAtField ?? config.softDelete?.field ?? 'deleted_at';

  // Check if soft delete is enabled
  const shouldSoftDelete =
    params.meta?.softDelete ?? config.softDelete?.enabled ?? false;

  if (shouldSoftDelete) {
    // Soft delete: update deleted_at field
    const [result] = await db
      .update(table)
      .set({ [softDeleteField]: new Date() } as any)
      .where(eq(table[idColumn], params.id))
      .returning();

    if (!result) throw new RecordNotFoundError(params.resource, params.id);
    return { data: result as T };
  }

  // Hard delete: actually remove the record
  const [result] = await db
    .delete(table)
    .where(eq(table[idColumn], params.id))
    .returning();

  if (!result) throw new RecordNotFoundError(params.resource, params.id);
  return { data: result as T };
}

// Automatically filter out soft-deleted records in getList/getOne
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);
  const softDeleteField = config.softDelete?.field ?? 'deleted_at';

  const query = db.select().from(table).$dynamic();

  // Apply soft delete filter unless explicitly requested
  if (config.softDelete?.enabled && !params.meta?.includeDeleted) {
    if (params.meta?.onlyDeleted) {
      query.where(isNotNull(table[softDeleteField]));
    } else {
      query.where(isNull(table[softDeleteField]));
    }
  }

  // ... rest of implementation
}
```

**Schema Requirements**:

```typescript
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content'),
  deleted_at: integer('deleted_at', { mode: 'timestamp' }), // Required for soft delete
});
```

---

### 7. Time Travel (SQLite & D1) ⭐

**Status**: ✅ Available (Implemented in v0.3.x)

Automatic backup and point-in-time restore functionality for SQLite databases. For Cloudflare D1, Time Travel is built-in and managed by Cloudflare.

#### SQLite Time Travel

For local SQLite databases, Time Travel provides automatic file-based backups with configurable intervals and retention policies.

**Configuration**:

```typescript
const dataProvider = await createRefineSQL({
  connection: './database.sqlite',
  schema,
  timeTravel: {
    enabled: true,
    backupDir: './.time-travel',     // Backup directory
    intervalSeconds: 60,              // Backup every 60 seconds
    retentionDays: 30,                // Keep backups for 30 days
  },
});
```

**Usage Examples**:

```typescript
// List all available snapshots
const snapshots = await dataProvider.listSnapshots();
console.log(snapshots);
// [
//   { timestamp: '2025-01-15T10:30:00.000Z', path: './.time-travel/snapshot-2025-01-15T10-30-00-000Z.db', createdAt: 1705318200000 },
//   { timestamp: '2025-01-15T10:29:00.000Z', path: './.time-travel/snapshot-2025-01-15T10-29-00-000Z.db', createdAt: 1705318140000 },
// ]

// Create a manual snapshot
const snapshot = await dataProvider.createSnapshot('before-migration');
console.log(`Snapshot created at: ${snapshot.timestamp}`);

// Restore to a specific timestamp
await dataProvider.restoreToTimestamp('2025-01-15T10:30:00.000Z');

// Restore to the most recent snapshot before a date
await dataProvider.restoreToDate(new Date('2025-01-15T10:00:00.000Z'));

// Cleanup old snapshots (automatic during scheduled backups)
const deletedCount = await dataProvider.cleanupSnapshots();
console.log(`Deleted ${deletedCount} old snapshots`);

// Stop automatic backups when done
dataProvider.stopAutoBackup();
```

#### Cloudflare D1 Time Travel

For Cloudflare D1 databases, Time Travel is built-in and managed through the Cloudflare dashboard or `wrangler` CLI:

```bash
# List available restore points
wrangler d1 time-travel list --database=my-database

# Restore to a specific timestamp
wrangler d1 time-travel restore --database=my-database --timestamp=2025-01-15T10:30:00Z

# Restore to a specific bookmark
wrangler d1 time-travel restore --database=my-database --bookmark=BOOKMARK_ID
```

**Important Notes**:

- **SQLite**: Time Travel requires a file-based database (not `:memory:`)
- **D1**: Runtime queries at specific points in time are not supported via the D1 client API
- **D1**: Use `wrangler` CLI for database restoration
- **Automatic Cleanup**: Old snapshots are automatically cleaned up based on retention policy

#### Implementation Details

SQLite Time Travel is implemented in `src/time-travel-simple.ts`:

```typescript
export class TimeTravelManager {
  constructor(dbPath: string, options: TimeTravelOptions);

  // Create a manual snapshot
  async createSnapshot(label?: string): Promise<TimeTravelSnapshot>;

  // List all available snapshots
  async listSnapshots(): Promise<TimeTravelSnapshot[]>;

  // Restore to specific timestamp
  async restoreToTimestamp(timestamp: string): Promise<void>;

  // Restore to most recent snapshot before date
  async restoreToDate(date: Date): Promise<void>;

  // Cleanup old snapshots
  async cleanupSnapshots(): Promise<number>;

  // Stop automatic backup scheduler
  stopAutoBackup(): void;
}
```

**Benefits**:

- **Data Safety**: Automatic backups protect against accidental data loss
- **Point-in-Time Recovery**: Restore to any previous state
- **Zero Configuration**: Works out of the box with sensible defaults
- **Efficient Storage**: Configurable retention policy prevents disk space issues
- **D1 Native Support**: Built-in Time Travel for Cloudflare D1

---

## Breaking Changes

None. All new features are opt-in via `meta` parameter.

---

## Migration Guide

### From v0.3.x to v0.4.0

**No breaking changes** - all existing code will continue to work.

#### Opt-in to New Features

**Enable Custom Queries**:

```typescript
// Just use the new custom() method
const result = await dataProvider.custom({
  url: 'query',
  method: 'post',
  payload: { sql: 'SELECT * FROM users' },
});
```

**Enable Soft Deletes**:

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  softDelete: {
    enabled: true, // Opt-in
    field: 'deleted_at',
  },
});
```

**Use Relations** (requires schema definition):

```typescript
// 1. Define relations in schema
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

// 2. Use in queries
const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  meta: { include: { posts: true } },
});
```

---

## Development Roadmap

| Feature          | Status       | Completed |
| ---------------- | ------------ | --------- |
| getApiUrl()      | ✅ Completed | v0.3.2    |
| custom() method  | ✅ Completed | v0.4.0    |
| Nested Relations | ✅ Completed | v0.4.0    |
| Aggregations     | ✅ Completed | v0.4.0    |
| Field Selection  | ✅ Completed | v0.4.0    |
| Soft Delete      | ✅ Completed | v0.4.0    |
| Time Travel      | ✅ Available | v0.3.x    |

---

## Contributing

We welcome contributions! Priority areas for v0.4.0:

1. **custom() method implementation** - Core functionality
2. **Relations loading** - High value for users
3. **Aggregation support** - Common use case
4. **Test coverage** - Ensure quality

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2025-01-15
**Maintainer**: Refine SQLx Team
