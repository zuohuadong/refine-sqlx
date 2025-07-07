import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('createMany', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).createMany({
      resource: 'posts',
      variables: [
        { id: 1001, title: 'Post 1', category_id: 1 },
        { id: 1002, title: 'Post 2', category_id: 2 }
      ],
      meta: {}
    });

    const { data } = response;

    expect(data).toHaveLength(2);
    expect(data[0]['id']).toBe(1001);
    expect(data[0]['title']).toBe('Post 1');
    expect(data[1]['id']).toBe(1002);
    expect(data[1]['title']).toBe('Post 2');
  });

  it('handles empty variables', async () => {
    const response = await dataProvider(mockDb).createMany({
      resource: 'posts',
      variables: [],
      meta: {}
    });

    const { data } = response;

    expect(data).toHaveLength(0);
  });
});
