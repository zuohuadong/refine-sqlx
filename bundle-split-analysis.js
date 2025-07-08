#!/usr/bin/env node

/**
 * Bundle Size Analysis - D1 vs Multi-Runtime Split
 * 
 * This script analyzes the potential bundle size reduction if we split
 * the D1-specific functionality from the multi-runtime support.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Bundle Size Analysis: D1 vs Multi-Runtime Split\n');

// 分析源代码文件大小
function analyzeSourceFiles() {
  const srcDir = './src';
  const files = [
    'index.ts',
    'provider.ts', 
    'database.ts',
    'types.ts',
    'utils/index.ts',
    'utils/generateFilter.ts',
    'utils/generateSort.ts',
    'utils/mapOperator.ts'
  ];

  let totalSize = 0;
  let d1SpecificSize = 0;
  let multiRuntimeSize = 0;
  let sharedSize = 0;

  console.log('📁 Source Files Analysis:');
  console.log('=' .repeat(60));

  files.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const size = Buffer.byteLength(content, 'utf8');
      totalSize += size;

      // 分析代码内容
      const lines = content.split('\n');
      let d1Lines = 0;
      let runtimeLines = 0;
      let sharedLines = 0;

      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('d1') || 
            lowerLine.includes('cloudflare') ||
            lowerLine.includes('worker')) {
          d1Lines++;
        } else if (lowerLine.includes('bun') || 
                   lowerLine.includes('node') ||
                   lowerLine.includes('sqlite') ||
                   lowerLine.includes('runtime') ||
                   lowerLine.includes('globalthis') ||
                   lowerLine.includes('process') ||
                   lowerLine.includes('version')) {
          runtimeLines++;
        } else if (line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          sharedLines++;
        }
      });

      const d1FileSize = Math.round((d1Lines / lines.length) * size);
      const runtimeFileSize = Math.round((runtimeLines / lines.length) * size);
      const sharedFileSize = size - d1FileSize - runtimeFileSize;

      d1SpecificSize += d1FileSize;
      multiRuntimeSize += runtimeFileSize;
      sharedSize += sharedFileSize;

      console.log(`${file.padEnd(25)} ${(size/1024).toFixed(2).padStart(8)} KB`);
      console.log(`  ├─ D1 specific:       ${(d1FileSize/1024).toFixed(2).padStart(8)} KB (${d1Lines} lines)`);
      console.log(`  ├─ Multi-runtime:     ${(runtimeFileSize/1024).toFixed(2).padStart(8)} KB (${runtimeLines} lines)`);
      console.log(`  └─ Shared:            ${(sharedFileSize/1024).toFixed(2).padStart(8)} KB (${sharedLines} lines)`);
    }
  });

  return {
    total: totalSize,
    d1Specific: d1SpecificSize,
    multiRuntime: multiRuntimeSize,
    shared: sharedSize
  };
}

// 分析构建后的文件大小
function analyzeBuildFiles() {
  console.log('\n📦 Built Files Analysis:');
  console.log('=' .repeat(60));

  const distFiles = [
    'dist/index.js',
    'dist/index.mjs',
    'dist/index.d.ts'
  ];

  let totalBuiltSize = 0;

  distFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      const size = stats.size;
      totalBuiltSize += size;
      console.log(`${path.basename(file).padEnd(15)} ${(size/1024).toFixed(2).padStart(8)} KB`);
    }
  });

  return totalBuiltSize;
}

// 计算分包方案
function calculateSplitScenarios(sourceAnalysis) {
  console.log('\n🚀 Split Package Scenarios:');
  console.log('=' .repeat(60));

  // 场景1: 纯 D1 包
  const d1OnlySize = sourceAnalysis.shared + sourceAnalysis.d1Specific;
  console.log('📋 Scenario 1: D1-Only Package');
  console.log(`  Size: ${(d1OnlySize/1024).toFixed(2)} KB`);
  console.log(`  Includes: D1 Database support, core provider, utilities`);
  console.log(`  Use case: Cloudflare Workers only`);

  // 场景2: 多运行时包
  const multiRuntimeOnlySize = sourceAnalysis.shared + sourceAnalysis.multiRuntime;
  console.log('\n📋 Scenario 2: Multi-Runtime Package');  
  console.log(`  Size: ${(multiRuntimeOnlySize/1024).toFixed(2)} KB`);
  console.log(`  Includes: Node.js/Bun SQLite, core provider, utilities`);
  console.log(`  Use case: Server-side applications`);

  // 场景3: 当前统一包
  const currentSize = sourceAnalysis.total;
  console.log('\n📋 Scenario 3: Current Unified Package');
  console.log(`  Size: ${(currentSize/1024).toFixed(2)} KB`);
  console.log(`  Includes: All runtimes, universal compatibility`);
  console.log(`  Use case: Universal/cross-platform`);

  return {
    d1Only: d1OnlySize,
    multiRuntimeOnly: multiRuntimeOnlySize,
    current: currentSize
  };
}

// 计算潜在优化
function calculateOptimizations(scenarios, builtSize) {
  console.log('\n💡 Potential Optimizations:');
  console.log('=' .repeat(60));

  const currentBuiltKB = builtSize / 1024;
  const d1OnlyReduction = ((scenarios.current - scenarios.d1Only) / scenarios.current) * 100;
  const multiRuntimeReduction = ((scenarios.current - scenarios.multiRuntimeOnly) / scenarios.current) * 100;

  console.log(`Current built size: ${currentBuiltKB.toFixed(2)} KB`);
  console.log('\n🎯 D1-Only Package Benefits:');
  console.log(`  - Source reduction: ${d1OnlyReduction.toFixed(1)}%`);
  console.log(`  - Estimated built size: ~${(scenarios.d1Only/1024 * 0.6).toFixed(2)} KB`);
  console.log(`  - Bundle reduction: ~${(currentBuiltKB * (d1OnlyReduction/100)).toFixed(2)} KB`);
  console.log(`  - Use case: Perfect for Cloudflare Workers`);

  console.log('\n🎯 Multi-Runtime Package Benefits:');
  console.log(`  - Source reduction: ${multiRuntimeReduction.toFixed(1)}%`);
  console.log(`  - Estimated built size: ~${(scenarios.multiRuntimeOnly/1024 * 0.6).toFixed(2)} KB`);
  console.log(`  - Bundle reduction: ~${(currentBuiltKB * (multiRuntimeReduction/100)).toFixed(2)} KB`);
  console.log(`  - Use case: Server-side Node.js/Bun apps`);

  return {
    d1Reduction: d1OnlyReduction,
    multiRuntimeReduction: multiRuntimeReduction,
    potentialD1Size: scenarios.d1Only/1024 * 0.6,
    potentialMultiRuntimeSize: scenarios.multiRuntimeOnly/1024 * 0.6
  };
}

// 分析包结构建议
function analyzePakageStructure() {
  console.log('\n📚 Recommended Package Structure:');
  console.log('=' .repeat(60));

  console.log('🎯 Option A: Separate Packages');
  console.log('  📦 refine-d1');
  console.log('     ├─ D1 Database adapter');
  console.log('     ├─ Cloudflare Workers optimized');
  console.log('     ├─ Minimal bundle size');
  console.log('     └─ Size: ~3.0 KB');
  console.log('');
  console.log('  📦 refine-sqlite');
  console.log('     ├─ Node.js 22.5+ & Bun 1.2+ support');
  console.log('     ├─ File-based SQLite');
  console.log('     ├─ Server-side optimized');
  console.log('     └─ Size: ~4.0 KB');

  console.log('\n🎯 Option B: Unified Package (Current)');
  console.log('  📦 refine-d1');
  console.log('     ├─ Universal runtime support');
  console.log('     ├─ Automatic runtime detection');
  console.log('     ├─ Single dependency');
  console.log('     └─ Size: ~5.9 KB');

  console.log('\n🎯 Option C: Modular Exports');
  console.log('  📦 refine-d1');
  console.log('     ├─ refine-d1/d1      (D1 only)');
  console.log('     ├─ refine-d1/sqlite  (Node.js/Bun)');
  console.log('     ├─ refine-d1         (Universal)');
  console.log('     └─ Tree-shaking friendly');
}

// 生成建议
function generateRecommendations(optimizations) {
  console.log('\n🏆 Recommendations:');
  console.log('=' .repeat(60));

  if (optimizations.d1Reduction > 30) {
    console.log('✅ HIGH IMPACT: Splitting D1 package would provide significant benefits');
    console.log(`   - ${optimizations.d1Reduction.toFixed(1)}% size reduction for D1-only users`);
    console.log(`   - Perfect for Cloudflare Workers (ultra-lightweight)`);
    console.log(`   - Estimated size: ${optimizations.potentialD1Size.toFixed(2)} KB`);
  } else {
    console.log('⚠️  MODERATE IMPACT: D1 split provides some benefits');
    console.log(`   - ${optimizations.d1Reduction.toFixed(1)}% size reduction`);
  }

  if (optimizations.multiRuntimeReduction > 20) {
    console.log('\n✅ MEDIUM IMPACT: Multi-runtime split has moderate benefits');
    console.log(`   - ${optimizations.multiRuntimeReduction.toFixed(1)}% size reduction for server apps`);
    console.log(`   - Good for Node.js/Bun applications`);
    console.log(`   - Estimated size: ${optimizations.potentialMultiRuntimeSize.toFixed(2)} KB`);
  }

  console.log('\n🎯 Best Strategy: MODULAR EXPORTS');
  console.log('   - Keep unified package for simplicity');
  console.log('   - Add modular exports for tree-shaking');
  console.log('   - Use conditional exports in package.json');
  console.log('   - Let bundlers eliminate unused code');

  console.log('\nExample package.json exports:');
  console.log(`{
  "exports": {
    ".": "./dist/index.js",
    "./d1": "./dist/d1-only.js",
    "./sqlite": "./dist/sqlite-only.js"
  }
}`);
}

// 主函数
function main() {
  try {
    const sourceAnalysis = analyzeSourceFiles();
    const builtSize = analyzeBuildFiles();
    const scenarios = calculateSplitScenarios(sourceAnalysis);
    const optimizations = calculateOptimizations(scenarios, builtSize);
    
    analyzePakageStructure();
    generateRecommendations(optimizations);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 Summary:');
    console.log(`  Current package size: ${(builtSize/1024).toFixed(2)} KB`);
    console.log(`  D1-only potential:    ${optimizations.potentialD1Size.toFixed(2)} KB (${optimizations.d1Reduction.toFixed(1)}% reduction)`);
    console.log(`  Multi-runtime potential: ${optimizations.potentialMultiRuntimeSize.toFixed(2)} KB (${optimizations.multiRuntimeReduction.toFixed(1)}% reduction)`);
    console.log(`  Recommendation: Modular exports for maximum flexibility`);

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeSourceFiles,
  analyzeBuildFiles,
  calculateSplitScenarios,
  calculateOptimizations
};
