// 测试 refine-orm 的 Bun 和 Node.js 支持
import { ormDataProvider } from '../provider';
import type { OrmConfig } from '../types';

describe('refine-orm Multi-Runtime Support', () => {
  let provider: ReturnType<typeof ormDataProvider>;
  let testDbPath: string;

  beforeAll(async () => {
    // 创建一个唯一的测试数据库文件
    testDbPath = `test-orm-runtime-${Date.now()}-${Math.random().toString(36).substring(7)}.db`;
    
    // 检测当前运行时并创建相应的配置
    const isNodeJs = typeof globalThis !== 'undefined' && 'process' in globalThis;
    const isBun = typeof globalThis !== 'undefined' && 'Bun' in globalThis;
    
    let config: OrmConfig;
    
    if (isBun && (globalThis as any).Bun?.sqlite) {
      config = {
        database: 'bun-sqlite',
        databasePath: testDbPath,
        logger: false
      };
    } else if (isNodeJs) {
      config = {
        database: 'node-sqlite', 
        databasePath: testDbPath,
        logger: false
      };
    } else {
      // 如果没有合适的运行时，跳过所有测试
      console.log('Skipping refine-orm tests: No supported runtime environment');
      return;
    }

    provider = ormDataProvider(config);
    
    // 添加延迟以确保数据库正确初始化
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 尝试初始化数据库连接
    try {
      await provider.customOrm({
        query: 'SELECT 1'
      });
    } catch (error) {
      // 再等待一下重试
      await new Promise(resolve => setTimeout(resolve, 300));
      await provider.customOrm({
        query: 'SELECT 1'
      });
    }
    
    // 创建测试表
    const tableResult = await provider.customOrm({
      query: `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    });
    console.log('Table creation result:', tableResult);
    
    // 插入测试数据 - 使用逐个插入
    const insertResult1 = await provider.customOrm({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Runtime Test 1', 'Content 1', 'published']
    });
    
    const insertResult2 = await provider.customOrm({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Runtime Test 2', 'Content 2', 'draft']
    });
    
    const insertResult3 = await provider.customOrm({
      query: `INSERT INTO posts (title, content, status) VALUES (?, ?, ?)`,
      params: ['Runtime Test 3', 'Content 3', 'published']
    });
    
    console.log('Insert results:', { insertResult1, insertResult2, insertResult3 });
    
    // 验证数据插入成功
    const verifyResult = await provider.customOrm({
      query: 'SELECT COUNT(*) as count FROM posts'
    });
    console.log('Data verification:', verifyResult);
  });

  afterAll(async () => {
    if (provider && provider.close) {
      await provider.close();
    }
    
    // 清理测试数据库文件
    try {
      const fs = await import('node:fs');
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // 忽略文件不存在的错误
    }
  });

  test('should detect runtime correctly', async () => {
    const { detectRuntime } = await import('../runtime-adapter');
    const runtime = detectRuntime();
    
    // 检查实际的运行时环境
    if (typeof globalThis !== 'undefined' && 'Bun' in globalThis && (globalThis as any).Bun?.sqlite) {
      expect(runtime).toBe('bun-sqlite');
    } else if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
      expect(runtime).toBe('node-sqlite');
    } else {
      expect(runtime).toBe('drizzle');
    }
  });

  test('should perform basic CRUD operations', async () => {
    if (!provider) {
      console.log('Skipping CRUD test: Provider not initialized');
      return; // 跳过如果运行时不支持
    }

    // 创建
    const created = await provider.create({
      resource: 'posts',
      variables: {
        title: 'Runtime CRUD Test',
        content: 'Testing CRUD operations',
        status: 'published'
      }
    });

    expect(created.data).toBeDefined();
    expect(created.data.title).toBe('Runtime CRUD Test');

    // 读取
    const fetched = await provider.getOne({
      resource: 'posts',
      id: created.data.id
    });

    expect(fetched.data).toBeDefined();
    expect(fetched.data.title).toBe('Runtime CRUD Test');

    // 更新
    const updated = await provider.update({
      resource: 'posts',
      id: created.data.id,
      variables: {
        title: 'Updated Runtime Test'
      }
    });

    expect(updated.data.title).toBe('Updated Runtime Test');

    // 删除
    const deleted = await provider.deleteOne({
      resource: 'posts',
      id: created.data.id
    });

    expect(deleted.data).toBeDefined();
    expect(deleted.data.id).toBe(created.data.id);
  });

  test('should handle list operations with filtering', async () => {
    if (!provider) {
      console.log('Skipping list operations test: Provider not initialized');
      return;
    }
    if (!provider) return;

    const result = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [
        { field: 'status', operator: 'eq', value: 'published' }
      ],
      sorters: [
        { field: 'created_at', order: 'desc' }
      ]
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    
    // 验证过滤结果
    result.data.forEach((post: any) => {
      expect(post.status).toBe('published');
    });
  });

  test('should support custom ORM queries', async () => {
    if (!provider) {
      console.log('Skipping custom ORM queries test: Provider not initialized');
      return;
    }
    if (!provider) return;

    // 字符串查询
    const stringResult = await provider.customOrm({
      query: 'SELECT COUNT(*) as count FROM posts WHERE status = $1',
      params: ['published']
    });

    expect(stringResult.data).toBeDefined();
    expect(stringResult.data[0]).toHaveProperty('count');

    // 函数查询
    const functionResult = await provider.customOrm({
      query: async (adapter) => {
        const posts = await adapter.query('SELECT * FROM posts WHERE status = $1', ['published']);
        const total = await adapter.query('SELECT COUNT(*) as total FROM posts');
        
        return {
          posts,
          totalCount: total[0].total
        };
      }
    });

    expect(functionResult.data).toBeDefined();
    expect(functionResult.data).toHaveProperty('posts');
    expect(functionResult.data).toHaveProperty('totalCount');
  });

  test('should support transactions', async () => {
    if (!provider) {
      console.log('Skipping transactions test: Provider not initialized');
      return;
    }
    if (!provider) return;

    const result = await provider.transaction(async (tx) => {
      // 在事务中创建记录
      const insertResult = await tx.execute(
        'INSERT INTO posts (title, content, status) VALUES ($1, $2, $3)',
        ['Transaction Test', 'Transaction Content', 'draft']
      );
      
      // 查询创建的记录
      const posts = await tx.query(
        'SELECT * FROM posts WHERE title = $1',
        ['Transaction Test']
      );
      
      return posts[0];
    });

    expect(result).toBeDefined();
    expect(result.title).toBe('Transaction Test');
    
    // 验证事务已提交
    const verification = await provider.getList({
      resource: 'posts',
      filters: [
        { field: 'title', operator: 'eq', value: 'Transaction Test' }
      ]
    });
    
    expect(verification.data.length).toBe(1);
  });

  test('should handle runtime-specific error cases', async () => {
    if (!provider) {
      console.log('Skipping error cases test: Provider not initialized');
      return;
    }
    if (!provider) return;

    // 测试无效 SQL
    await expect(
      provider.customOrm({
        query: 'INVALID SQL STATEMENT'
      })
    ).rejects.toThrow();
  });
});
