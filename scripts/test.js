#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

console.log(`Running tests with Node.js ${nodeVersion}`);

// Check if we're in CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (isCI) {
  console.log('Running in CI environment');
  
  // Set up temp directory for CI
  const tempDir = path.join(process.cwd(), 'temp-test-data');
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Set permissions
    fs.chmodSync(tempDir, 0o755);
    console.log(`Created temp directory: ${tempDir}`);
  } catch (err) {
    console.log('Warning: Could not create temp directory:', err.message);
  }
  
  // Test write permissions
  try {
    const testFile = path.join(tempDir, 'write-test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Write permissions confirmed');
  } catch (err) {
    console.log('Warning: Write test failed:', err.message);
  }
}

// Clean up old test databases
try {
  const files = fs.readdirSync('.');
  const dbFiles = files.filter(file => 
    file.startsWith('test-') && file.endsWith('.db') ||
    file.endsWith('.test.db') ||
    file === 'test-nodejs.db'
  );
  
  dbFiles.forEach(file => {
    try {
      fs.unlinkSync(file);
      console.log(`Cleaned up: ${file}`);
    } catch (err) {
      // Ignore cleanup errors
    }
  });
} catch (err) {
  console.log('Note: Could not clean up old test databases');
}

// Determine the correct command based on Node.js version
let testCommand;
const baseCommand = 'node --experimental-sqlite node_modules/vitest/vitest.mjs run';

if (majorVersion >= 22) {
  // Node.js 22+ has experimental SQLite support
  testCommand = baseCommand;
} else {
  // For older versions, we might need to skip SQLite tests or use a different approach
  console.log('Warning: Node.js version < 22 may not support experimental SQLite');
  testCommand = 'node_modules/.bin/vitest run';
}

console.log(`Executing: ${testCommand}`);

// Set up environment variables
const testEnv = {
  ...process.env,
  NODE_OPTIONS: '--experimental-sqlite'
};

// Add CI-specific environment variables
if (isCI) {
  testEnv.CI = 'true';
  testEnv.VITEST_POOL_OPTIONS = JSON.stringify({
    forks: {
      singleFork: true
    }
  });
}

try {
  execSync(testCommand, { 
    stdio: 'inherit',
    cwd: process.cwd(),
    env: testEnv
  });
  console.log('Tests completed successfully!');
} catch (error) {
  console.error('Tests failed:', error.message);
  process.exit(1);
}
