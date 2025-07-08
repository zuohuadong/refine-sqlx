#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

console.log(`Running tests with Node.js ${nodeVersion}`);

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

if (majorVersion >= 22) {
  // Node.js 22+ has experimental SQLite support
  testCommand = 'node --experimental-sqlite node_modules/vitest/vitest.mjs run';
} else {
  // For older versions, we might need to skip SQLite tests or use a different approach
  console.log('Warning: Node.js version < 22 may not support experimental SQLite');
  testCommand = 'node_modules/.bin/vitest run';
}

console.log(`Executing: ${testCommand}`);

try {
  execSync(testCommand, { 
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: '--experimental-sqlite'
    }
  });
  console.log('Tests completed successfully!');
} catch (error) {
  console.error('Tests failed:', error.message);
  process.exit(1);
}
