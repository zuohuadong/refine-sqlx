/**
 * Scaffold command - Generate Drizzle schema templates
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface ScaffoldOptions {
  output?: string;
  timestamps?: boolean;
  softDelete?: boolean;
}

export async function scaffold(tables: string[], options: ScaffoldOptions) {
  console.log(chalk.bold.blue('\n🏗️  Scaffolding Drizzle Schema\n'));

  if (tables.length === 0) {
    console.log(chalk.red('Error: Please specify at least one table name'));
    console.log(chalk.gray('Usage: npx refine-sqlx scaffold users posts'));
    process.exit(1);
  }

  const outputDir = options.output || './src/schema';
  const spinner = ora('Generating schema files...').start();

  try {
    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate schema for each table
    const generatedFiles: string[] = [];

    for (const tableName of tables) {
      const fileName = `${tableName}.ts`;
      const filePath = join(outputDir, fileName);
      const schemaContent = generateTableSchema(
        tableName,
        options.timestamps ?? true,
        options.softDelete ?? false,
      );

      writeFileSync(filePath, schemaContent);
      generatedFiles.push(filePath);
      spinner.text = `Generated ${fileName}`;
    }

    // Generate or update index.ts
    const indexPath = join(outputDir, 'index.ts');
    updateIndexFile(indexPath, tables);

    spinner.succeed(chalk.green('Schema files generated successfully!'));

    // Show generated files
    console.log(chalk.bold('\n📄 Generated files:\n'));
    generatedFiles.forEach((file) => {
      console.log(chalk.cyan('  ✓'), file);
    });
    console.log(chalk.cyan('  ✓'), indexPath);

    // Show next steps
    console.log(chalk.bold('\n📋 Next steps:\n'));
    console.log(
      chalk.cyan('1.'),
      'Review and customize the generated schema files',
    );
    console.log(
      chalk.cyan('2.'),
      'Add relations if needed (see Drizzle ORM docs)',
    );
    console.log(chalk.cyan('3.'), 'Generate migrations: npm run db:generate');
    console.log(chalk.cyan('4.'), 'Apply migrations: npm run db:push');
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate schema files'));
    console.error(error);
    process.exit(1);
  }
}

function generateTableSchema(
  tableName: string,
  timestamps: boolean,
  softDelete: boolean,
): string {
  const singularName =
    tableName.endsWith('s') ? tableName.slice(0, -1) : tableName;
  const pascalName = toPascalCase(singularName);

  let schema = `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * ${pascalName} table schema
 */
export const ${tableName} = sqliteTable('${tableName}', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // TODO: Add your fields here
  // Example:
  // name: text('name').notNull(),
  // email: text('email').notNull().unique(),
  // status: text('status', { enum: ['active', 'inactive'] }).default('active').notNull(),
  // age: integer('age'),
  // bio: text('bio'),
`;

  if (timestamps) {
    schema += `
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),`;
  }

  if (softDelete) {
    schema += `

  // Soft delete
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),`;
  }

  schema += `
});

/**
 * Type inference for ${pascalName}
 */
export type ${pascalName} = typeof ${tableName}.$inferSelect;
export type New${pascalName} = typeof ${tableName}.$inferInsert;
`;

  return schema;
}

function updateIndexFile(indexPath: string, tables: string[]) {
  let existingContent = '';
  const existingExports = new Set<string>();

  // Read existing index file if it exists
  if (existsSync(indexPath)) {
    existingContent = readFileSync(indexPath, 'utf-8');

    // Parse existing exports
    const exportRegex = /export \* from ['"]\.\/([^'"]+)['"]/g;
    let match;
    while ((match = exportRegex.exec(existingContent)) !== null) {
      existingExports.add(match[1]);
    }
  }

  // Generate new exports
  const newExports = tables.filter((table) => !existingExports.has(table));

  if (newExports.length === 0) {
    // No new exports needed
    return;
  }

  // Append new exports to existing content
  let indexContent = existingContent;
  if (indexContent && !indexContent.endsWith('\n')) {
    indexContent += '\n';
  }

  newExports.forEach((table) => {
    indexContent += `export * from './${table}';\n`;
  });

  writeFileSync(indexPath, indexContent);
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
