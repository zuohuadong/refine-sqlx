// 测试 customFlexible 方法
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { dataProvider } from '../src/provider';

describe('customFlexible Method Tests', () => {
  let provider: ReturnType<typeof dataProvider>;
  let testDbPath: string;

  beforeAll(async () => {
    // 创建一个唯一的测试数据库文件
    testDbPath = `test-custom-flexible-${Date.now()}-${Math.random().toString(36).substring(7)}.db`;
    provider = dataProvider(testDbPath);
    
    // 确保数据库正确初始化，等待一下
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 尝试初始化数据库连接
    try {
      await provider.customEnhanced({
        query: 'SELECT 1'
      });
    } catch (error) {
      // 再等待一下重试
      await new Promise(resolve => setTimeout(resolve, 300));
      await provider.customEnhanced({
        query: 'SELECT 1'
      });
    }
    
    // 使用 customEnhanced 来创建表，确保数据库正确初始化
    const tableResult = await provider.customEnhanced({
      query: `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'draft'
      )`
    });
    console.log('Table creation result:', tableResult);
    
    // 插入测试数据 - 使用逐个插入
    const insertResult1 = await provider.customEnhanced({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Post 1', 'Content 1', 'published']
    });
    
    const insertResult2 = await provider.customEnhanced({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Post 2', 'Content 2', 'draft']
    });
    
    const insertResult3 = await provider.customEnhanced({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Post 3', 'Content 3', 'published']
    });
    
    console.log('Insert results:', { insertResult1, insertResult2, insertResult3 });
    
    // 验证数据插入成功
    const verifyResult = await provider.customEnhanced({
      query: 'SELECT COUNT(*) as count FROM posts'
    });
    console.log('Data verification:', verifyResult);
  });

  afterAll(async () => {
    if (provider.close) {
      provider.close();
    }
    
    // 清理测试数据库文件
    try {
      const fs = await import('node:fs');
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // 忽略文件不存在的错误
    }
  });

  test('customFlexible - 字符串查询', async () => {
    // 验证数据存在
    const checkData = await provider.customFlexible({
      query: 'SELECT COUNT(*) as count FROM posts WHERE status = ?',
      params: ['published']
    });
    
    if (!checkData.data || checkData.data.length === 0 || checkData.data[0].count === 0) {
      await provider.customFlexible({
        query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
        params: ['Flexible Test 1', 'Content 1', 'published']
      });
      await provider.customFlexible({
        query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
        params: ['Flexible Test 2', 'Content 2', 'published']
      });
    }
    
    const result = await provider.customFlexible({
      query: 'SELECT * FROM posts WHERE status = ?',
      params: ['published']
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    expect(result.data[0]).toHaveProperty('title');
    expect(result.data[0]).toHaveProperty('status', 'published');
  });

  test('customFlexible - 函数查询', async () => {
    const result = await provider.customFlexible({
      query: async (adapter) => {
        return await adapter.query('SELECT COUNT(*) as count FROM posts');
      }
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).toBeDefined();
    expect(result.data[0]).toHaveProperty('count');
    expect(result.data[0].count).toBeGreaterThan(0);
  });

  test('customFlexible - 函数查询带参数操作', async () => {
    const result = await provider.customFlexible({
      query: async (adapter) => {
        // 在函数中可以执行多个操作
        await adapter.execute('INSERT INTO posts (title, content) VALUES (?, ?)', ['Test Post', 'Test Content']);
        return await adapter.query('SELECT * FROM posts WHERE title = ?', ['Test Post']);
      }
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0]).toHaveProperty('title', 'Test Post');
  });

  test('customFlexible - 复杂函数查询', async () => {
    const result = await provider.customFlexible({
      query: async (adapter) => {
        // 复杂的查询逻辑
        const posts = await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
        const count = await adapter.query('SELECT COUNT(*) as total FROM posts');
        
        return {
          posts,
          total: count && count.length > 0 && count[0] ? count[0].total : 0
        };
      }
    });

    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty('posts');
    expect(result.data).toHaveProperty('total');
    expect(Array.isArray(result.data.posts)).toBe(true);
    expect(typeof result.data.total).toBe('number');
    expect(result.data.total).toBeGreaterThanOrEqual(0);
  });
});
