# Native Query Builders Implementation

## Overview

This document describes the implementation of native query builders for the @refine-sqlx/orm package. The native query builders provide type-safe, chainable interfaces for building complex SQL queries using drizzle-orm.

## Implemented Components

### 1. SelectChain

A comprehensive SELECT query builder with advanced features:

**Features:**

- Column selection with type safety
- DISTINCT clause support
- WHERE conditions with multiple operators
- AND/OR logic for complex conditions
- ORDER BY with multiple columns
- GROUP BY functionality
- HAVING clauses with aggregation support
- JOIN operations (INNER, LEFT, RIGHT)
- LIMIT and OFFSET
- Pagination helper
- Aggregation functions (COUNT, SUM, AVG, MIN, MAX)

**Usage Example:**

```typescript
const results = await dataProvider.query
  .select('users')
  .select(['id', 'name', 'email'])
  .distinct()
  .where('age', 'gte', 18)
  .whereOr([
    { column: 'status', operator: 'eq', value: 'active' },
    { column: 'status', operator: 'eq', value: 'verified' },
  ])
  .orderBy('createdAt', 'desc')
  .groupBy('status')
  .havingCount('gt', 5)
  .limit(20)
  .get();
```

### 2. InsertChain

A powerful INSERT query builder with conflict resolution:

**Features:**

- Single and bulk insert operations
- Type-safe value insertion
- Conflict resolution (IGNORE, UPDATE)
- RETURNING clause support
- Custom conflict targets and update data

**Usage Example:**

```typescript
const newUsers = await dataProvider.query
  .insert('users')
  .values([
    { name: 'John', email: 'john@example.com', age: 30 },
    { name: 'Jane', email: 'jane@example.com', age: 25 },
  ])
  .onConflict('update', ['email'], {
    name: sql`EXCLUDED.name`,
    updatedAt: sql`NOW()`,
  })
  .returning(['id', 'name', 'email'])
  .execute();
```

### 3. UpdateChain

A flexible UPDATE query builder:

**Features:**

- Type-safe data updates
- Complex WHERE conditions
- AND/OR logic support
- JOIN operations for complex updates
- RETURNING clause support

**Usage Example:**

```typescript
const updatedUsers = await dataProvider.query
  .update('users')
  .set({ status: 'verified', updatedAt: sql`NOW()` })
  .whereAnd([
    { column: 'age', operator: 'gte', value: 18 },
    { column: 'isVerified', operator: 'eq', value: true },
  ])
  .returning(['id', 'name', 'status'])
  .execute();
```

### 4. DeleteChain

A comprehensive DELETE query builder:

**Features:**

- Complex WHERE conditions
- AND/OR logic support
- JOIN operations for complex deletes
- RETURNING clause support

**Usage Example:**

```typescript
const deletedUsers = await dataProvider.query
  .delete('users')
  .whereOr([
    { column: 'status', operator: 'eq', value: 'spam' },
    { column: 'status', operator: 'eq', value: 'deleted' },
  ])
  .returning(['id', 'name', 'email'])
  .execute();
```

## Integration with Data Provider

The native query builders are integrated into the main RefineOrmDataProvider through the `query` property:

```typescript
const dataProvider = createPostgreSQLProvider(connectionString, schema);

// Access native query builders
const selectChain = dataProvider.query.select('users');
const insertChain = dataProvider.query.insert('users');
const updateChain = dataProvider.query.update('users');
const deleteChain = dataProvider.query.delete('users');
```

## Type Safety

All query builders are fully type-safe and provide:

- Column name validation at compile time
- Type inference for return values
- Proper typing for filter operators
- Schema-aware table and column references

## Supported Filter Operators

The query builders support all standard filter operators:

- `eq` - Equal
- `ne` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - Pattern matching
- `ilike` - Case-insensitive pattern matching
- `notLike` - Negative pattern matching
- `isNull` - Is null
- `isNotNull` - Is not null
- `in` - In array
- `notIn` - Not in array
- `between` - Between two values
- `notBetween` - Not between two values

## Advanced Features

### 1. Complex Conditions

Support for complex AND/OR logic:

```typescript
const query = dataProvider.query
  .select('users')
  .whereAnd([
    { column: 'age', operator: 'gte', value: 18 },
    { column: 'status', operator: 'eq', value: 'active' },
  ])
  .whereOr([
    { column: 'role', operator: 'eq', value: 'admin' },
    { column: 'role', operator: 'eq', value: 'moderator' },
  ]);
```

### 2. Aggregation Functions

Built-in aggregation support:

```typescript
const stats = {
  total: await dataProvider.query.select('users').count(),
  averageAge: await dataProvider.query.select('users').avg('age'),
  minAge: await dataProvider.query.select('users').min('age'),
  maxAge: await dataProvider.query.select('users').max('age'),
};
```

### 3. JOIN Operations

Support for various JOIN types:

```typescript
const usersWithPosts = await dataProvider.query
  .select('users')
  .innerJoin('posts', sql`${users.id} = ${posts.userId}`)
  .where('status', 'eq', 'active')
  .get();
```

### 4. HAVING Clauses

Advanced HAVING support with aggregations:

```typescript
const activeGroups = await dataProvider.query
  .select('users')
  .groupBy('status')
  .havingCount('gt', 10)
  .havingAvg('age', 'gte', 25)
  .get();
```

## Error Handling

The query builders include comprehensive error handling:

- **QueryError**: For invalid queries or unsupported operations
- **ValidationError**: For invalid parameter values
- Column validation at runtime
- Proper error messages with context

## Testing

The implementation includes comprehensive tests covering:

- All query builder methods
- Error conditions
- Complex query scenarios
- Type safety validation
- Edge cases and boundary conditions

## Database Compatibility

The native query builders work with all supported databases:

- PostgreSQL (with bun:sql and postgres-js)
- MySQL (with mysql2)
- SQLite (with bun:sqlite and better-sqlite3)

## Performance Considerations

- Efficient query building with minimal overhead
- Lazy evaluation of query conditions
- Optimized for both simple and complex queries
- Memory-efficient handling of large result sets

## Future Enhancements

Potential future improvements:

1. Query caching mechanisms
2. Query optimization hints
3. Batch operation support
4. Advanced JOIN syntax
5. Window function support
6. Common Table Expression (CTE) support

## Requirements Satisfied

This implementation satisfies the following requirements from the task:

✅ **2.2**: Complex query support with filtering, sorting, and relationships
✅ **7.2**: Advanced query functionality and database-specific features

The native query builders provide a powerful, type-safe interface for building complex database queries while maintaining compatibility with the existing @refine-sqlx/orm architecture.
