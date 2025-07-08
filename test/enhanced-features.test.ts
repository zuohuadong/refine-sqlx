// 测试 refine-sql 的增强功能
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { dataProvider } from '../src/provider';
import type { EnhancedConfig } from '../src/enhanced-types';

describe('Enhanced DataProvider Features', () => {
  let provider: ReturnType<typeof dataProvider>;
  let testDbPath: string;

  beforeAll(async () => {
    const config: EnhancedConfig = {
      enableTypeSafety: true,
      enableTransactions: true,
      enableAdvancedQueries: true
    };
    
    // 创建一个唯一的测试数据库文件
    testDbPath = `test-enhanced-${Date.now()}-${Math.random().toString(36).substring(7)}.db`;
    provider = dataProvider(testDbPath, config);
    
    // 等待数据库初始化完成
    // 使用一个简单的查询来确保数据库连接就绪
    try {
      await provider.customFlexible({ query: 'SELECT 1' });
    } catch (error) {
      // 如果查询失败，继续创建表
    }
    
    // 创建测试表
    await provider.customFlexible({
      query: `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    });
    
    // 插入测试数据
    await provider.customFlexible({
      query: `INSERT INTO posts (title, content, status) VALUES 
        ('Test Post 1', 'Content 1', 'published'),
        ('Test Post 2', 'Content 2', 'draft'),
        ('Test Post 3', 'Content 3', 'published')`
    });
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

  test('queryWithEnhancement - 类型安全查询', async () => {
    const result = await provider.queryWithEnhancement(async (adapter) => {
      return await adapter.query('SELECT * FROM posts WHERE status = ?', ['published']);
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBe(2);
    expect(result.data[0]).toHaveProperty('title');
    expect(result.data[0]).toHaveProperty('status', 'published');
  });

  test('transaction - 事务支持', async () => {
    const result = await provider.transaction(async (tx) => {
      // 在事务中创建新记录
      await tx.execute(
        'INSERT INTO posts (title, content, status) VALUES (?, ?, ?)',
        ['Transaction Test', 'Transaction Content', 'draft']
      );
      
      // 查询创建的记录
      const posts = await tx.query(
        'SELECT * FROM posts WHERE title = ?',
        ['Transaction Test']
      );
      
      return posts[0];
    });

    expect(result).toBeDefined();
    expect(result.title).toBe('Transaction Test');
    
    // 验证事务已提交
    const verification = await provider.getOne({
      resource: 'posts',
      id: result.id
    });
    
    expect(verification.data).toBeDefined();
    expect(verification.data.title).toBe('Transaction Test');
  });

  test('transaction - 事务回滚（错误处理）', async () => {
    const initialCount = await provider.customEnhanced({
      query: 'SELECT COUNT(*) as count FROM posts'
    });

    let errorOccurred = false;
    
    try {
      await provider.transaction(async (tx) => {
        // 插入一条记录
        await tx.execute(
          'INSERT INTO posts (title, content) VALUES (?, ?)',
          ['Will Be Rolled Back', 'This should not persist']
        );
        
        // 故意引发错误
        throw new Error('Transaction should be rolled back');
      });
    } catch (error) {
      errorOccurred = true;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Transaction failed');
    }

    expect(errorOccurred).toBe(true);
    
    // 验证数据没有被插入（事务已回滚）
    const finalCount = await provider.customEnhanced({
      query: 'SELECT COUNT(*) as count FROM posts'
    });
    
    expect(finalCount.data[0].count).toBe(initialCount.data[0].count);
  });

  test('customEnhanced - 字符串查询', async () => {
    const result = await provider.customEnhanced({
      query: 'SELECT COUNT(*) as total FROM posts',
      params: []
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toHaveProperty('total');
    expect(typeof result.data[0].total).toBe('number');
  });

  test('customEnhanced - 回调函数查询', async () => {
    const result = await provider.customEnhanced({
      query: async (adapter) => {
        const posts = await adapter.query(
          'SELECT * FROM posts WHERE status = ? ORDER BY id DESC',
          ['published']
        );
        
        // 可以进行复杂的处理
        return posts.map(post => ({
          ...post,
          processed: true,
          titleUpperCase: post.title.toUpperCase()
        }));
      }
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).toHaveProperty('processed', true);
    expect(result.data[0]).toHaveProperty('titleUpperCase');
    expect(result.data[0].titleUpperCase).toBe(result.data[0].title.toUpperCase());
  });

  test('batch - 批量操作', async () => {
    const operations = [
      {
        sql: 'INSERT INTO posts (title, content, status) VALUES (?, ?, ?)',
        params: ['Batch Post 1', 'Batch Content 1', 'draft']
      },
      {
        sql: 'INSERT INTO posts (title, content, status) VALUES (?, ?, ?)',
        params: ['Batch Post 2', 'Batch Content 2', 'published']
      }
    ];

    const result = await provider.batch(operations);
    expect(result.data).toBeDefined();
    
    // 验证数据已插入
    const verification = await provider.getList({
      resource: 'posts',
      filters: [
        { field: 'title', operator: 'contains', value: 'Batch Post' }
      ]
    });
    
    expect(verification.data.length).toBe(2);
  });

  test('getEnhancedAdapter - 获取底层适配器', () => {
    const adapter = provider.getEnhancedAdapter();
    
    expect(adapter).toBeDefined();
    expect(typeof adapter.query).toBe('function');
    expect(typeof adapter.execute).toBe('function');
    expect(typeof adapter.transaction).toBe('function');
    expect(typeof adapter.close).toBe('function');
  });

  test('兼容性 - 原有基础功能仍然工作', async () => {
    // 测试原有的 CRUD 功能
    const createResult = await provider.create({
      resource: 'posts',
      variables: {
        title: 'Compatibility Test',
        content: 'Testing backward compatibility',
        status: 'draft'
      }
    });

    expect(createResult.data).toBeDefined();
    expect(createResult.data.title).toBe('Compatibility Test');
    expect(createResult.data.id).toBeDefined();

    const postId = createResult.data.id!;

    const getResult = await provider.getOne({
      resource: 'posts',
      id: postId
    });

    expect(getResult.data).toBeDefined();
    expect(getResult.data.id).toBe(postId);

    const updateResult = await provider.update({
      resource: 'posts',
      id: postId,
      variables: { status: 'published' }
    });

    expect(updateResult.data.status).toBe('published');

    const deleteResult = await provider.deleteOne({
      resource: 'posts',
      id: postId
    });

    expect(deleteResult.data).toBeDefined();
  });
});
