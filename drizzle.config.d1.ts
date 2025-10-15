import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for Cloudflare D1
 *
 * This configuration enables:
 * - Remote D1 database access via HTTP API
 * - Migration generation for D1-compatible SQLite
 * - Schema introspection and diff generation
 *
 * @see https://orm.drizzle.team/kit-docs/config-reference
 * @see https://developers.cloudflare.com/d1/
 */
export default defineConfig({
  // Schema files location
  schema: './example/schema.ts',

  // Output directory for D1 migrations
  out: './drizzle/d1',

  // SQLite dialect (D1 uses SQLite)
  dialect: 'sqlite',

  // D1 HTTP API driver (requires Cloudflare credentials)
  driver: 'd1-http',

  // D1 database credentials
  // These should be set via environment variables
  dbCredentials: {
    // Cloudflare Account ID (from dashboard)
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,

    // D1 Database ID (from wrangler d1 list)
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,

    // Cloudflare API Token (with D1 edit permissions)
    // Create at: https://dash.cloudflare.com/profile/api-tokens
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },

  // Optional: verbose logging
  verbose: true,

  // Optional: strict mode for safer migrations
  strict: true,

  // Optional: tab width for generated SQL
  tablesFilter: undefined,

  // Optional: schema filter
  schemaFilter: undefined,
});

/**
 * Usage:
 *
 * 1. Set environment variables:
 *    export CLOUDFLARE_ACCOUNT_ID="your-account-id"
 *    export CLOUDFLARE_DATABASE_ID="your-database-id"
 *    export CLOUDFLARE_API_TOKEN="your-api-token"
 *
 * 2. Generate migrations:
 *    bun run db:generate:d1
 *
 * 3. Apply migrations:
 *    bun run db:migrate:d1
 *
 * 4. Push schema directly (development only):
 *    bun run db:push:d1
 */
