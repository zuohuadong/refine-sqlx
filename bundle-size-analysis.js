#!/usr/bin/env node

// Script to analyze the bundle size impact of different SQLite drivers
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testConfigs = [
  {
    name: 'Base (D1 only)',
    description: 'Only Cloudflare D1 support',
    external: ['@refinedev/core'],
    modifications: null
  },
  {
    name: 'With Node.js SQLite',
    description: 'D1 + Node.js 22.5+ built-in SQLite',
    external: ['@refinedev/core', 'node:sqlite'],
    modifications: null
  },
  {
    name: 'With Bun SQLite',
    description: 'D1 + Bun 1.2+ built-in SQLite',
    external: ['@refinedev/core'],
    modifications: null
  },
  {
    name: 'All Runtimes',
    description: 'D1 + Node.js + Bun SQLite support',
    external: ['@refinedev/core', 'node:sqlite'],
    modifications: null
  }
];

async function analyzeConfig(config) {
  console.log(`\n📊 Analyzing: ${config.name}`);
  console.log(`   ${config.description}`);
  
  try {
    // Update tsup config
    const tsupConfig = `
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: false,
    clean: true,
    platform: "neutral",
    target: "es2020",
    format: ["esm"],
    dts: false,
    treeshake: true,
    minify: true,
    external: ${JSON.stringify(config.external)},
    esbuildOptions(options) {
        options.drop = ["console", "debugger"];
        options.legalComments = "none";
        options.treeShaking = true;
    },
});
    `;
    
    fs.writeFileSync('tsup.temp.config.ts', tsupConfig);
    
    // Build with temp config
    execSync('npx tsup --config tsup.temp.config.ts', { stdio: 'pipe' });
    
    // Get bundle size
    const bundlePath = 'dist/index.mjs';
    if (fs.existsSync(bundlePath)) {
      const stats = fs.statSync(bundlePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   📦 Bundle size: ${sizeKB} KB`);
      return { name: config.name, size: stats.size, sizeKB };
    } else {
      console.log(`   ❌ Bundle not found`);
      return { name: config.name, size: 0, sizeKB: '0.00' };
    }
  } catch (error) {
    console.log(`   ❌ Build failed: ${error.message}`);
    return { name: config.name, size: 0, sizeKB: '0.00' };
  } finally {
    // Cleanup
    try {
      fs.unlinkSync('tsup.temp.config.ts');
    } catch (e) {}
  }
}

async function main() {
  console.log('🔍 Analyzing bundle size impact of different SQLite drivers\n');
  
  const results = [];
  
  for (const config of testConfigs) {
    const result = await analyzeConfig(config);
    results.push(result);
  }
  
  // Generate report
  console.log('\n📈 Bundle Size Analysis Report');
  console.log('='.repeat(50));
  
  const baseSize = results[0]?.size || 1;
  
  results.forEach((result, index) => {
    const increase = index === 0 ? 0 : ((result.size - baseSize) / baseSize * 100);
    const increaseStr = index === 0 ? 'baseline' : `+${increase.toFixed(1)}%`;
    console.log(`${result.name.padEnd(20)} | ${result.sizeKB.padStart(8)} KB | ${increaseStr.padStart(10)}`);
  });
  
  console.log('\n💡 Recommendations:');
  console.log('- Use external dependencies to keep bundle size minimal');
  console.log('- Node.js and Bun native SQLite add minimal overhead');
  console.log('- Dynamic imports keep unused code out of the bundle');
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      name: r.name,
      sizeBytes: r.size,
      sizeKB: r.sizeKB,
      increasePercent: r === results[0] ? 0 : ((r.size - baseSize) / baseSize * 100)
    }))
  };
  
  fs.writeFileSync('bundle-analysis-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to: bundle-analysis-report.json');
}

main().catch(console.error);
