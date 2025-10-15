# D1 Database Migrations Guide

Complete guide for managing Cloudflare D1 database migrations with Drizzle Kit and refine-sqlx.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Available Commands](#available-commands)
- [Migration Workflow](#migration-workflow)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# Install Wrangler CLI (Cloudflare Workers CLI)
npm install -g wrangler
# or
bun add -g wrangler

# Login to Cloudflare
wrangler login
```

### Required Credentials

You'll need these from your Cloudflare dashboard:

1. **Account ID**: Found in Cloudflare Dashboard → Workers & Pages → Overview
2. **Database ID**: Created via `wrangler d1 create <name>` or found in dashboard
3. **API Token**: Create at https://dash.cloudflare.com/profile/api-tokens
   - Required permissions: `D1:Edit`, `Workers:Edit`

## Configuration

### 1. Drizzle Kit Configuration

The project includes two Drizzle Kit configurations:

**`drizzle.config.ts`** - Local SQLite development

```typescript
export default defineConfig({
  schema: './example/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
```

**`drizzle.config.d1.ts`** - Cloudflare D1 production

```typescript
export default defineConfig({
  schema: './example/schema.ts',
  out: './drizzle/d1',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
```

### 2. Environment Variables

Create `.env` file (never commit this!):

```bash
# Cloudflare Account Information
CLOUDFLARE_ACCOUNT_ID="your-account-id-here"
CLOUDFLARE_API_TOKEN="your-api-token-here"

# Database IDs
CLOUDFLARE_DATABASE_ID="your-production-database-id"
CLOUDFLARE_DATABASE_ID_DEV="your-development-database-id"

# For migration script
D1_DATABASE_NAME="your-database-name"
```

### 3. Wrangler Configuration

Copy and configure `wrangler.toml.example` to `wrangler.toml`:

```bash
cp wrangler.toml.example wrangler.toml
```

Update with your database IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "refine-sqlx-db"
database_id = "your-database-id-here"
```

## Available Commands

### Migration Commands

```bash
# Generate migrations from schema (local)
bun run db:generate

# Generate migrations for D1 (remote)
bun run db:generate:d1

# Push schema directly to local SQLite (dev only)
bun run db:push

# Push schema directly to D1 (dev only)
bun run db:push:d1

# Apply migrations to D1 using helper script
bun run db:migrate:d1

# Open Drizzle Studio for local database
bun run db:studio

# Open Drizzle Studio for D1 database
bun run db:studio:d1
```

### Wrangler Commands

```bash
# Create new D1 database
wrangler d1 create <database-name>

# List all D1 databases
wrangler d1 list

# View database info
wrangler d1 info <database-name>

# Execute SQL file
wrangler d1 execute <database-name> --file=<path-to-sql>

# Execute SQL command
wrangler d1 execute <database-name> --command="<sql-query>"

# Export database
wrangler d1 export <database-name> --output=backup.sql

# View database in browser
wrangler d1 time-travel <database-name>

# Start local development server
wrangler dev

# Deploy to production
wrangler deploy
```

## Migration Workflow

### Initial Setup

1. **Create D1 Databases**

```bash
# Development database
wrangler d1 create refine-sqlx-db-dev

# Production database
wrangler d1 create refine-sqlx-db-prod
```

Save the output database IDs to your `.env` and `wrangler.toml`.

2. **Set Environment Variables**

```bash
export CLOUDFLARE_ACCOUNT_ID="abc123..."
export CLOUDFLARE_DATABASE_ID="def456..."
export CLOUDFLARE_API_TOKEN="ghi789..."
```

3. **Define Your Schema**

Edit `example/schema.ts`:

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### Development Workflow

1. **Generate Migration**

```bash
bun run db:generate:d1
```

This creates a SQL file in `drizzle/d1/0000_*.sql`.

2. **Review Generated SQL**

```bash
cat drizzle/d1/0000_*.sql
```

Example output:

```sql
CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `created_at` integer NOT NULL
);
```

3. **Test Locally First**

```bash
# Apply to local development
wrangler dev

# Test your API endpoints
curl http://localhost:8787/users
```

4. **Apply to Development D1**

```bash
# Option 1: Using migration script (recommended)
D1_DATABASE_NAME=refine-sqlx-db-dev bun run db:migrate:d1

# Option 2: Using wrangler directly
wrangler d1 execute refine-sqlx-db-dev --file=./drizzle/d1/0000_initial.sql
```

5. **Verify Migration**

```bash
# Check tables
wrangler d1 execute refine-sqlx-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'"

# Query data
wrangler d1 execute refine-sqlx-db-dev --command="SELECT * FROM users LIMIT 5"
```

### Production Deployment

1. **Test Thoroughly**

```bash
bun test
bun run test:integration-bun
```

2. **Backup Production Database**

```bash
wrangler d1 export refine-sqlx-db-prod --output=backup-$(date +%Y%m%d-%H%M%S).sql
```

3. **Preview Migration (Dry Run)**

```bash
DRY_RUN=true D1_DATABASE_NAME=refine-sqlx-db-prod bun run db:migrate:d1
```

4. **Apply Migration**

```bash
D1_DATABASE_NAME=refine-sqlx-db-prod bun run db:migrate:d1
```

5. **Verify Migration**

```bash
wrangler d1 execute refine-sqlx-db-prod --command="SELECT name FROM sqlite_master WHERE type='table'"
```

6. **Deploy Worker**

```bash
bun run build
wrangler deploy --env production
```

### Schema Changes Workflow

When modifying existing schema:

1. **Update Schema** (`example/schema.ts`)

```typescript
// Add new column
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull(), // NEW
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

2. **Generate Migration**

```bash
bun run db:generate:d1
```

Drizzle will generate an ALTER TABLE statement.

3. **Review Migration**

```bash
cat drizzle/d1/0001_*.sql
```

Example:

```sql
ALTER TABLE `users` ADD `status` text NOT NULL DEFAULT 'active';
```

4. **Apply to Development**

```bash
D1_DATABASE_NAME=refine-sqlx-db-dev bun run db:migrate:d1
```

5. **Test Changes**

```bash
wrangler dev
# Test your endpoints
```

6. **Deploy to Production** (follow production deployment steps above)

## Best Practices

### 1. Version Control

```bash
# Always commit migration files
git add drizzle/d1/
git commit -m "feat: add user status column"
```

### 2. Never Skip Migrations

❌ **Don't do this:**

```bash
# Dangerous: overwrites schema without migration history
bun run db:push:d1
```

✅ **Do this instead:**

```bash
# Safe: creates migration history
bun run db:generate:d1
bun run db:migrate:d1
```

### 3. Test Before Production

Always test migrations in this order:

1. Local SQLite (`wrangler dev`)
2. Development D1 database
3. Production D1 database

### 4. Backup Before Major Changes

```bash
# Backup before applying migrations
wrangler d1 export refine-sqlx-db-prod --output=backup-before-migration.sql

# Apply migration
bun run db:migrate:d1

# If something goes wrong, restore:
wrangler d1 execute refine-sqlx-db-prod --file=backup-before-migration.sql
```

### 5. Use Environment-Specific Databases

Never test on production! Use separate databases:

```toml
# wrangler.toml
[env.development.d1_databases]
binding = "DB"
database_name = "refine-sqlx-db-dev"
database_id = "dev-database-id"

[env.production.d1_databases]
binding = "DB"
database_name = "refine-sqlx-db-prod"
database_id = "prod-database-id"
```

### 6. Review Generated SQL

Always review migrations before applying:

```bash
cat drizzle/d1/0001_*.sql
```

Check for:

- Unexpected DROP TABLE statements
- Missing NOT NULL constraints on new columns
- Data type changes that might lose data

## Troubleshooting

### Problem: "Failed to connect to D1 database"

**Causes:**

- Invalid credentials
- API token lacks permissions
- Wrong database ID

**Solution:**

```bash
# Verify credentials
echo $CLOUDFLARE_ACCOUNT_ID
echo $CLOUDFLARE_DATABASE_ID
echo $CLOUDFLARE_API_TOKEN

# Test wrangler connection
wrangler d1 list

# Test database access
wrangler d1 execute <database-name> --command="SELECT 1"
```

### Problem: "Table already exists"

**Cause:** Running migrations multiple times or mixing manual SQL with migrations

**Solution:**

```bash
# Check existing tables
wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table'"

# Option 1: Drop and recreate (dev only!)
wrangler d1 execute DB --command="DROP TABLE IF EXISTS users"
bun run db:migrate:d1

# Option 2: Manual fix
wrangler d1 execute DB --command="ALTER TABLE users ADD COLUMN status TEXT"
```

### Problem: "Migration fails but leaves partial changes"

**Cause:** D1 transactions have limitations

**Solution:**

```bash
# Restore from backup
wrangler d1 execute DB --file=backup.sql

# Or manually fix
wrangler d1 execute DB --command="DROP TABLE IF EXISTS <problematic-table>"
```

### Problem: "drizzle-kit not found"

**Solution:**

```bash
# Install drizzle-kit
bun add -D drizzle-kit

# Verify installation
bunx drizzle-kit --version
```

### Problem: "Authentication error"

**Cause:** Invalid or expired API token

**Solution:**

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create new token with permissions:
   - `D1:Edit`
   - `Workers Scripts:Edit`
3. Update `.env` with new token
4. Re-run migration

### Problem: "UNIQUE constraint failed"

**Cause:** Duplicate data when adding UNIQUE constraint

**Solution:**

```bash
# Find duplicates
wrangler d1 execute DB --command="
  SELECT email, COUNT(*) as count
  FROM users
  GROUP BY email
  HAVING count > 1
"

# Remove duplicates manually
wrangler d1 execute DB --command="
  DELETE FROM users
  WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM users
    GROUP BY email
  )
"

# Re-run migration
bun run db:migrate:d1
```

## Advanced Usage

### Running Migrations in CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Run migrations
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_DATABASE_ID: ${{ secrets.CLOUDFLARE_DATABASE_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          D1_DATABASE_NAME: refine-sqlx-db-prod
        run: bun run db:migrate:d1

      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: bun run build && wrangler deploy --env production
```

### Using Drizzle Studio

Visual database management:

```bash
# Open Drizzle Studio for D1
bun run db:studio:d1

# Navigate to http://localhost:4983
```

Features:

- Browse tables and data
- Edit records visually
- View relationships
- Generate SQL queries

## Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit CLI Reference](https://orm.drizzle.team/kit-docs/overview)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [refine-sqlx GitHub](https://github.com/medz/refine-sqlx)

## Getting Help

If you encounter issues:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review [D1 Example documentation](./D1_EXAMPLE.md)
3. Check [Cloudflare D1 Status](https://www.cloudflarestatus.com/)
4. Open an issue on [GitHub](https://github.com/medz/refine-sqlx/issues)

---

**Last Updated**: 2025-Q1
