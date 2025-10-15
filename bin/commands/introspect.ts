/**
 * Introspect command - Introspect D1 database and generate schema
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { $ } from 'bun';

interface IntrospectOptions {
  fromD1?: boolean;
  databaseId?: string;
  accountId?: string;
  token?: string;
  output?: string;
}

interface TableInfo {
  name: string;
  sql: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export async function introspect(options: IntrospectOptions) {
  console.log(chalk.bold.blue('\n🔎 Database Introspection\n'));

  if (!options.fromD1) {
    console.log(chalk.red('Error: Only D1 introspection is currently supported'));
    console.log(chalk.gray('Usage: npx refine-sqlx introspect --from-d1 --database-id=xxx'));
    process.exit(1);
  }

  const accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = options.databaseId || process.env.CLOUDFLARE_DATABASE_ID;
  const token = options.token || process.env.CLOUDFLARE_API_TOKEN;
  const outputPath = options.output || './src/schema/generated.ts';

  // Validate credentials
  if (!accountId || !databaseId || !token) {
    console.log(chalk.red('Error: Missing D1 credentials'));
    console.log(chalk.yellow('\nRequired:\n'));
    console.log('  --account-id or CLOUDFLARE_ACCOUNT_ID');
    console.log('  --database-id or CLOUDFLARE_DATABASE_ID');
    console.log('  --token or CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  const spinner = ora('Connecting to D1 database...').start();

  try {
    // Get table list from D1
    spinner.text = 'Fetching table list...';
    const tables = await getD1Tables(accountId, databaseId, token);

    if (tables.length === 0) {
      spinner.warn(chalk.yellow('No tables found in database'));
      console.log(chalk.gray('\nThe database appears to be empty.'));
      console.log(chalk.gray('Create tables first, then run introspect again.'));
      process.exit(0);
    }

    spinner.text = `Found ${tables.length} table(s), introspecting schema...`;

    // Introspect each table
    const schemaDefinitions: string[] = [];

    for (const table of tables) {
      const columns = await getD1TableSchema(
        accountId,
        databaseId,
        token,
        table.name,
      );
      const schemaDef = generateTableSchema(table.name, columns);
      schemaDefinitions.push(schemaDef);
    }

    spinner.text = 'Generating schema file...';

    // Generate schema file
    const schemaContent = generateSchemaFile(schemaDefinitions);

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputPath, schemaContent);

    spinner.succeed(chalk.green('Schema introspection completed!'));

    // Display results
    console.log(chalk.bold('\n📊 Introspection Results:\n'));
    console.log(`  Tables found: ${chalk.cyan(tables.length)}`);
    console.log(`  Output file:  ${chalk.cyan(outputPath)}`);

    console.log(chalk.bold('\n📋 Tables:\n'));
    tables.forEach((table) => {
      console.log(`  ${chalk.cyan('•')} ${table.name}`);
    });

    console.log(chalk.bold('\n💡 Next steps:\n'));
    console.log(
      chalk.cyan('1.'),
      'Review the generated schema in',
      chalk.gray(outputPath),
    );
    console.log(
      chalk.cyan('2.'),
      'Add relations between tables if needed',
    );
    console.log(
      chalk.cyan('3.'),
      'Import the schema in your data provider setup',
    );
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Introspection failed'));
    console.error(error);
    process.exit(1);
  }
}

async function getD1Tables(
  accountId: string,
  databaseId: string,
  token: string,
): Promise<TableInfo[]> {
  const query = `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`;

  const result = await executeD1Query(accountId, databaseId, token, query);
  return result;
}

async function getD1TableSchema(
  accountId: string,
  databaseId: string,
  token: string,
  tableName: string,
): Promise<ColumnInfo[]> {
  const query = `PRAGMA table_info(${tableName})`;
  const result = await executeD1Query(accountId, databaseId, token, query);
  return result;
}

async function executeD1Query(
  accountId: string,
  databaseId: string,
  token: string,
  query: string,
): Promise<any[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`D1 API error: ${JSON.stringify(error)}`);
  }

  const data: any = await response.json();

  if (!data.success || !data.result || data.result.length === 0) {
    throw new Error('Failed to execute D1 query');
  }

  return data.result[0].results || [];
}

function generateTableSchema(tableName: string, columns: ColumnInfo[]): string {
  const fields: string[] = [];

  for (const col of columns) {
    const fieldDef = generateFieldDefinition(col, columns);
    fields.push(`  ${fieldDef}`);
  }

  const singularName = tableName.endsWith('s') ? tableName.slice(0, -1) : tableName;
  const typeName = toPascalCase(singularName);

  return `/**
 * ${typeName} table
 */
export const ${tableName} = sqliteTable('${tableName}', {
${fields.join(',\n')}
});

export type ${typeName} = typeof ${tableName}.$inferSelect;
export type New${typeName} = typeof ${tableName}.$inferInsert;
`;
}

function generateFieldDefinition(col: ColumnInfo, allColumns: ColumnInfo[]): string {
  const sqlType = col.type.toUpperCase();
  let drizzleType: string;
  let options: string[] = [];

  // Map SQL types to Drizzle types
  if (sqlType.includes('INT')) {
    drizzleType = 'integer';

    // Check if it's a timestamp field
    if (col.name.includes('_at') || col.name.includes('At')) {
      options.push("{ mode: 'timestamp' }");
    }
  } else if (sqlType.includes('TEXT') || sqlType.includes('VARCHAR') || sqlType.includes('CHAR')) {
    drizzleType = 'text';
  } else if (sqlType.includes('REAL') || sqlType.includes('FLOAT') || sqlType.includes('DOUBLE')) {
    drizzleType = 'real';
  } else if (sqlType.includes('BLOB')) {
    drizzleType = 'blob';
  } else {
    drizzleType = 'text'; // Default to text
  }

  const optionsStr = options.length > 0 ? `(${options.join(', ')})` : '';
  let fieldDef = `${col.name}: ${drizzleType}('${col.name}'${optionsStr})`;

  // Add primary key
  if (col.pk === 1) {
    // Check if it's auto-increment
    const isAutoIncrement = col.type.toUpperCase().includes('AUTOINCREMENT') ||
                            (col.pk === 1 && drizzleType === 'integer');
    if (isAutoIncrement) {
      fieldDef += '.primaryKey({ autoIncrement: true })';
    } else {
      fieldDef += '.primaryKey()';
    }
  }

  // Add not null constraint
  if (col.notnull === 1 && col.pk !== 1) {
    fieldDef += '.notNull()';
  }

  // Add default value
  if (col.dflt_value !== null && col.dflt_value !== undefined) {
    // Handle different default value types
    let defaultValue = col.dflt_value;

    if (defaultValue === 'CURRENT_TIMESTAMP' || defaultValue === "CURRENT_TIMESTAMP") {
      fieldDef += '.$defaultFn(() => new Date())';
    } else if (defaultValue === '0' || defaultValue === 0) {
      fieldDef += '.default(0)';
    } else if (defaultValue === '1' || defaultValue === 1) {
      fieldDef += '.default(1)';
    } else if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
      // String default
      const strValue = defaultValue.slice(1, -1);
      fieldDef += `.default('${strValue}')`;
    }
  }

  return fieldDef;
}

function generateSchemaFile(schemaDefinitions: string[]): string {
  const header = `/**
 * Generated schema from D1 database introspection
 * Generated on: ${new Date().toISOString()}
 *
 * ⚠️ This file is auto-generated. Review and customize as needed.
 */
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

`;

  return header + schemaDefinitions.join('\n');
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
