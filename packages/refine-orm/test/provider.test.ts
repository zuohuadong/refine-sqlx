import { test, expect } from 'vitest';
import { ormDataProvider } from '../src/index';

// Mock database connection
const createMockConnection = () => ({
  query: async (sql: string, params?: any[]) => {
    if (sql.includes('COUNT(*)')) {
      return [{ count: 5 }];
    }
    return [
      { id: 1, name: 'Test Item 1', description: 'Test description 1' },
      { id: 2, name: 'Test Item 2', description: 'Test description 2' }
    ];
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

test('ORM数据提供者 - 基本功能验证', () => {
  const mockConnection = createMockConnection();
  const provider = ormDataProvider({
    database: 'postgresql',
    connection: mockConnection
  });
  
  expect(provider).toBeDefined();
  expect(typeof provider.getList).toBe('function');
  expect(typeof provider.create).toBe('function');
  expect(typeof provider.update).toBe('function');
  expect(typeof provider.getOne).toBe('function');
  expect(typeof provider.deleteOne).toBe('function');
  expect(typeof provider.queryWithOrm).toBe('function');
  expect(typeof provider.transaction).toBe('function');
});

test('ORM数据提供者 - getList 操作', async () => {
  const mockConnection = createMockConnection();
  const provider = ormDataProvider({
    database: 'postgresql',
    connection: mockConnection
  });
  
  const result = await provider.getList({
    resource: 'posts',
    pagination: { current: 1, pageSize: 10 }
  });
  
  expect(result).toHaveProperty('data');
  expect(result).toHaveProperty('total');
  expect(Array.isArray(result.data)).toBe(true);
});

test('ORM数据提供者 - create 操作', async () => {
  const mockConnection = createMockConnection();
  const provider = ormDataProvider({
    database: 'postgresql',
    connection: mockConnection
  });
  
  const result = await provider.create({
    resource: 'posts',
    variables: { title: 'New Post', content: 'Post content' }
  });
  
  expect(result).toHaveProperty('data');
});
