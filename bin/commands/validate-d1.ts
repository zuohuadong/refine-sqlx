/**
 * Validate D1 command - Validate D1 configuration
 */
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import ora from 'ora';
import chalk from 'chalk';

interface ValidateD1Options {
  config?: string;
  checkConnection?: boolean;
}

interface DrizzleConfig {
  schema?: string;
  out?: string;
  dialect?: string;
  driver?: string;
  dbCredentials?: {
    accountId?: string;
    databaseId?: string;
    token?: string;
  };
}

export async function validateD1(options: ValidateD1Options) {
  console.log(chalk.bold.blue('\n🔍 Validating D1 Configuration\n'));

  const configPath = options.config || './drizzle.config.d1.ts';
  const spinner = ora('Loading configuration...').start();

  try {
    // Check if config file exists
    if (!existsSync(configPath)) {
      spinner.fail(chalk.red(`Configuration file not found: ${configPath}`));
      console.log(
        chalk.yellow('\nTip:'),
        'Run',
        chalk.cyan('npx refine-sqlx init --platform=d1'),
        'to create a configuration file',
      );
      process.exit(1);
    }

    spinner.text = 'Reading configuration file...';

    // Load config file
    const config = await loadConfig(configPath);

    spinner.succeed(chalk.green('Configuration file loaded'));

    // Validate configuration
    const validationResults: Array<{ name: string; status: boolean; message?: string }> = [];

    // Check dialect
    validationResults.push({
      name: 'Dialect',
      status: config.dialect === 'sqlite',
      message: config.dialect !== 'sqlite' ? `Expected 'sqlite', got '${config.dialect}'` : undefined,
    });

    // Check driver
    validationResults.push({
      name: 'Driver',
      status: config.driver === 'd1-http',
      message: config.driver !== 'd1-http' ? `Expected 'd1-http', got '${config.driver}'` : undefined,
    });

    // Check schema path
    validationResults.push({
      name: 'Schema',
      status: !!config.schema,
      message: !config.schema ? 'Schema path not configured' : undefined,
    });

    // Check output path
    validationResults.push({
      name: 'Output',
      status: !!config.out,
      message: !config.out ? 'Output path not configured' : undefined,
    });

    // Check environment variables
    const accountId = config.dbCredentials?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = config.dbCredentials?.databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = config.dbCredentials?.token || process.env.CLOUDFLARE_API_TOKEN;

    validationResults.push({
      name: 'Account ID',
      status: !!accountId && accountId !== 'your-account-id',
      message: !accountId ? 'CLOUDFLARE_ACCOUNT_ID not set' : accountId === 'your-account-id' ? 'Placeholder value detected' : undefined,
    });

    validationResults.push({
      name: 'Database ID',
      status: !!databaseId && databaseId !== 'your-database-id',
      message: !databaseId ? 'CLOUDFLARE_DATABASE_ID not set' : databaseId === 'your-database-id' ? 'Placeholder value detected' : undefined,
    });

    validationResults.push({
      name: 'API Token',
      status: !!token && token !== 'your-api-token',
      message: !token ? 'CLOUDFLARE_API_TOKEN not set' : token === 'your-api-token' ? 'Placeholder value detected' : undefined,
    });

    // Display results
    console.log(chalk.bold('\n✅ Validation Results:\n'));

    validationResults.forEach(({ name, status, message }) => {
      const icon = status ? chalk.green('✓') : chalk.red('✗');
      const statusText = status ? chalk.green('PASS') : chalk.red('FAIL');
      console.log(`  ${icon} ${name.padEnd(15)} ${statusText}`);
      if (message) {
        console.log(`     ${chalk.gray(message)}`);
      }
    });

    const allValid = validationResults.every((r) => r.status);

    if (!allValid) {
      console.log(chalk.bold.red('\n❌ Validation failed'));
      console.log(chalk.yellow('\n💡 Tips:\n'));
      console.log(
        chalk.gray('1. Set environment variables in .env or export them:'),
      );
      console.log(
        chalk.cyan('   export CLOUDFLARE_ACCOUNT_ID="your-account-id"'),
      );
      console.log(
        chalk.cyan('   export CLOUDFLARE_DATABASE_ID="your-database-id"'),
      );
      console.log(chalk.cyan('   export CLOUDFLARE_API_TOKEN="your-api-token"'));
      console.log(
        chalk.gray('\n2. Get your credentials from Cloudflare dashboard:'),
      );
      console.log(chalk.cyan('   https://dash.cloudflare.com'));
      console.log(chalk.gray('\n3. Create a D1 database with wrangler:'));
      console.log(chalk.cyan('   wrangler d1 create my-database'));
      process.exit(1);
    }

    console.log(chalk.bold.green('\n✅ All validations passed!'));

    // Test connection if requested
    if (options.checkConnection) {
      await testD1Connection(accountId!, databaseId!, token!);
    }

    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(error);
    process.exit(1);
  }
}

async function loadConfig(configPath: string): Promise<DrizzleConfig> {
  try {
    // Convert to file URL for dynamic import
    const fileUrl = pathToFileURL(configPath).href;
    const module = await import(fileUrl);
    return module.default || module;
  } catch (error) {
    throw new Error(`Failed to load config file: ${error}`);
  }
}

async function testD1Connection(
  accountId: string,
  databaseId: string,
  token: string,
) {
  const spinner = ora('Testing D1 database connection...').start();

  try {
    // Use Cloudflare API to check database existence
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      spinner.fail(chalk.red('Failed to connect to D1 database'));
      console.log(chalk.gray('\nAPI Response:'));
      console.log(JSON.stringify(error, null, 2));
      return;
    }

    const data: any = await response.json();

    spinner.succeed(chalk.green('Successfully connected to D1 database'));
    console.log(chalk.bold('\n📊 Database Info:\n'));
    console.log(`  Name: ${chalk.cyan(data.result?.name || 'N/A')}`);
    console.log(`  ID:   ${chalk.cyan(databaseId)}`);
    console.log(
      `  Size: ${chalk.cyan(formatBytes(data.result?.file_size || 0))}`,
    );
  } catch (error) {
    spinner.fail(chalk.red('Connection test failed'));
    console.error(error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
