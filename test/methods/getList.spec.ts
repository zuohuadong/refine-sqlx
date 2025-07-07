import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('getList', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [],
      sorters: [],
      meta: {}
    });

    expect(response.data[0]['id']).toBe(1);
    expect(response.data[0]['title']).toBe('Test Post');
    expect(response.total).toBe(2);
  });

  it('correct response with pagination', async () => {
    const response = await dataProvider(mockDb).getList({
      resource: 'posts',
      pagination: {
        current: 1,
        pageSize: 1,
      },
      filters: [],
      sorters: [],
      meta: {}
    });

    expect(response.data[0]['id']).toBe(1);
    expect(response.data[0]['title']).toBe('Test Post');
    expect(response.total).toBe(2); // Total should be 2 (all records)
  });

  it('correct sorting response', async () => {
    const response = await dataProvider(mockDb).getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [],
      sorters: [
        {
          field: 'id',
          order: 'desc',
        }
      ],
      meta: {}
    });

    expect(response.data[0]['id']).toBe(2); // With desc order, id=2 should come first
    expect(response.data[0]['title']).toBe('Another Post');
    expect(response.total).toBe(2);
  });

  it('correct filter response', async () => {
    const response = await dataProvider(mockDb).getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [
        {
          field: 'category_id',
          operator: 'eq',
          value: ['2'],
        },
      ],
      sorters: [],
      meta: {}
    });

    expect(response.data.length).toBeGreaterThan(0);
    expect(response.total).toBeGreaterThan(0);
  });

  it('correct filter and sort response', async () => {
    const response = await dataProvider(mockDb).getList({
      resource: 'posts',
      pagination: { current: 1, pageSize: 10 },
      filters: [
        {
          field: 'category_id',
          operator: 'eq',
          value: ['2'],
        },
      ],
      sorters: [
        {
          field: 'title',
          order: 'asc',
        }
      ],
      meta: {}
    });

    expect(response.data.length).toBeGreaterThan(0);
    expect(response.total).toBeGreaterThan(0);
  });
});
