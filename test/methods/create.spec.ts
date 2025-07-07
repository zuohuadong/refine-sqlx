import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('create', () => {
  const mockDb = new MockD1Database();

  it('correct response', async () => {
    const response = await dataProvider(mockDb).create({
      resource: 'posts',
      variables: { id: 1001, title: 'foo', category_id: 1 },
      meta: {}
    });

    const { data } = response;

    expect(data['id']).toBe(1001);
    expect(data['title']).toBe('foo');
    expect(data['category_id']).toBe(1);
  });
});