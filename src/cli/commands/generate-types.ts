/**
 * Generate TypeScript types from Drizzle schema
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import ora from 'ora';
import chalk from 'chalk';

interface GenerateTypesOptions {
  schema: string;
  output: string;
  format: 'refine' | 'raw';
  watch?: boolean;
}

/**
 * Generate TypeScript types command
 */
export async function generateTypesCommand(options: GenerateTypesOptions) {
  const spinner = ora('Analyzing Drizzle schema...').start();

  try {
    const schemaPath = resolve(process.cwd(), options.schema);
    const outputPath = resolve(process.cwd(), options.output);

    // Check if schema file exists
    if (!existsSync(schemaPath)) {
      spinner.fail(chalk.red(`Schema file not found: ${schemaPath}`));
      process.exit(1);
    }

    // Import schema dynamically
    spinner.text = 'Loading schema...';
    const schemaModule = await import(schemaPath);
    const schema = schemaModule.default || schemaModule;

    // Extract table definitions
    spinner.text = 'Extracting table definitions...';
    const tables = extractTables(schema);

    if (tables.length === 0) {
      spinner.fail(chalk.red('No tables found in schema'));
      process.exit(1);
    }

    // Generate TypeScript code
    spinner.text = 'Generating TypeScript types...';
    const code = generateTypeScriptCode(tables, options.format, schemaPath);

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    writeFileSync(outputPath, code, 'utf-8');

    spinner.succeed(
      chalk.green(
        `✓ Generated types for ${tables.length} table(s) → ${outputPath}`,
      ),
    );

    // Print summary
    console.log(chalk.dim('\nGenerated types for:'));
    tables.forEach((table) => {
      console.log(chalk.dim(`  • ${table.name}`));
    });

    if (options.watch) {
      console.log(chalk.yellow('\n👀 Watching for changes...'));
      watchSchema(schemaPath, async () => {
        await generateTypesCommand({ ...options, watch: false });
      });
    }
  } catch (error: any) {
    spinner.fail(chalk.red(`Failed to generate types: ${error.message}`));
    console.error(error);
    process.exit(1);
  }
}

/**
 * Extract table definitions from schema
 */
function extractTables(schema: Record<string, any>): Array<{
  name: string;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
}> {
  const tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }> = [];

  for (const [key, value] of Object.entries(schema)) {
    // Check if it's a Drizzle table
    if (
      value &&
      typeof value === 'object' &&
      ('_' in value || Symbol.for('drizzle:Name') in value)
    ) {
      const tableName = key;
      const columns = extractColumns(value);

      tables.push({
        name: tableName,
        columns,
      });
    }
  }

  return tables;
}

/**
 * Extract column definitions from table
 */
function extractColumns(
  table: any,
): Array<{ name: string; type: string; nullable: boolean }> {
  const columns: Array<{ name: string; type: string; nullable: boolean }> = [];

  // Try to access Drizzle's internal column structure
  const tableColumns = table._ || table;

  // Get columns from different Drizzle versions
  const columnsObj =
    tableColumns.columns || tableColumns._.columns || tableColumns;

  for (const [colName, column] of Object.entries(columnsObj)) {
    if (column && typeof column === 'object') {
      const col: any = column;

      // Detect type
      let tsType = 'unknown';
      const columnType = col.dataType || col.columnType || '';

      if (columnType.includes('int') || columnType.includes('number')) {
        tsType = 'number';
      } else if (columnType.includes('text') || columnType.includes('string')) {
        tsType = 'string';
      } else if (columnType.includes('bool')) {
        tsType = 'boolean';
      } else if (columnType.includes('timestamp') || columnType.includes('date')) {
        tsType = 'Date';
      } else if (columnType.includes('json')) {
        tsType = 'any';
      }

      const nullable = col.notNull === false || !col.notNull;

      columns.push({
        name: colName,
        type: tsType,
        nullable,
      });
    }
  }

  return columns;
}

/**
 * Generate TypeScript code
 */
function generateTypeScriptCode(
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }>,
  format: 'refine' | 'raw',
  schemaPath: string,
): string {
  const imports = [
    `/**`,
    ` * Auto-generated TypeScript types from Drizzle schema`,
    ` * Generated at: ${new Date().toISOString()}`,
    ` * DO NOT EDIT MANUALLY - Changes will be overwritten`,
    ` */`,
    ``,
    `import type { BaseRecord } from '@refinedev/core';`,
    `import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';`,
    `import * as schema from '${getRelativeImportPath(schemaPath)}';`,
    ``,
  ].join('\n');

  const resourceTypes = tables
    .map((table) => {
      const interfaceName = toPascalCase(table.name);
      const fields = table.columns
        .map((col) => {
          const type = col.nullable ? `${col.type} | null` : col.type;
          return `  ${col.name}: ${type};`;
        })
        .join('\n');

      return [
        `/**`,
        ` * ${interfaceName} resource type`,
        ` */`,
        `export interface ${interfaceName} extends BaseRecord {`,
        fields,
        `}`,
      ].join('\n');
    })
    .join('\n\n');

  const insertTypes = tables
    .map((table) => {
      const typeName = toPascalCase(table.name);
      return `export type ${typeName}Insert = InferInsertModel<typeof schema.${table.name}>;`;
    })
    .join('\n');

  const resourceNameType = `export type ResourceName = ${tables.map((t) => `'${t.name}'`).join(' | ')};`;

  const resourceMap = [
    `/**`,
    ` * Resource type map`,
    ` */`,
    `export interface ResourceMap {`,
    ...tables.map((t) => `  ${t.name}: ${toPascalCase(t.name)};`),
    `}`,
  ].join('\n');

  const helperFunctions = [
    `/**`,
    ` * Type-safe resource helper`,
    ` * @example`,
    ` * const user = getResourceType('users'); // Type: User`,
    ` */`,
    `export function getResourceType<T extends ResourceName>(`,
    `  resource: T,`,
    `): ResourceMap[T] {`,
    `  return null as any;`,
    `}`,
  ].join('\n');

  return [
    imports,
    resourceTypes,
    '',
    '// Insert types (for create operations)',
    insertTypes,
    '',
    '// Resource name type',
    resourceNameType,
    '',
    resourceMap,
    '',
    helperFunctions,
  ].join('\n');
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Get relative import path
 */
function getRelativeImportPath(schemaPath: string): string {
  // Simplify for now - in production, use proper path resolution
  return schemaPath.replace(process.cwd(), '.').replace(/\.ts$/, '');
}

/**
 * Watch schema file for changes
 */
function watchSchema(schemaPath: string, callback: () => void) {
  import('fs').then(({ watch }) => {
    watch(schemaPath, (eventType) => {
      if (eventType === 'change') {
        console.log(chalk.blue('\n📝 Schema changed, regenerating...'));
        callback();
      }
    });
  });
}
