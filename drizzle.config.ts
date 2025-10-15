import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema files location
  schema: './example/schema.ts',

  // Output directory for migrations
  out: './drizzle',

  // Database driver
  dialect: 'sqlite',

  // Optional: verbose logging
  verbose: true,

  // Optional: strict mode
  strict: true,
});
