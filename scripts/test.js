#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

console.log(`Running tests with Node.js ${nodeVersion}`);

// Check if we're in CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (isCI) {
  console.log('Running in CI environment');
  
  // Set up temp directory for CI in /tmp for better permissions
  const tempDir = path.join(os.tmpdir(), `refine-sql-test-${Date.now()}`);
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o755 });
    }
    console.log(`Created temp directory: ${tempDir}`);
    
    // Set environment variable for tests to use this directory
    process.env.TEST_DB_DIR = tempDir;
    
    // Test write permissions
    const testFile = path.join(tempDir, 'write-test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Write permissions confirmed');
  } catch (err) {
    console.log('Warning: Could not create temp directory:', err.message);
    // Fallback to current directory
    process.env.TEST_DB_DIR = process.cwd();
  }
  
  // Set CI-specific environment variables
  process.env.CI_TESTING = 'true';
  process.env.FORCE_MEMORY_DB = 'true';
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

// Set up environment variables (without NODE_OPTIONS for CI compatibility)
const testEnv = {
  ...process.env
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
