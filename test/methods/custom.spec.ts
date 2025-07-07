import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('custom', () => {
  const mockDb = new MockD1Database();

  it('executes custom SQL query', async () => {
    const response = await dataProvider(mockDb).custom({
      url: '/custom',
      method: 'get',
      payload: {
        sql: 'SELECT * FROM posts WHERE category_id = ?',
        params: [1]
      },
      meta: {}
    });

    const { data } = response;

    expect(Array.isArray(data)).toBe(true);
    if (Array.isArray(data)) {
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]['category_id']).toBe(1);
    }
  });

  it('handles SQL from URL parameter', async () => {
    const response = await dataProvider(mockDb).custom({
      url: '/custom?sql=SELECT COUNT(*) as count FROM posts',
      method: 'get',
      meta: {}
    });

    const { data } = response;

    expect(Array.isArray(data)).toBe(true);
    if (Array.isArray(data)) {
      expect(data[0]['count']).toBe(2);
    }
  });

  it('throws error when no SQL provided', async () => {
    await expect(
      dataProvider(mockDb).custom({
        url: '/custom',
        method: 'get',
        meta: {}
      })
    ).rejects.toThrow('No SQL query provided for custom method');
  });
});
