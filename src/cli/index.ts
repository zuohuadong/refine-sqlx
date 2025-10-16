#!/usr/bin/env node

/**
 * refine-sqlx CLI
 * Commands:
 * - generate-types: Generate TypeScript types from Drizzle schema
 * - migrate: Run database migrations
 */

import { Command } from 'commander';
import { generateTypesCommand } from './commands/generate-types';

const program = new Command();

program
  .name('refine-sqlx')
  .description('CLI tools for refine-sqlx')
  .version('0.5.0');

// Generate Types command
program
  .command('generate-types')
  .description('Generate TypeScript types from Drizzle schema')
  .option('-s, --schema <path>', 'Path to Drizzle schema file', './src/schema.ts')
  .option('-o, --output <path>', 'Output file path', './src/types/resources.generated.ts')
  .option('-f, --format <format>', 'Output format (refine | raw)', 'refine')
  .option('-w, --watch', 'Watch for schema changes', false)
  .action(generateTypesCommand);

// Parse arguments
program.parse();
