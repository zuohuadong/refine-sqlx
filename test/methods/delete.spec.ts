import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('deleteOne', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).deleteOne({
      resource: 'posts',
      id: '1',
      meta: {}
    });

    const { data } = response;

    expect(data).toEqual(null);
  });
});
