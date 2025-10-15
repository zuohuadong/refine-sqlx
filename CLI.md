# refine-sqlx CLI Tools

Command-line interface for improving the development experience with refine-sqlx.

## Installation

```bash
npm install -g refine-sqlx
# or
npx refine-sqlx [command]
```

## Commands

### `init` - Initialize Project

Initialize a new refine-sqlx project with platform-specific configuration.

```bash
npx refine-sqlx init [options]
```

**Options:**

- `--platform <platform>` - Platform to use: `d1`, `bun`, `node`, `better-sqlite3` (default: `d1`)
- `--typescript` - Use TypeScript (default: `true`)
- `--example` - Include example schema and data (default: `false`)

**Examples:**

```bash
# Initialize with Cloudflare D1
npx refine-sqlx init --platform=d1 --example

# Initialize with Bun SQLite
npx refine-sqlx init --platform=bun

# Initialize with Node.js native SQLite
npx refine-sqlx init --platform=node
```

**What it does:**

- Creates `drizzle.config.ts` for your platform
- Generates basic schema in `src/schema/index.ts`
- Creates `.env.example` with required environment variables
- Sets up project structure (`src/schema`, `drizzle` directories)

---

### `scaffold` - Generate Schema Templates

Generate Drizzle ORM schema templates for specified tables.

```bash
npx refine-sqlx scaffold <tables...> [options]
```

**Options:**

- `-o, --output <path>` - Output directory (default: `./src/schema`)
- `--timestamps` - Add createdAt and updatedAt fields (default: `true`)
- `--soft-delete` - Add deletedAt field for soft deletes (default: `false`)

**Examples:**

```bash
# Generate schema for users and posts tables
npx refine-sqlx scaffold users posts

# Generate with soft delete support
npx refine-sqlx scaffold products --soft-delete

# Custom output directory
npx refine-sqlx scaffold categories tags -o ./database/schema
```

**Generated files:**

- `src/schema/users.ts`
- `src/schema/posts.ts`
- `src/schema/index.ts` (updated to export all tables)

---

### `validate-d1` - Validate D1 Configuration

Validate your Cloudflare D1 configuration and credentials.

```bash
npx refine-sqlx validate-d1 [options]
```

**Options:**

- `-c, --config <path>` - Path to drizzle.config.ts (default: `./drizzle.config.d1.ts`)
- `--check-connection` - Test D1 database connection (default: `false`)

**Examples:**

```bash
# Validate configuration
npx refine-sqlx validate-d1

# Validate and test connection
npx refine-sqlx validate-d1 --check-connection

# Custom config path
npx refine-sqlx validate-d1 -c ./config/drizzle.config.ts
```

**What it checks:**

- ✓ Dialect is set to `sqlite`
- ✓ Driver is set to `d1-http`
- ✓ Schema path is configured
- ✓ Output path is configured
- ✓ `CLOUDFLARE_ACCOUNT_ID` is set
- ✓ `CLOUDFLARE_DATABASE_ID` is set
- ✓ `CLOUDFLARE_API_TOKEN` is set
- ✓ D1 database connection (if `--check-connection`)

---

### `introspect` - Database Introspection

Introspect an existing D1 database and generate Drizzle schema from it.

```bash
npx refine-sqlx introspect [options]
```

**Options:**

- `--from-d1` - Introspect from D1 database (required)
- `--database-id <id>` - D1 database ID (or use `CLOUDFLARE_DATABASE_ID` env var)
- `--account-id <id>` - Cloudflare account ID (or use `CLOUDFLARE_ACCOUNT_ID` env var)
- `--token <token>` - Cloudflare API token (or use `CLOUDFLARE_API_TOKEN` env var)
- `-o, --output <path>` - Output file path (default: `./src/schema/generated.ts`)

**Examples:**

```bash
# Introspect using environment variables
npx refine-sqlx introspect --from-d1

# Introspect with explicit credentials
npx refine-sqlx introspect --from-d1 \
  --account-id=abc123 \
  --database-id=xyz789 \
  --token=your-token

# Custom output path
npx refine-sqlx introspect --from-d1 -o ./src/db/schema.ts
```

**What it does:**

- Connects to your D1 database via Cloudflare API
- Reads table structures (columns, types, constraints)
- Generates type-safe Drizzle ORM schema
- Creates TypeScript types for each table

---

## Workflow Examples

### Setting up a new D1 project

```bash
# 1. Initialize project
npx refine-sqlx init --platform=d1 --example

# 2. Set environment variables
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_DATABASE_ID="your-database-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

# 3. Validate configuration
npx refine-sqlx validate-d1 --check-connection

# 4. Generate migrations
npm run db:generate:d1

# 5. Apply migrations
npm run db:migrate:d1
```

### Adding new tables

```bash
# 1. Generate schema templates
npx refine-sqlx scaffold products categories reviews --timestamps

# 2. Customize the schemas in src/schema/
# 3. Generate migrations
npm run db:generate

# 4. Apply migrations
npm run db:push
```

### Importing existing database

```bash
# 1. Introspect existing D1 database
npx refine-sqlx introspect --from-d1 -o ./src/schema/imported.ts

# 2. Review and customize the generated schema
# 3. Use in your data provider
```

---

## Environment Variables

### For D1 Platform

Required environment variables:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_DATABASE_ID=your-database-id
CLOUDFLARE_API_TOKEN=your-api-token
```

**How to get these:**

1. **Account ID**: Found in Cloudflare dashboard URL or account settings
2. **Database ID**: Run `wrangler d1 list` to see your databases
3. **API Token**: Create at https://dash.cloudflare.com/profile/api-tokens
   - Template: "Edit Cloudflare Workers"
   - Permissions: Account.D1 (Edit)

### For Local Platforms (Bun, Node, better-sqlite3)

```bash
DATABASE_URL=./data.db
```

---

## Tips

1. **Use `.env` files**: Store credentials in `.env` and load with `dotenv`
2. **Git ignore credentials**: Add `.env` to `.gitignore`
3. **Validate before migrations**: Run `validate-d1` before generating migrations
4. **Review generated schemas**: Always customize scaffolded schemas for your needs
5. **Version control**: Commit generated migrations to track schema changes

---

## Troubleshooting

### "Configuration file not found"

Make sure you've run `init` or have a `drizzle.config.ts` file.

### "Missing D1 credentials"

Set the required environment variables or pass them as CLI options.

### "Failed to connect to D1 database"

1. Check your API token has D1 edit permissions
2. Verify database ID is correct (`wrangler d1 list`)
3. Ensure account ID matches your Cloudflare account

### "No tables found in database"

The database is empty. Create tables first using migrations or SQL.

---

## Related Commands

```bash
# Generate migrations
npm run db:generate
npm run db:generate:d1

# Apply migrations
npm run db:push
npm run db:push:d1
npm run db:migrate:d1

# Open Drizzle Studio
npm run db:studio
npm run db:studio:d1
```

---

## Support

For issues and feature requests, visit:
https://github.com/medz/refine-sqlx/issues
