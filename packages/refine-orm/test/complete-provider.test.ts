import { test, expect, describe } from 'vitest';
import { ormDataProvider } from '../src/index';

// Mock database connection
const createMockConnection = () => ({
  query: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
    if (sql.includes('COUNT(*)')) {
      return [{ count: 10 } as any] as T[];
    }
    if (sql.includes('SELECT') && sql.includes('WHERE id IN')) {
      return [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ] as T[];
    }
    if (sql.includes('SELECT') && sql.includes('WHERE id =')) {
      return [{ id: 1, name: 'Single Item' }] as T[];
    }
    return [
      { id: 1, name: 'Test Item 1', description: 'Test description 1' },
      { id: 2, name: 'Test Item 2', description: 'Test description 2' }
    ] as T[];
  },
  execute: async (sql: string, params?: any[]) => {
    return {
      rowsAffected: 1,
      insertId: Math.floor(Math.random() * 1000)
    };
  },
  close: async () => {
    // Mock close
  }
});

describe('Refine DataProvider 完整性测试', () => {
  const mockConnection = createMockConnection();
  const provider = ormDataProvider({
    database: 'postgresql',
    connection: mockConnection
  });

  test('应该包含所有必需的 Refine DataProvider 方法', () => {
    // 必需的方法
    expect(typeof provider.getList).toBe('function');
    expect(typeof provider.getOne).toBe('function');
    expect(typeof provider.create).toBe('function');
    expect(typeof provider.update).toBe('function');
    expect(typeof provider.deleteOne).toBe('function');
    
    // 可选但推荐的方法
    expect(typeof provider.getMany).toBe('function');
    expect(typeof provider.createMany).toBe('function');
    expect(typeof provider.updateMany).toBe('function');
    expect(typeof provider.deleteMany).toBe('function');
    expect(typeof provider.custom).toBe('function');
    expect(typeof provider.getApiUrl).toBe('function');
    
    // ORM 增强方法
    expect(typeof provider.queryWithOrm).toBe('function');
    expect(typeof provider.transaction).toBe('function');
    expect(typeof provider.customOrm).toBe('function');
    expect(typeof provider.getOrmAdapter).toBe('function');
    expect(typeof provider.close).toBe('function');
  });

  test('getList - 应该支持分页、过滤和排序', async () => {
    const result = await provider.getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [{ field: 'status', operator: 'eq', value: 'published' }],
      sorters: [{ field: 'created_at', order: 'desc' }]
    });
    
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe('number');
  });

  test('getOne - 应该返回单个记录', async () => {
    const result = await provider.getOne({
      resource: 'posts',
      id: 1
    });
    
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('id');
  });

  test('getMany - 应该返回多个指定 ID 的记录', async () => {
    const result = await provider.getMany({
      resource: 'posts',
      ids: [1, 2, 3]
    });
    
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('create - 应该创建新记录', async () => {
    const result = await provider.create({
      resource: 'posts',
      variables: { title: 'New Post', content: 'Post content' }
    });
    
    expect(result).toHaveProperty('data');
  });

  test('update - 应该更新现有记录', async () => {
    const result = await provider.update({
      resource: 'posts',
      id: 1,
      variables: { title: 'Updated Post' }
    });
    
    expect(result).toHaveProperty('data');
  });

  test('deleteOne - 应该删除单个记录', async () => {
    const result = await provider.deleteOne({
      resource: 'posts',
      id: 1
    });
    
    expect(result).toHaveProperty('data');
  });

  test('createMany - 应该批量创建记录', async () => {
    const result = await provider.createMany({
      resource: 'posts',
      variables: [
        { title: 'Post 1', content: 'Content 1' },
        { title: 'Post 2', content: 'Content 2' }
      ]
    });
    
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('updateMany - 应该批量更新记录', async () => {
    const result = await provider.updateMany({
      resource: 'posts',
      ids: [1, 2],
      variables: { status: 'published' }
    });
    
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('deleteMany - 应该批量删除记录', async () => {
    const result = await provider.deleteMany({
      resource: 'posts',
      ids: [1, 2, 3]
    });
    
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('custom - 应该支持自定义操作', async () => {
    const result = await provider.custom({
      url: '/custom?sql=SELECT * FROM posts',
      method: 'get'
    });
    
    expect(result).toHaveProperty('data');
  });

  test('getApiUrl - 应该返回 API URL', () => {
    const url = provider.getApiUrl();
    expect(typeof url).toBe('string');
  });

  test('queryWithOrm - 应该支持类型安全的 ORM 查询', async () => {
    const result = await provider.queryWithOrm(async (adapter) => {
      return await adapter.query('SELECT * FROM posts WHERE status = $1', ['published']);
    });
    
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('transaction - 应该支持事务处理', async () => {
    await expect(provider.transaction(async (tx) => {
      await tx.execute('INSERT INTO posts (title) VALUES ($1)', ['Transactional Post']);
      return { success: true };
    })).resolves.toEqual({ success: true });
  });

  test('customOrm - 应该支持自定义 ORM 查询', async () => {
    // 字符串查询
    const result1 = await provider.customOrm({
      query: 'SELECT COUNT(*) as total FROM posts',
      params: []
    });
    expect(result1).toHaveProperty('data');

    // 函数查询
    const result2 = await provider.customOrm({
      query: async (adapter) => {
        return await adapter.query('SELECT * FROM posts LIMIT 5');
      }
    });
    expect(result2).toHaveProperty('data');
  });

  test('getOrmAdapter - 应该返回底层 ORM 适配器', () => {
    const adapter = provider.getOrmAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.query).toBe('function');
    expect(typeof adapter.execute).toBe('function');
  });

  test('close - 应该能够关闭连接', async () => {
    await expect(provider.close()).resolves.toBeUndefined();
  });
});
