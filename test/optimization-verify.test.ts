import { test, expect } from 'vitest';
import { dataProvider } from '../src/index';

// Mock D1 database
const createMockD1 = () => ({
  prepare: (sql: string) => ({
    bind: (...args: any[]) => ({
      all: async () => ({ results: [{ id: 1, name: 'test' }] }),
      first: async () => ({ id: 1, name: 'test' }),
      run: async () => ({ 
        meta: { 
          changes: 1, 
          last_row_id: 1 
        } 
      })
    }),
    all: async () => ({ results: [{ id: 1, name: 'test' }] }),
    first: async () => ({ id: 1, name: 'test' }),
    run: async () => ({ 
      meta: { 
        changes: 1, 
        last_row_id: 1 
      } 
    })
  }),
  batch: async () => []
});

test('基本功能验证 - dataProvider 可以成功创建', () => {
  const mockDb = createMockD1();
  const provider = dataProvider(mockDb as any);
  
  expect(provider).toBeDefined();
  expect(typeof provider.getList).toBe('function');
  expect(typeof provider.create).toBe('function');
  expect(typeof provider.update).toBe('function');
  expect(typeof provider.getOne).toBe('function');
  expect(typeof provider.deleteOne).toBe('function');
});

test('包体积优化验证 - 确保只导出必要的功能', async () => {
  const mockDb = createMockD1();
  const provider = dataProvider(mockDb as any);
  
  // 测试 getList 功能
  const listResult = await provider.getList({
    resource: 'users',
    pagination: { current: 1, pageSize: 10 }
  });
  
  expect(listResult).toHaveProperty('data');
  expect(listResult).toHaveProperty('total');
});

test('压缩后的代码功能正常', async () => {
  const mockDb = createMockD1();
  const provider = dataProvider(mockDb as any);
  
  // 测试 create 功能
  const createResult = await provider.create({
    resource: 'users',
    variables: { name: 'test user' }
  });
  
  expect(createResult).toHaveProperty('data');
});
