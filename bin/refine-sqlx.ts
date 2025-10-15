#!/usr/bin/env node
/**
 * refine-sqlx CLI
 * Command-line interface for refine-sqlx development
 */
import { Command } from 'commander';
import { init } from './commands/init';
import { introspect } from './commands/introspect';
import { scaffold } from './commands/scaffold';
import { validateD1 } from './commands/validate-d1';

const program = new Command();

program
  .name('refine-sqlx')
  .description('CLI tools for refine-sqlx development')
  .version('0.3.0');

// Init command
program
  .command('init')
  .description('Initialize a new refine-sqlx project')
  .option(
    '--platform <platform>',
    'Platform to use (d1, bun, node, better-sqlite3)',
    'd1',
  )
  .option('--typescript', 'Use TypeScript', true)
  .option('--example', 'Include example schema and data', false)
  .action(init);

// Scaffold command
program
  .command('scaffold <tables...>')
  .description('Generate Drizzle schema templates for specified tables')
  .option(
    '-o, --output <path>',
    'Output directory for generated files',
    './src/schema',
  )
  .option('--timestamps', 'Add createdAt and updatedAt fields', true)
  .option('--soft-delete', 'Add deletedAt field for soft deletes', false)
  .action(scaffold);

// Validate D1 command
program
  .command('validate-d1')
  .description('Validate D1 configuration and credentials')
  .option(
    '-c, --config <path>',
    'Path to drizzle.config.ts',
    './drizzle.config.d1.ts',
  )
  .option('--check-connection', 'Test D1 database connection', false)
  .action(validateD1);

// Introspect command
program
  .command('introspect')
  .description('Introspect D1 database and generate Drizzle schema')
  .option('--from-d1', 'Introspect from D1 database', false)
  .option('--database-id <id>', 'D1 database ID')
  .option('--account-id <id>', 'Cloudflare account ID')
  .option('--token <token>', 'Cloudflare API token')
  .option(
    '-o, --output <path>',
    'Output file path',
    './src/schema/generated.ts',
  )
  .action(introspect);

program.parse(process.argv);
