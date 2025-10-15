/**
 * Init command - Initialize a new refine-sqlx project
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import prompts from 'prompts';

interface InitOptions {
  platform?: 'd1' | 'bun' | 'node' | 'better-sqlite3';
  typescript?: boolean;
  example?: boolean;
}

export async function init(options: InitOptions) {
  console.log(chalk.bold.blue('\n🚀 refine-sqlx Project Initialization\n'));

  // Interactive prompts if options not provided
  const answers = await prompts([
    {
      type: options.platform ? null : 'select',
      name: 'platform',
      message: 'Select your platform:',
      choices: [
        { title: 'Cloudflare D1', value: 'd1' },
        { title: 'Bun SQLite', value: 'bun' },
        { title: 'Node.js SQLite (v24+)', value: 'node' },
        { title: 'better-sqlite3', value: 'better-sqlite3' },
      ],
      initial: 0,
    },
    {
      type: options.example === undefined ? 'confirm' : null,
      name: 'example',
      message: 'Include example schema and data?',
      initial: false,
    },
  ]);

  const platform = options.platform || answers.platform;
  const includeExample = options.example ?? answers.example ?? false;

  const spinner = ora('Setting up project structure...').start();

  try {
    // Create directories
    const dirs = ['src/schema', 'drizzle'];
    dirs.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        spinner.text = `Created ${dir}/`;
      }
    });

    // Generate platform-specific files
    switch (platform) {
      case 'd1':
        await generateD1Config(includeExample);
        break;
      case 'bun':
        await generateBunConfig(includeExample);
        break;
      case 'node':
        await generateNodeConfig(includeExample);
        break;
      case 'better-sqlite3':
        await generateBetterSqlite3Config(includeExample);
        break;
    }

    spinner.succeed(chalk.green('Project initialized successfully!'));

    // Show next steps
    console.log(chalk.bold('\n📋 Next steps:\n'));
    console.log(chalk.cyan('1.'), 'Review the generated configuration files');
    if (platform === 'd1') {
      console.log(chalk.cyan('2.'), 'Set environment variables for D1:');
      console.log(
        chalk.gray('   export CLOUDFLARE_ACCOUNT_ID="your-account-id"'),
      );
      console.log(
        chalk.gray('   export CLOUDFLARE_DATABASE_ID="your-database-id"'),
      );
      console.log(
        chalk.gray('   export CLOUDFLARE_API_TOKEN="your-api-token"'),
      );
      console.log(
        chalk.cyan('3.'),
        'Validate your D1 setup: npx refine-sqlx validate-d1',
      );
    }
    console.log(
      chalk.cyan(platform === 'd1' ? '4.' : '2.'),
      'Define your schema in src/schema/index.ts',
    );
    console.log(
      chalk.cyan(platform === 'd1' ? '5.' : '3.'),
      'Generate migrations: npm run db:generate',
    );
    console.log(
      chalk.cyan(platform === 'd1' ? '6.' : '4.'),
      'Apply migrations: npm run db:push',
    );
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Failed to initialize project'));
    console.error(error);
    process.exit(1);
  }
}

async function generateD1Config(includeExample: boolean) {
  // Generate drizzle.config.ts for D1
  const configContent = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
  verbose: true,
  strict: true,
});
`;

  writeFileSync('drizzle.config.ts', configContent);

  // Generate schema
  const schemaContent = includeExample
    ? getExampleSchema()
    : getBasicSchema();
  writeFileSync('src/schema/index.ts', schemaContent);

  // Generate .env.example
  const envExample = `# Cloudflare D1 Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_DATABASE_ID=your-database-id
CLOUDFLARE_API_TOKEN=your-api-token
`;
  writeFileSync('.env.example', envExample);

  // Generate wrangler.toml example
  const wranglerConfig = `name = "my-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your-database-id"
`;
  writeFileSync('wrangler.toml.example', wranglerConfig);
}

async function generateBunConfig(includeExample: boolean) {
  const configContent = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data.db',
  },
  verbose: true,
  strict: true,
});
`;

  writeFileSync('drizzle.config.ts', configContent);

  const schemaContent = includeExample
    ? getExampleSchema()
    : getBasicSchema();
  writeFileSync('src/schema/index.ts', schemaContent);

  const envExample = `DATABASE_URL=./data.db
`;
  writeFileSync('.env.example', envExample);
}

async function generateNodeConfig(includeExample: boolean) {
  const configContent = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data.db',
  },
  verbose: true,
  strict: true,
});
`;

  writeFileSync('drizzle.config.ts', configContent);

  const schemaContent = includeExample
    ? getExampleSchema()
    : getBasicSchema();
  writeFileSync('src/schema/index.ts', schemaContent);

  const envExample = `DATABASE_URL=./data.db
`;
  writeFileSync('.env.example', envExample);
}

async function generateBetterSqlite3Config(includeExample: boolean) {
  const configContent = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data.db',
  },
  verbose: true,
  strict: true,
});
`;

  writeFileSync('drizzle.config.ts', configContent);

  const schemaContent = includeExample
    ? getExampleSchema()
    : getBasicSchema();
  writeFileSync('src/schema/index.ts', schemaContent);

  const envExample = `DATABASE_URL=./data.db
`;
  writeFileSync('.env.example', envExample);
}

function getBasicSchema(): string {
  return `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Example table schema
 * Define your database tables here
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
`;
}

function getExampleSchema(): string {
  return `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Users table
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Posts table
 */
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  published: integer('published', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
`;
}
