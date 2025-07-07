import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('getOne', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).getOne({
      resource: 'posts',
      id: '2',
      meta: {}
    });

    const { data } = response;

    expect(data.id).toBe(2);
    expect(data.title).toBe('Another Post');
  });
});
