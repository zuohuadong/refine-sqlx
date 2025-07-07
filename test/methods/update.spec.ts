import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('update', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).update({
      resource: 'posts',
      id: '1',
      variables: {
        title: 'Updated Post',
      },
      meta: {}
    });

    const { data } = response;

    expect(data['id']).toBe(1);
    expect(data['title']).toBe('Updated Post');
  });
});
