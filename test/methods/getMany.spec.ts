import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('getMany', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).getMany({
      resource: 'posts',
      ids: [1, 2],
      meta: {}
    });

    const { data } = response;

    expect(data[0]['id']).toBe(1);
    expect(data[1]['id']).toBe(2);
  });
});
