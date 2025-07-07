import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('deleteMany', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).deleteMany({
      resource: 'posts',
      ids: [1, 2],
      meta: {}
    });

    const { data } = response;

    expect(data).toHaveLength(2);
    expect(data[0]['id']).toBe(1);
    expect(data[0]['title']).toBe('Test Post');
    expect(data[1]['id']).toBe(2);
    expect(data[1]['title']).toBe('Another Post');
  });

  it('handles empty ids', async () => {
    const response = await dataProvider(mockDb).deleteMany({
      resource: 'posts',
      ids: [],
      meta: {}
    });

    const { data } = response;

    expect(data).toHaveLength(0);
  });
});
