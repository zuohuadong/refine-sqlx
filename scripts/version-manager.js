#!/usr/bin/env node

/**
 * Elegant NPM Package Version Manager
 *
 * This script provides multiple strategies for versioning and releasing packages:
 * 1. Conventional Commits based versioning
 * 2. Interactive version selection
 * 3. Automated changelog generation
 * 4. Pre-release management
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = query => new Promise(resolve => rl.question(query, resolve));

// Color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get current version from package.json
function getCurrentVersion(packagePath = './package.json') {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  return pkg.version;
}

// Parse conventional commits to determine version bump
function analyzeCommits() {
  try {
    const commits = execSync(
      'git log --pretty=format:"%s" HEAD...$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)',
      { encoding: 'utf8' }
    );
    const lines = commits.split('\n').filter(Boolean);

    let bump = 'patch';
    for (const commit of lines) {
      if (commit.includes('BREAKING CHANGE') || commit.includes('!:')) {
        return 'major';
      }
      if (commit.startsWith('feat')) {
        bump = 'minor';
      }
    }
    return bump;
  } catch {
    return 'patch';
  }
}

// Generate next version based on bump type
function getNextVersion(current, bumpType) {
  const [major, minor, patch] = current.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'prerelease':
      return `${major}.${minor}.${patch}-rc.${Date.now()}`;
    default:
      return current;
  }
}

// Interactive version selection
async function selectVersionStrategy() {
  log('\n📦 Elegant Version Manager', 'bright');
  log('================================\n', 'blue');

  const current = getCurrentVersion();
  log(`Current version: ${current}\n`, 'yellow');

  const suggestedBump = analyzeCommits();
  log(`Suggested bump based on commits: ${suggestedBump}`, 'green');

  const strategies = [
    '1. Auto (based on conventional commits)',
    '2. Manual patch version',
    '3. Manual minor version',
    '4. Manual major version',
    '5. Pre-release (RC)',
    '6. Custom version',
    '7. Use Changesets',
    '8. Use Semantic Release',
  ];

  strategies.forEach(s => log(s));

  const choice = await question('\nSelect strategy (1-8): ');

  switch (choice) {
    case '1':
      return {
        strategy: 'auto',
        version: getNextVersion(current, suggestedBump),
      };
    case '2':
      return { strategy: 'manual', version: getNextVersion(current, 'patch') };
    case '3':
      return { strategy: 'manual', version: getNextVersion(current, 'minor') };
    case '4':
      return { strategy: 'manual', version: getNextVersion(current, 'major') };
    case '5':
      return {
        strategy: 'prerelease',
        version: getNextVersion(current, 'prerelease'),
      };
    case '6':
      const custom = await question('Enter custom version: ');
      return { strategy: 'custom', version: custom };
    case '7':
      return { strategy: 'changesets' };
    case '8':
      return { strategy: 'semantic-release' };
    default:
      throw new Error('Invalid choice');
  }
}

// Execute versioning based on strategy
async function executeVersioning(strategy, newVersion) {
  switch (strategy) {
    case 'changesets':
      log('\n🚀 Using Changesets...', 'green');
      execSync('bun run changeset', { stdio: 'inherit' });
      execSync('bun run version-packages', { stdio: 'inherit' });
      break;

    case 'semantic-release':
      log('\n🚀 Using Semantic Release...', 'green');
      execSync('npx semantic-release', { stdio: 'inherit' });
      break;

    default:
      log(`\n🚀 Updating to version ${newVersion}...`, 'green');
      // Update root package.json
      updatePackageVersion('./package.json', newVersion);

      // Update all workspace packages
      const packages = [
        'packages/refine-orm',
        'packages/refine-sql',
        'packages/refine-core',
      ];
      for (const pkg of packages) {
        updatePackageVersion(`${pkg}/package.json`, newVersion);
      }

      // Generate changelog
      generateChangelog(newVersion);

      // Create git commit and tag
      execSync('git add -A', { stdio: 'inherit' });
      execSync(`git commit -m "chore(release): v${newVersion}"`, {
        stdio: 'inherit',
      });
      execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, {
        stdio: 'inherit',
      });

      log('\n✅ Version updated successfully!', 'green');
      log(`Tagged as: v${newVersion}`, 'blue');
  }
}

// Update version in package.json
function updatePackageVersion(path, version) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Generate changelog entry
function generateChangelog(version) {
  const date = new Date().toISOString().split('T')[0];
  const commits = execSync(
    'git log --pretty=format:"- %s (%h)" HEAD...$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)',
    { encoding: 'utf8' }
  );

  const entry = `## [${version}] - ${date}\n\n${commits}\n\n`;

  try {
    const existing = readFileSync('CHANGELOG.md', 'utf8');
    writeFileSync('CHANGELOG.md', entry + existing);
  } catch {
    writeFileSync('CHANGELOG.md', `# Changelog\n\n${entry}`);
  }
}

// Main execution
async function main() {
  try {
    const { strategy, version } = await selectVersionStrategy();

    const confirm = await question(
      `\nProceed with ${strategy} ${version ? `(v${version})` : ''}? (y/n): `
    );

    if (confirm.toLowerCase() === 'y') {
      await executeVersioning(strategy, version);

      const publish = await question('\nPublish to npm? (y/n): ');
      if (publish.toLowerCase() === 'y') {
        log('\n📤 Publishing to npm...', 'blue');
        execSync('bun run release', { stdio: 'inherit' });
        log('\n✅ Published successfully!', 'green');
      }

      const push = await question('\nPush to remote? (y/n): ');
      if (push.toLowerCase() === 'y') {
        execSync('git push && git push --tags', { stdio: 'inherit' });
        log('\n✅ Pushed to remote!', 'green');
      }
    } else {
      log('\n❌ Cancelled', 'red');
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
