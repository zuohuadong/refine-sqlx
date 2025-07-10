import { describe, it, expect, vi } from 'vitest';
import createRefineSQL from '../src/data-provider';
import type { SqlClient } from '../src/client';
import type {
  GetListParams,
  CreateParams,
  UpdateParams,
  DeleteOneParams,
} from '@refinedev/core';

// Mock SQL client
const createMockClient = (): SqlClient => ({
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  batch: vi.fn(),
});

describe('Data Provider Integration', () => {
  it('should perform getList with filters and sorting', async () => {
    const mockClient = createMockClient();
    (mockClient.query as any)
      .mockResolvedValueOnce({
        columnNames: ['id', 'name', 'email'],
        rows: [
          [1, 'John', 'john@example.com'],
          [2, 'Jane', 'jane@example.com'],
        ],
      })
      .mockResolvedValueOnce({ rows: [[2]] });

    const dataProvider = createRefineSQL(mockClient);

    const params: GetListParams = {
      resource: 'users',
      filters: [{ field: 'name', operator: 'contains', value: 'J' }],
      sorters: [{ field: 'name', order: 'asc' }],
      pagination: { current: 1, pageSize: 10 },
    };

    const result = await dataProvider.getList(params);

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(mockClient.query).toHaveBeenCalledWith({
      sql: 'SELECT * FROM users WHERE "name" LIKE ? ORDER BY name ASC LIMIT ? OFFSET ?',
      args: ['%J%', 10, 0],
    });
  });

  it('should perform createMany using transactions when available', async () => {
    const mockClient = createMockClient();
    const mockTxClient = createMockClient();

    (mockClient.transaction as any).mockImplementation(async (fn) => {
      (mockTxClient.execute as any).mockResolvedValue({ lastInsertId: 1 });
      return fn(mockTxClient);
    });

    (mockClient.query as any).mockResolvedValue({
      columnNames: ['id', 'name'],
      rows: [[1, 'John']],
    });

    const dataProvider = createRefineSQL(mockClient);

    const params: CreateParams = {
      resource: 'users',
      variables: [{ name: 'John' }, { name: 'Jane' }],
    };

    const result = await dataProvider.createMany(params);

    expect(mockClient.transaction).toHaveBeenCalled();
    expect(result.data).toBeDefined();
  });

  it('should perform createMany using batch when available', async () => {
    const mockClient = createMockClient();
    mockClient.transaction = undefined; // No transaction support

    (mockClient.batch as any).mockResolvedValue([
      { changes: 1, lastInsertId: 1 },
      { changes: 1, lastInsertId: 2 },
    ]);

    const dataProvider = createRefineSQL(mockClient);

    const params: CreateParams = {
      resource: 'users',
      variables: [{ name: 'John' }, { name: 'Jane' }],
    };

    const result = await dataProvider.createMany(params);

    expect(mockClient.batch).toHaveBeenCalled();
    expect(result.data).toBeDefined();
  });

  it('should handle update operations', async () => {
    const mockClient = createMockClient();
    (mockClient.execute as any).mockResolvedValue({ changes: 1 });
    (mockClient.query as any).mockResolvedValue({
      columnNames: ['id', 'name'],
      rows: [[1, 'John Updated']],
    });

    const dataProvider = createRefineSQL(mockClient);

    const params: UpdateParams = {
      resource: 'users',
      id: 1,
      variables: { name: 'John Updated' },
    };

    const result = await dataProvider.update(params);

    expect(result.data).toEqual({ id: 1, name: 'John Updated' });
    expect(mockClient.execute).toHaveBeenCalledWith({
      sql: 'UPDATE users SET name = ? WHERE "id" = ?',
      args: ['John Updated', 1],
    });
  });

  it('should handle delete operations', async () => {
    const mockClient = createMockClient();
    (mockClient.query as any).mockResolvedValue({
      columnNames: ['id', 'name'],
      rows: [[1, 'John']],
    });
    (mockClient.execute as any).mockResolvedValue({ changes: 1 });

    const dataProvider = createRefineSQL(mockClient);

    const params: DeleteOneParams = { resource: 'users', id: 1 };

    const result = await dataProvider.deleteOne(params);

    expect(result.data).toEqual({ id: 1, name: 'John' });
    expect(mockClient.execute).toHaveBeenCalledWith({
      sql: 'DELETE FROM users WHERE "id" = ?',
      args: [1],
    });
  });

  it('should use custom id column name from meta', async () => {
    const mockClient = createMockClient();
    (mockClient.query as any).mockResolvedValue({
      columnNames: ['uuid', 'name'],
      rows: [['123e4567-e89b-12d3-a456-426614174000', 'John']],
    });

    const dataProvider = createRefineSQL(mockClient);

    const params: GetListParams = {
      resource: 'users',
      meta: { idColumnName: 'uuid' },
    };

    await dataProvider.getOne({
      resource: 'users',
      id: '123e4567-e89b-12d3-a456-426614174000',
      meta: { idColumnName: 'uuid' },
    });

    expect(mockClient.query).toHaveBeenCalledWith({
      sql: 'SELECT * FROM users WHERE "uuid" = ?',
      args: ['123e4567-e89b-12d3-a456-426614174000'],
    });
  });
});

describe('Data Provider Factory', () => {
  it('should accept SqlClient directly', () => {
    const mockClient = createMockClient();
    const dataProvider = createRefineSQL(mockClient);

    expect(dataProvider).toBeDefined();
    expect(dataProvider.getList).toBeInstanceOf(Function);
  });

  it('should accept SqlClientFactory', () => {
    const mockFactory = {
      connect: vi.fn().mockResolvedValue(createMockClient()),
    };
    const dataProvider = createRefineSQL(mockFactory);

    expect(dataProvider).toBeDefined();
    expect(dataProvider.getList).toBeInstanceOf(Function);
  });
});
