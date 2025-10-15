# Refine SQLx v0.5.0 - Enterprise & Developer Experience

**Status**: Planned
**Target Release**: Q2-Q3 2025
**Refine Version**: 5.0+

## Overview

Version 0.5.0 focuses on enterprise-grade features (P2) and developer experience improvements (P3) to make refine-sqlx production-ready for large-scale applications.

---

## Priority P2 - Enterprise Features

### 1. Optimistic Locking (Concurrency Control)

**Status**: 📋 Planned for v0.5.0

Prevent lost updates in concurrent environments with version-based optimistic locking.

#### Schema Setup

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull(),
  version: integer('version').notNull().default(1), // Version field for optimistic locking
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

#### Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  optimisticLocking: {
    enabled: true,
    versionField: 'version', // Default field name
    strategy: 'version', // or 'timestamp'
  },
});
```

#### Usage Examples

**Update with Version Check**:

```typescript
// User A reads product (version = 5)
const { data: product } = await dataProvider.getOne({
  resource: 'products',
  id: 1,
});
// product = { id: 1, name: "Widget", price: 100, version: 5 }

// User A tries to update
const { data } = await dataProvider.update({
  resource: 'products',
  id: 1,
  variables: { price: 120 },
  meta: {
    version: 5, // Include current version
  },
});

// Success! Returns updated record with version = 6
```

**Conflict Detection**:

```typescript
// User B updates the same product while User A is editing
// Version changes from 5 to 6

// User A's update attempt (still using version 5)
try {
  await dataProvider.update({
    resource: 'products',
    id: 1,
    variables: { price: 120 },
    meta: {
      version: 5, // Stale version!
    },
  });
} catch (error) {
  // Throws OptimisticLockError
  console.error('Conflict detected! Someone else updated this record.');
  console.log(error.currentVersion); // 6
  console.log(error.expectedVersion); // 5

  // Handle conflict: refetch, merge, or ask user
  const latest = await dataProvider.getOne({ resource: 'products', id: 1 });
  // Show conflict resolution UI
}
```

**Timestamp-based Locking** (Alternative):

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  optimisticLocking: {
    enabled: true,
    strategy: 'timestamp',
    timestampField: 'updated_at',
  },
});

await dataProvider.update({
  resource: 'products',
  id: 1,
  variables: { price: 120 },
  meta: { lastUpdated: new Date('2024-01-15T10:30:00Z') },
});
```

#### Implementation

```typescript
import { OptimisticLockError } from './errors';

async function update<T extends BaseRecord = BaseRecord>(
  params: UpdateParams,
): Promise<UpdateResponse<T>> {
  const table = getTable(params.resource);
  const idColumn = params.meta?.idColumnName ?? 'id';
  const versionField = config.optimisticLocking?.versionField ?? 'version';

  if (config.optimisticLocking?.enabled && params.meta?.version !== undefined) {
    // Build update with version check
    const [result] = await db
      .update(table)
      .set({
        ...params.variables,
        [versionField]: sql`${table[versionField]} + 1`, // Increment version
      } as any)
      .where(
        and(
          eq(table[idColumn], params.id),
          eq(table[versionField], params.meta.version), // Version check
        ),
      )
      .returning();

    if (!result) {
      // Version mismatch - fetch current version
      const [current] = await db
        .select({ version: table[versionField] })
        .from(table)
        .where(eq(table[idColumn], params.id));

      throw new OptimisticLockError(
        params.resource,
        params.id,
        params.meta.version,
        current?.version,
      );
    }

    return { data: result as T };
  }

  // Standard update without version check
  // ... existing implementation
}
```

**Error Handling**:

```typescript
export class OptimisticLockError extends RefineSQLError {
  constructor(
    resource: string,
    id: BaseKey,
    expectedVersion: number,
    currentVersion?: number,
  ) {
    super(
      `Optimistic lock conflict: ${resource}#${id} ` +
        `(expected version ${expectedVersion}, current version ${currentVersion})`,
    );
    this.name = 'OptimisticLockError';
  }
}
```

**Benefits**:

- Prevent lost updates in concurrent environments
- Better than pessimistic locking (no database locks)
- Works great with Refine's useForm optimistic updates
- Industry-standard pattern

---

### 2. Live Queries / Real-time Subscriptions

**Status**: 📋 Planned for v0.5.0

Enable real-time data updates using Refine's live provider interface.

#### Configuration

```typescript
import { createRefineSQL } from 'refine-sqlx';

const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  liveMode: {
    enabled: true,
    strategy: 'polling', // or 'websocket' (Bun/Node only)
    pollingInterval: 5000, // 5 seconds
  },
});

// For WebSocket support (Bun/Node.js)
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  liveMode: { enabled: true, strategy: 'websocket', port: 3001 },
});
```

#### Usage with Refine Hooks

```typescript
import { useList } from '@refinedev/core';

function NotificationsList() {
  const { data, isLoading } = useList({
    resource: 'notifications',
    liveMode: 'auto', // Enable real-time updates
  });

  // Data automatically updates when database changes
  return (
    <ul>
      {data?.data.map(notification => (
        <li key={notification.id}>{notification.message}</li>
      ))}
    </ul>
  );
}
```

#### Implementation Strategies

**Strategy 1: Polling** (All platforms):

```typescript
// Automatic background polling
setInterval(async () => {
  const latestData = await db.select().from(table).where(updatedSince);
  if (hasChanges(latestData)) {
    notifySubscribers(latestData);
  }
}, config.liveMode.pollingInterval);
```

**Strategy 2: WebSocket** (Bun/Node.js):

```typescript
import { Server } from 'bun';

// Watch database changes using SQLite triggers
const watcher = db.prepare(`
  CREATE TRIGGER IF NOT EXISTS notify_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  BEGIN
    SELECT notify_websocket(NEW.id, 'users', TG_OP);
  END
`);

// Broadcast to WebSocket clients
websocketServer.publish('users', {
  type: 'UPDATE',
  resource: 'users',
  ids: [1, 2, 3],
});
```

**Strategy 3: Cloudflare D1** (Limited support):

```typescript
// D1 doesn't support real-time queries natively
// Fallback to polling or external pub/sub (Durable Objects, Queue)

const dataProvider = await createRefineSQL({
  connection: env.DB,
  schema,
  liveMode: {
    enabled: true,
    strategy: 'durable-objects',
    durableObjectNamespace: env.LIVE_UPDATES,
  },
});
```

#### Live Provider Interface

```typescript
import { LiveProvider } from '@refinedev/core';

export const liveProvider: LiveProvider = {
  subscribe: ({ channel, types, callback }) => {
    const subscription = eventEmitter.on(channel, (event) => {
      if (types.includes(event.type)) {
        callback(event);
      }
    });

    return () => subscription.off();
  },

  unsubscribe: (subscription) => {
    subscription();
  },

  publish: ({ channel, type, payload }) => {
    eventEmitter.emit(channel, { type, payload, date: new Date() });
  },
};
```

**Benefits**:

- Real-time UI updates without manual refresh
- Better UX for collaborative apps
- Refine's built-in live provider support
- Multiple implementation strategies

**Limitations**:

- Cloudflare D1: No native support (requires workarounds)
- Polling: Higher database load
- WebSocket: Additional infrastructure

---

### 3. Multi-tenancy / Row-Level Security

**Status**: 📋 Planned for v0.5.0

Automatically scope all queries to a specific tenant for SaaS applications.

#### Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  multiTenancy: {
    enabled: true,
    tenantField: 'organization_id', // Field name in all tables
    tenantId: 'org_123', // Current tenant ID
    strictMode: true, // Throw error if tenantField is missing
  },
});
```

#### Schema Setup

```typescript
// All tables must include tenant field
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organization_id: text('organization_id').notNull(), // Tenant field
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organization_id: text('organization_id').notNull(), // Tenant field
  user_id: integer('user_id').notNull(),
  title: text('title').notNull(),
});
```

#### Automatic Tenant Scoping

```typescript
// All queries automatically include tenant filter
const { data, total } = await dataProvider.getList({
  resource: 'users',
  // Automatically adds: WHERE organization_id = 'org_123'
});

const { data } = await dataProvider.getOne({
  resource: 'users',
  id: 1,
  // Automatically adds: WHERE id = 1 AND organization_id = 'org_123'
});

const { data } = await dataProvider.create({
  resource: 'posts',
  variables: {
    title: 'New Post',
    content: 'Hello world',
    // organization_id automatically injected
  },
});
```

#### Dynamic Tenant Switching

```typescript
// Switch tenant per request
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    tenantId: 'org_456', // Override default tenant
  },
});

// Disable tenant scoping (admin queries)
const { data } = await dataProvider.getList({
  resource: 'users',
  meta: {
    bypassTenancy: true, // Requires admin permission
  },
});
```

#### Implementation

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const table = getTable(params.resource);
  const tenantField = config.multiTenancy?.tenantField;
  const tenantId = params.meta?.tenantId ?? config.multiTenancy?.tenantId;

  const query = db.select().from(table).$dynamic();

  // Apply tenant filter
  if (config.multiTenancy?.enabled && !params.meta?.bypassTenancy) {
    if (!tenantId) {
      throw new Error('Tenant ID is required in multi-tenancy mode');
    }

    if (!(tenantField in table)) {
      if (config.multiTenancy.strictMode) {
        throw new Error(
          `Table ${params.resource} missing tenant field: ${tenantField}`,
        );
      }
    } else {
      query.where(eq(table[tenantField], tenantId));
    }
  }

  // Apply user filters
  const where = filtersToWhere(params.filters, table);
  if (where) query.where(where);

  // ... rest of implementation
}

async function create<T extends BaseRecord = BaseRecord>(
  params: CreateParams,
): Promise<CreateResponse<T>> {
  const table = getTable(params.resource);
  const tenantField = config.multiTenancy?.tenantField;
  const tenantId = config.multiTenancy?.tenantId;

  // Automatically inject tenant ID
  const dataWithTenant = {
    ...params.variables,
    ...(config.multiTenancy?.enabled && tenantId ?
      { [tenantField]: tenantId }
    : {}),
  };

  const [result] = await db
    .insert(table)
    .values(dataWithTenant as any)
    .returning();

  return { data: result as T };
}
```

**Benefits**:

- Data isolation per tenant
- Prevents data leaks
- Simplified application logic
- Essential for SaaS platforms

**Security Considerations**:

- Always validate tenant ID from authenticated user
- Never trust tenant ID from client input
- Use database-level RLS if available (PostgreSQL)

---

### 4. Query Caching

**Status**: 📋 Planned for v0.5.0

Reduce database load by caching frequently accessed data.

#### Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  cache: {
    enabled: true,
    adapter: 'memory', // or 'redis', 'cloudflare-kv'
    ttl: 300, // Default TTL in seconds
    maxSize: 1000, // Max cached items (memory adapter)
  },
});
```

#### Usage Examples

**Cache Static Data**:

```typescript
const { data } = await dataProvider.getList({
  resource: 'categories',
  meta: {
    cache: {
      enabled: true,
      ttl: 3600, // Cache for 1 hour
      key: 'all-categories', // Custom cache key
    },
  },
});
```

**Disable Cache for Dynamic Data**:

```typescript
const { data } = await dataProvider.getList({
  resource: 'notifications',
  meta: {
    cache: {
      enabled: false, // Don't cache
    },
  },
});
```

**Cache Invalidation**:

```typescript
// Automatically invalidate on write operations
await dataProvider.create({
  resource: 'categories',
  variables: { name: 'New Category' },
  // Automatically clears 'categories' cache
});

// Manual invalidation
await dataProvider.custom({
  url: 'cache/invalidate',
  method: 'post',
  payload: {
    resource: 'categories',
    pattern: 'categories:*', // Clear all category caches
  },
});
```

#### Cache Adapters

**Memory Adapter** (Default):

```typescript
class MemoryCacheAdapter {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.data;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.cache.set(key, { data: value, expiresAt: Date.now() + ttl * 1000 });
  }

  async delete(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Cloudflare KV Adapter**:

```typescript
class CloudflareKVAdapter {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
  }

  async delete(pattern: string): Promise<void> {
    const list = await this.kv.list({ prefix: pattern.replace('*', '') });
    await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
  }
}
```

**Implementation**:

```typescript
async function getList<T extends BaseRecord = BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<T>> {
  const cacheConfig = params.meta?.cache ?? config.cache;

  if (cacheConfig?.enabled) {
    const cacheKey = generateCacheKey('getList', params);
    const cached = await cacheAdapter.get<GetListResponse<T>>(cacheKey);

    if (cached) {
      return cached; // Return cached result
    }
  }

  // Execute query
  const result = await executeGetListQuery(params);

  // Cache result
  if (cacheConfig?.enabled) {
    const cacheKey = generateCacheKey('getList', params);
    await cacheAdapter.set(cacheKey, result, cacheConfig.ttl);
  }

  return result;
}
```

**Benefits**:

- Reduced database load
- Faster response times
- Cost savings (especially for D1)
- Configurable per-resource

---

## Priority P3 - Developer Experience

### 5. TypeScript Schema Generator

**Status**: 📋 Planned for v0.5.0

Automatically generate TypeScript types for Refine resources.

#### CLI Command

```bash
# Generate types from Drizzle schema
refine-sqlx generate-types

# With options
refine-sqlx generate-types \
  --schema ./src/schema.ts \
  --output ./src/types/resources.ts \
  --format refine
```

#### Generated Output

```typescript
// src/types/resources.generated.ts
import type { BaseRecord } from '@refinedev/core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import * as schema from '../schema';

// Resource types
export interface User extends BaseRecord {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  created_at: Date;
}

export interface Post extends BaseRecord {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  published_at: Date | null;
}

// Insert types (for create operations)
export type UserInsert = InferInsertModel<typeof schema.users>;
export type PostInsert = InferInsertModel<typeof schema.posts>;

// Resource name type
export type ResourceName = 'users' | 'posts';

// Resource map
export interface ResourceMap {
  users: User;
  posts: Post;
}

// Type-safe resource helper
export function getResourceType<T extends ResourceName>(
  resource: T,
): ResourceMap[T] {
  return null as any;
}
```

#### Usage in Application

```typescript
import { useList, useCreate } from '@refinedev/core';
import type { User, UserInsert } from './types/resources.generated';

function UsersList() {
  // Fully typed
  const { data } = useList<User>({
    resource: 'users',
  });

  const { mutate } = useCreate<User, {}, UserInsert>();

  const handleCreate = () => {
    mutate({
      resource: 'users',
      values: {
        name: 'John',
        email: 'john@example.com',
        status: 'active', // Type-safe enum
        created_at: new Date(),
      }
    });
  };

  return <div>{/* ... */}</div>;
}
```

---

### 6. Data Validation Integration

**Status**: 📋 Planned for v0.5.0

Integrate with Zod or Drizzle's validation for type-safe data operations.

#### Schema with Validation

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

// Generate Zod schemas from Drizzle
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  status: z.enum(['active', 'inactive']),
});

export const selectUserSchema = createSelectSchema(users);
```

#### Usage with Validation

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  validation: {
    enabled: true,
    schemas: {
      users: { insert: insertUserSchema, update: insertUserSchema.partial() },
    },
    throwOnError: true,
  },
});

// Automatic validation
try {
  await dataProvider.create({
    resource: 'users',
    variables: {
      name: 'A', // Too short!
      email: 'invalid-email', // Invalid format!
      status: 'active',
    },
  });
} catch (error) {
  // ValidationError with detailed messages
  console.log(error.issues);
  // [
  //   { path: ['name'], message: 'Name must be at least 2 characters' },
  //   { path: ['email'], message: 'Invalid email format' }
  // ]
}
```

---

### 7. Enhanced Logging & Debugging

**Status**: 📋 Planned for v0.5.0

Detailed logging and performance monitoring.

#### Configuration

```typescript
const dataProvider = await createRefineSQL({
  connection: db,
  schema,
  logging: {
    enabled: true,
    level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
    logQueries: true,
    logPerformance: true,
    slowQueryThreshold: 1000, // Log queries > 1s
    onQuery: (event) => {
      console.log(`[${event.duration}ms] ${event.sql}`);
      console.log('Params:', event.params);

      // Send to monitoring service
      analytics.track('database_query', {
        resource: event.resource,
        operation: event.operation,
        duration: event.duration,
      });
    },
  },
});
```

#### Log Output

```
[DEBUG] [12ms] getList(users) - Filters: status=active, Pagination: 1-10
[DEBUG] SQL: SELECT * FROM users WHERE status = ? LIMIT ? OFFSET ?
[DEBUG] Params: ['active', 10, 0]
[INFO] Query completed in 12ms
[WARN] Slow query detected: getList(orders) took 1250ms
```

---

### 8. Migration Management

**Status**: 📋 Planned for v0.5.0

Integrated database migration tooling.

```bash
# Create migration
refine-sqlx migrate create add_users_table

# Apply migrations
refine-sqlx migrate up

# Rollback
refine-sqlx migrate rollback

# Status
refine-sqlx migrate status
```

---

## Development Roadmap

| Feature            | Priority | Target Date | Dependencies             |
| ------------------ | -------- | ----------- | ------------------------ |
| Optimistic Locking | P2       | Q2 2025     | None                     |
| Live Queries       | P2       | Q2 2025     | WebSocket infrastructure |
| Multi-tenancy      | P2       | Q2 2025     | None                     |
| Query Caching      | P2       | Q2 2025     | Cache adapters           |
| Type Generator     | P3       | Q3 2025     | CLI framework            |
| Validation         | P3       | Q3 2025     | Zod integration          |
| Enhanced Logging   | P3       | Q3 2025     | None                     |
| Migration Tools    | P3       | Q3 2025     | Drizzle Kit              |

---

## Breaking Changes

**Minimal breaking changes planned:**

1. **Configuration structure** may be reorganized for clarity
2. **Error classes** may be refactored for better type safety
3. **Deprecated methods** from v0.4.0 may be removed

Migration guide will be provided before release.

---

## Contributing

Priority contributions for v0.5.0:

1. **Cache adapters** - Redis, Cloudflare KV implementations
2. **Live query strategies** - WebSocket, polling optimizations
3. **Multi-tenancy** - Testing across different tenant scenarios
4. **Documentation** - Enterprise deployment guides

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2025-01-15
**Maintainer**: Refine SQLx Team
