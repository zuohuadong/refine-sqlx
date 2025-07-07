import { describe, it, expect } from 'vitest';
import { dataProvider } from '../../src';
import { MockD1Database } from '../mock-d1';

describe('getApiUrl', () => {
  const mockDb = new MockD1Database();

  it('returns correct API URL', () => {
    const provider = dataProvider(mockDb);
    const apiUrl = provider.getApiUrl();

    expect(apiUrl).toBe('/api');
  });
});
