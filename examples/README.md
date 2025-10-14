# refine-d1 Usage Examples

[English](#english) | [中文](#中文)

## English

This directory contains comprehensive examples showing how to use refine-d1 in different scenarios.

## Table of Contents

- [Basic Examples](#basic-examples)
- [Database-Specific Examples](#database-specific-examples)
- [Advanced Features](#advanced-features)
- [Real-World Applications](#real-world-applications)
- [Runtime Examples](#runtime-examples)

## Basic Examples

### Simple Blog Application

A basic blog application demonstrating CRUD operations with users and posts.

**Files:**
- `blog-app-sqlx.ts` - Complete blog application using refine-d1 with SQLite
- `basic-usage.ts` - Basic usage examples and API overview
- `blog-app-migration.ts` - Migration guide from traditional DataProvider

**Features:**
- User management
- Post creation and editing
- Comments system
- Basic authentication

### E-commerce Store

An e-commerce example with products, orders, and customers.

**Files:**
- `ecommerce-orm.ts` - Using refine-sqlx with MySQL
- `ecommerce-sql.ts` - Using refine-d1 with SQLite
- `ecommerce-schema.sql` - Database schema

**Features:**
- Product catalog
- Shopping cart
- Order management
- Customer profiles
- Inventory tracking

## Database-Specific Examples

### PostgreSQL Examples

**Advanced PostgreSQL Features:**
- `postgresql-advanced.ts` - JSON columns, arrays, full-text search
- `postgresql-performance.ts` - Indexing, query optimization
- `postgresql-migrations.ts` - Database migrations with Drizzle

### MySQL Examples

**MySQL-Specific Features:**
- `mysql-advanced.ts` - JSON columns, spatial data
- `mysql-replication.ts` - Read/write splitting
- `mysql-performance.ts` - Query optimization

### SQLite Examples

**SQLite Features:**
- `sqlite-fts.ts` - Full-text search with FTS5
- `sqlite-json.ts` - JSON1 extension usage
- `sqlite-wal.ts` - WAL mode configuration

## Advanced Features

### Polymorphic Relationships

Examples of polymorphic associations where a model can belong to multiple other models.

**Files:**
- `polymorphic-comments.ts` - Comments that can belong to posts or users
- `polymorphic-attachments.ts` - File attachments for multiple models
- `polymorphic-activities.ts` - Activity logs for different entities

### Chain Queries

Advanced query building with method chaining.

**Files:**
- `chain-queries-basic.ts` - Basic chain query examples
- `chain-queries-advanced.ts` - Complex queries with joins and aggregations
- `chain-queries-performance.ts` - Optimized queries for large datasets

### Transactions

Transaction management examples.

**Files:**
- `transactions-basic.ts` - Simple transaction examples
- `transactions-nested.ts` - Nested transactions
- `transactions-rollback.ts` - Error handling and rollbacks

## Real-World Applications

### Task Management System

A complete task management application.

**Features:**
- Projects and tasks
- User assignments
- Time tracking
- File attachments
- Activity logs

**Files:**
- `task-management/` - Complete application
  - `schema.ts` - Database schema
  - `data-provider.ts` - Data provider setup
  - `components/` - React components
  - `hooks/` - Custom hooks

### Content Management System

A CMS with pages, media, and user roles.

**Features:**
- Page management
- Media library
- User roles and permissions
- SEO metadata
- Content versioning

**Files:**
- `cms/` - Complete CMS application
  - `schema.ts` - Database schema
  - `providers/` - Data providers
  - `admin/` - Admin interface
  - `api/` - API endpoints

## Runtime Examples

### Bun Examples

Examples optimized for Bun runtime.

**Files:**
- `bun-server.ts` - Bun HTTP server with refine-d1
- `bun-websockets.ts` - Real-time features with WebSockets
- `bun-performance.ts` - Performance optimizations

### Node.js Examples

Traditional Node.js applications.

**Files:**
- `node-express.ts` - Express.js server
- `node-fastify.ts` - Fastify server
- `node-cluster.ts` - Cluster mode with connection pooling

### Cloudflare Workers Examples

Edge computing examples with D1 database.

**Files:**
- `cloudflare-api.ts` - REST API with D1
- `cloudflare-auth.ts` - Authentication with Workers
- `cloudflare-cache.ts` - Caching strategies

## Running Examples

### Prerequisites

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# PostgreSQL
createdb refine_examples
psql refine_examples < examples/schemas/postgresql.sql

# MySQL
mysql -u root -p -e "CREATE DATABASE refine_examples"
mysql -u root -p refine_examples < examples/schemas/mysql.sql

# SQLite
# Database will be created automatically
```

### Running Examples

```bash
# Run specific example
bun run examples/blog-app-orm.ts

# Run with different databases
DATABASE_URL=postgresql://... bun run examples/blog-app-orm.ts
DATABASE_URL=mysql://... bun run examples/ecommerce-orm.ts

# Run SQLite examples
bun run examples/blog-app-sqlx.ts
```

### Development Mode

```bash
# Watch mode for development
bun run --watch examples/blog-app-orm.ts

# Debug mode
DEBUG=true bun run examples/blog-app-orm.ts
```

## Example Structure

Each example follows this structure:

```
example-name/
├── README.md           # Example-specific documentation
├── schema.ts          # Database schema definition
├── data-provider.ts   # Data provider setup
├── seed.ts           # Sample data
├── main.ts           # Main application logic
├── components/       # React components (if applicable)
├── hooks/           # Custom hooks (if applicable)
└── tests/           # Tests for the example
```

## Contributing Examples

We welcome contributions of new examples! Please follow these guidelines:

1. **Create a new directory** for your example
2. **Include comprehensive documentation** in README.md
3. **Provide sample data** with seed scripts
4. **Add tests** to verify functionality
5. **Follow TypeScript best practices**
6. **Include error handling**

### Example Template

Use this template for new examples:

```typescript
/**
 * Example: [Example Name]
 * Description: [Brief description of what this example demonstrates]
 * 
 * Features:
 * - Feature 1
 * - Feature 2
 * - Feature 3
 * 
 * Prerequisites:
 * - Database setup instructions
 * - Required environment variables
 */

import { createPostgreSQLProvider } from 'refine-sqlx';
import { schema } from './schema';

async function main() {
  try {
    // Setup
    const dataProvider = await createPostgreSQLProvider(
      process.env.DATABASE_URL!,
      schema,
      { debug: true }
    );

    // Example logic here
    console.log('Example completed successfully');

  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run example if this file is executed directly
if (import.meta.main) {
  main();
}
```

## Getting Help

If you have questions about the examples:

1. Check the example's README.md file
2. Look at similar examples for patterns
3. Ask questions in [GitHub Discussions](https://github.com/zuohuadong/refine-d1/discussions)
4. Report issues in [GitHub Issues](https://github.com/zuohuadong/refine-d1/issues)

Happy coding! 🚀