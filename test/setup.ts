// test/setup.ts
// 测试环境设置文件，确保CI环境中Node.js SQLite功能正常工作

import { beforeAll, vi } from 'vitest';

beforeAll(async () => {
  // 检测是否在CI环境中
  const isCI = (typeof process !== 'undefined' && process.env && 
               (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'));
  
  if (isCI) {
    console.log('设置CI测试环境...');
    
    // 检查Node.js版本
    const nodeVersion = typeof process !== 'undefined' && process.version ? process.version : 'v0.0.0';
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    console.log(`Node.js版本: ${nodeVersion}`);
    
    // 确保Node.js 22+才尝试使用原生SQLite
    if (majorVersion >= 22) {
      try {
        // 尝试导入node:sqlite来验证实验性功能是否可用
        await import('node:sqlite');
        console.log('Node.js SQLite实验性功能可用');
        
        // 设置环境变量确保测试使用正确的runtime
        process.env.FORCE_NODE_SQLITE = 'true';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Node.js SQLite实验性功能不可用，将使用模拟:', errorMessage);
        
        // 如果Node.js SQLite不可用，强制使用模拟
        process.env.FORCE_MOCK_SQLITE = 'true';
        
        // 全局模拟node:sqlite模块
        vi.mock('node:sqlite', () => ({
          DatabaseSync: vi.fn().mockImplementation(() => ({
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([]),
              get: vi.fn().mockReturnValue(null),
              run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 })
            }),
            close: vi.fn(),
            exec: vi.fn()
          }))
        }));
      }
    } else {
      console.log(`Node.js版本${majorVersion} < 22，使用模拟SQLite`);
      process.env.FORCE_MOCK_SQLITE = 'true';
    }
  }
  
  // 设置测试数据库路径
  if (typeof process !== 'undefined' && process.env && !process.env.TEST_DB_DIR) {
    process.env.TEST_DB_DIR = process.cwd();
  }
});

// 导出测试助手函数
export function shouldUseMockSQLite(): boolean {
  return (typeof process !== 'undefined' && process.env && process.env.FORCE_MOCK_SQLITE === 'true') || false;
}

export function isNodeVersionSupported(): boolean {
  if (typeof process === 'undefined' || !process.version) return false;
  const majorVersion = parseInt(process.version.substring(1).split('.')[0]);
  return majorVersion >= 22;
}
